import { createAcePoller } from './ace-live.mjs';

// --- Configuration -----------------------------------------------------
const SITE = 'ace';
const ASSET = 'wec-1';
const API_BASE = 'https://ace-api.duckdns.org';

const LIVE_FIELDS = ['wec_active_power', 'wec_wind_speed', 'wec_rotor_speed', 'wec_nacelle_position', 'wec_energy_exported'];

const LIVE_ENDPOINT =
  `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/wec_instantaneous/latest` +
  `?resolution=1s&fields=${LIVE_FIELDS.join(',')}&limit=1`;

const AVAILABILITY_ENDPOINT =
  `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/wec_availability/latest` +
  `?resolution=daily&fields=availability&limit=1`;

const WEC_CONFIG_ENDPOINT = `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/configuration/latest`;

const STALE_AFTER_MS = 15_000;
let ratedCapacityKw = 4245; // Default/fallback; refined from the API once at startup.

// --- DOM references -----------------------------------------------------
const sceneEl = document.getElementById('scene');
const skyEl = document.getElementById('sky');
const windLayerEl = document.getElementById('wind-layer');
const freshnessEl = document.getElementById('freshness');
const powerValueEl = document.getElementById('power-value');
const windValueEl = document.getElementById('wind-value');
const observedEl = document.getElementById('observed-value');
const ratedCapacityEl = document.getElementById('rated-capacity');
const meterFillEl = document.getElementById('meter-fill');
const headingValueEl = document.getElementById('heading-value');
const rotorGroupEl = document.getElementById('rotor');
const fallbackMessageEl = document.getElementById('fallback-message');
const lifetimeEnergyEl = document.getElementById('lifetime-energy');
const availabilityTodayEl = document.getElementById('availability-today');

// --- State ---------------------------------------------------------------
let lastGoodObservedAtMs = null;
let unavailable = false;

const numberFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const oneDecimalFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

function compassLabel(deg) {
  if (!Number.isFinite(deg)) return '--';
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const normalised = ((deg % 360) + 360) % 360;
  const index = Math.round(normalised / 22.5) % 16;
  return points[index];
}

function isGoodQuality(quality) {
  return typeof quality === 'string' && quality.toLowerCase() === 'good';
}

// --- Decorative wind streaks (purely visual; intensity driven by real wind speed) ---
const STREAK_COUNT = 7;
const streaks = [];
for (let i = 0; i < STREAK_COUNT; i += 1) {
  const streak = document.createElement('div');
  streak.className = 'streak';
  streak.style.top = `${8 + i * 9 + (i % 2 === 0 ? 2 : -2)}%`;
  streak.style.animationDelay = `${i * -1.3}s`;
  windLayerEl.appendChild(streak);
  streaks.push(streak);
}

function updateWindVisual(windSpeedMs) {
  // Faster wind -> shorter streak duration (faster apparent motion) and more opacity.
  const clamped = Math.max(0, Math.min(25, windSpeedMs));
  const duration = Math.max(2.5, 14 - clamped * 0.5);
  const opacity = Math.min(1, 0.25 + clamped / 18);
  streaks.forEach((streak) => {
    streak.style.animationDuration = `${duration}s`;
    streak.style.opacity = clamped < 0.5 ? 0 : String(opacity);
  });
}

// --- Decorative diurnal sky (purely cosmetic; based on the visitor's local clock, not ACE data) ---
function updateSky() {
  const hour = new Date().getHours();
  let top;
  let bottom;
  if (hour < 6 || hour >= 21) {
    top = '#060e21';
    bottom = '#132743';
  } else if (hour < 9) {
    top = '#2b4f81';
    bottom = '#f3b98a';
  } else if (hour < 18) {
    top = '#2b6cb0';
    bottom = '#bcdffb';
  } else {
    top = '#2a3a63';
    bottom = '#e58a6b';
  }
  skyEl.style.setProperty('--sky-a', top);
  skyEl.style.setProperty('--sky-b', bottom);
}
updateSky();
setInterval(updateSky, 60_000);

// --- Rotor animation (driven by requestAnimationFrame, not CSS, so the
// off-centre SVG pivot (800, 393) rotates reliably across browsers) --------
const ROTOR_PIVOT = '800 393';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentRpm = 0;
let bladeAngleDeg = 0;
let lastFrameTimeMs = null;

function animateRotor(timestampMs) {
  if (lastFrameTimeMs !== null && !prefersReducedMotion && currentRpm > 0.5) {
    const deltaSeconds = (timestampMs - lastFrameTimeMs) / 1000;
    bladeAngleDeg = (bladeAngleDeg + (currentRpm / 60) * 360 * deltaSeconds) % 360;
    rotorGroupEl.setAttribute('transform', `rotate(${bladeAngleDeg.toFixed(2)} ${ROTOR_PIVOT})`);
  }
  lastFrameTimeMs = timestampMs;
  requestAnimationFrame(animateRotor);
}
requestAnimationFrame(animateRotor);

// --- Freshness -------------------------------------------------------------
function showFreshness() {
  let state;
  let label;
  if (unavailable && lastGoodObservedAtMs === null) {
    state = 'offline';
    label = 'Unavailable — waiting for first reading';
  } else if (unavailable) {
    state = 'offline';
    label = 'Offline — showing last known reading';
  } else if (lastGoodObservedAtMs === null) {
    state = 'stale';
    label = 'Connecting…';
  } else if (Date.now() - lastGoodObservedAtMs > STALE_AFTER_MS) {
    state = 'stale';
    label = 'Stale reading';
  } else {
    state = 'good';
    label = 'Live';
  }
  freshnessEl.textContent = label;
  freshnessEl.className = `freshness ${state}`;
  sceneEl.classList.toggle('offline', state === 'offline');
  fallbackMessageEl.hidden = state !== 'offline';
  if (state === 'offline') currentRpm = 0;
}

function handleLiveData(data) {
  const series = data.series || {};
  const quality = data.series_quality || {};
  const observedAt = data.series_observed_at || {};

  const requiredOk = LIVE_FIELDS.every((field) => {
    const value = series[field]?.[0];
    const observed = observedAt[field]?.[0];
    return (
      Number.isFinite(value) &&
      isGoodQuality(quality[field]?.[0]) &&
      Number.isFinite(observed) &&
      Number.isFinite(new Date(observed / 1000).getTime()) &&
      observed / 1000 <= Date.now() + 60_000
    );
  });

  if (!requiredOk) {
    throw new Error('Missing or invalid signal in wec_instantaneous response');
  }

  const power = series.wec_active_power[0];
  const wind = series.wec_wind_speed[0];
  const rotorRpm = series.wec_rotor_speed[0];
  const heading = series.wec_nacelle_position[0];
  const lifetimeEnergy = series.wec_energy_exported[0];

  const oldestObservedMicros = Math.min(...LIVE_FIELDS.map((f) => observedAt[f][0]));
  lastGoodObservedAtMs = oldestObservedMicros / 1000;

  powerValueEl.textContent = numberFormatter.format(power);
  windValueEl.textContent = oneDecimalFormatter.format(wind);
  observedEl.textContent = new Date(lastGoodObservedAtMs).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
  });
  lifetimeEnergyEl.textContent = numberFormatter.format(lifetimeEnergy);

  const fraction = Math.max(0, Math.min(1, power / ratedCapacityKw));
  meterFillEl.style.height = `${fraction * 100}%`;

  headingValueEl.textContent = `${compassLabel(heading)} (${Math.round(heading)}°)`;
  updateWindVisual(wind);
  currentRpm = rotorRpm;

  unavailable = false;
  showFreshness();
}

function handleLiveError() {
  unavailable = true;
  showFreshness();
}

const poller = createAcePoller({
  endpoint: LIVE_ENDPOINT,
  onData: handleLiveData,
  onError: handleLiveError,
  intervalMs: 1000,
});

setInterval(showFreshness, 1000); // Updates labels/visual state only; no network call.

document.addEventListener('visibilitychange', () => {
  if (document.hidden) poller.stop();
  else poller.start();
});

if (!document.hidden) poller.start();

// --- One-off fetch: rated capacity, used to scale the energy meter --------
async function loadStaticConfiguration() {
  try {
    const response = await fetch(WEC_CONFIG_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const nominalPower = data.changes?.find((c) => c.signal === 'wec_nominal_power')?.value;
    if (Number.isFinite(nominalPower)) {
      ratedCapacityKw = nominalPower;
      ratedCapacityEl.textContent = numberFormatter.format(nominalPower);
    }
  } catch (error) {
    console.warn('Could not refresh static turbine configuration; using fallback rated capacity:', error);
  }
}

async function loadAvailability() {
  try {
    const response = await fetch(AVAILABILITY_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const value = data.series?.availability?.[0];
    availabilityTodayEl.textContent = Number.isFinite(value) ? oneDecimalFormatter.format(value) : '--';
  } catch (error) {
    availabilityTodayEl.textContent = '--';
    console.warn('Could not load daily availability:', error);
  }
}

loadStaticConfiguration();
loadAvailability();
// Availability is a daily figure; the API's own recommended refresh for this
// family is hourly, so re-check occasionally rather than every second.
setInterval(loadAvailability, 60 * 60 * 1000);
