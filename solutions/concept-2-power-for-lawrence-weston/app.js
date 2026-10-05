import { createAcePoller } from './ace-live.mjs';

// --- Configuration -----------------------------------------------------
const SITE = 'ace';
const ASSET = 'wec-1';
const API_BASE = 'https://ace-api.duckdns.org';

const LIVE_FIELDS = [
  'wec_active_power',
  'wec_wind_speed',
  'wec_nacelle_position',
  'wec_energy_exported',
  'wec_operating_hours',
];

const LIVE_ENDPOINT =
  `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/wec_instantaneous/latest` +
  `?resolution=1s&fields=${LIVE_FIELDS.join(',')}&limit=1`;

const AVAILABILITY_ENDPOINT =
  `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/wec_availability/latest` +
  `?resolution=daily&fields=availability&limit=1`;

const WEC_CONFIG_ENDPOINT = `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/configuration/latest`;

const STALE_AFTER_MS = 15_000;
const SLIDE_INTERVAL_MS = 12_000;
const RESUME_AFTER_MANUAL_MS = 20_000;

// --- DOM references -----------------------------------------------------
const freshnessEl = document.getElementById('freshness');
const powerValueEl = document.getElementById('power-value');
const windValueEl = document.getElementById('wind-value');
const headingValueEl = document.getElementById('heading-value');
const observedEl = document.getElementById('observed-value');
const lifetimeEnergyEl = document.getElementById('lifetime-energy');
const ratedCapacityEl = document.getElementById('rated-capacity');
const availabilityTodayEl = document.getElementById('availability-today');
const operatingYearsEl = document.getElementById('operating-years');

const slides = Array.from(document.querySelectorAll('.slide'));
const dots = Array.from(document.querySelectorAll('.dot'));

// --- State ---------------------------------------------------------------
let lastGoodObservedAtMs = null;
let unavailable = false;
let currentSlide = 0;
let autoTimer = null;
let resumeTimer = null;

const numberFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const oneDecimalFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

function compassLabel(deg) {
  if (!Number.isFinite(deg)) return '--';
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const normalised = ((deg % 360) + 360) % 360;
  const index = Math.round(normalised / 22.5) % 16;
  return points[index];
}

// --- Slide carousel -------------------------------------------------------
function showSlide(index) {
  currentSlide = ((index % slides.length) + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle('active', i === currentSlide));
  dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
}

function startAuto() {
  clearInterval(autoTimer);
  autoTimer = setInterval(() => showSlide(currentSlide + 1), SLIDE_INTERVAL_MS);
}

function goToSlide(index) {
  showSlide(index);
  startAuto();
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(startAuto, RESUME_AFTER_MANUAL_MS);
}

dots.forEach((dot, i) => {
  dot.addEventListener('click', () => goToSlide(i));
});

showSlide(0);
startAuto();

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
}

function isGoodQuality(quality) {
  return typeof quality === 'string' && quality.toLowerCase() === 'good';
}

function formatOperatingYears(hours) {
  if (!Number.isFinite(hours)) return '--';
  const years = hours / (24 * 365.25);
  return `${oneDecimalFormatter.format(years)} years`;
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
  const heading = series.wec_nacelle_position[0];
  const lifetimeEnergy = series.wec_energy_exported[0];
  const operatingHours = series.wec_operating_hours[0];

  const oldestObservedMicros = Math.min(...LIVE_FIELDS.map((f) => observedAt[f][0]));
  lastGoodObservedAtMs = oldestObservedMicros / 1000;

  powerValueEl.textContent = numberFormatter.format(power);
  windValueEl.textContent = oneDecimalFormatter.format(wind);
  headingValueEl.textContent = `${compassLabel(heading)} (${Math.round(heading)}°)`;
  lifetimeEnergyEl.textContent = numberFormatter.format(lifetimeEnergy);
  operatingYearsEl.textContent = formatOperatingYears(operatingHours);
  observedEl.textContent = `Reading observed ${new Date(lastGoodObservedAtMs).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
  })}`;

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

setInterval(showFreshness, 1000); // Updates the badge text only; no network call.

document.addEventListener('visibilitychange', () => {
  if (document.hidden) poller.stop();
  else poller.start();
});

if (!document.hidden) poller.start();

// --- One-off / infrequent fetches (not part of the 1 Hz poller) ----------

async function loadStaticConfiguration() {
  try {
    const response = await fetch(WEC_CONFIG_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const nominalPower = data.changes?.find((c) => c.signal === 'wec_nominal_power')?.value;
    if (Number.isFinite(nominalPower)) {
      ratedCapacityEl.textContent = `${numberFormatter.format(nominalPower)} kW`;
    }
  } catch (error) {
    console.warn('Could not refresh static turbine configuration:', error);
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
setInterval(loadAvailability, 60 * 60 * 1000);
