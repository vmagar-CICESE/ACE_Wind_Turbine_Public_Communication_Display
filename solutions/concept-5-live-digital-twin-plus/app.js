import { createAcePoller } from './ace-live.mjs';

// --- Configuration -----------------------------------------------------
const SITE = 'ace';
const ASSET = 'wec-1';
const API_BASE = 'https://ace-api.duckdns.org';

// The 5 fields the animation itself depends on (identical to concept-3).
// If any of these is missing/bad, the whole scene goes to its offline state.
const CORE_FIELDS = ['wec_active_power', 'wec_wind_speed', 'wec_rotor_speed', 'wec_nacelle_position', 'wec_energy_exported'];

// Additional wec_instantaneous fields shown only in the "Explore more data"
// panel. These ride along in the SAME request/poller as CORE_FIELDS (merged
// fields list below) so the whole page still makes at most one request per
// second — adding them costs nothing extra against the API's rate budget.
// Each is validated independently: a problem with one of these never affects
// the turbine animation or the core info panel.
const EXTRA_INSTANT_FIELDS = [
  'wec_wind_direction', 'wec_operating_hours', 'wec_power_factor', 'wec_reactive_power',
  'wec_voltage_l1', 'wec_voltage_l2', 'wec_voltage_l3',
  'wec_current_l1', 'wec_current_l2', 'wec_current_l3',
  'wec_frequency', 'wec_available_power_by_wind', 'wec_technically_available_power',
];

const ALL_INSTANT_FIELDS = [...CORE_FIELDS, ...EXTRA_INSTANT_FIELDS];

const LIVE_ENDPOINT =
  `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/wec_instantaneous/latest` +
  `?resolution=1s&fields=${ALL_INSTANT_FIELDS.join(',')}&limit=1`;

// A handful of 10-minute-average fields that only exist in the "wecstd"
// family, polled far more slowly (per the API's own recommended cadence for
// that resolution) in a second, independent poller.
const WECSTD_FIELDS = ['air_pressure_mean', 'blade_angle_mean'];
const WECSTD_ENDPOINT =
  `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/wecstd/latest` +
  `?resolution=10m&fields=${WECSTD_FIELDS.join(',')}&limit=1`;

const AVAILABILITY_ENDPOINT =
  `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/wec_availability/latest` +
  `?resolution=daily&fields=availability&limit=1`;

const WEC_CONFIG_ENDPOINT = `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/configuration/latest`;

const STALE_AFTER_MS = 15_000; // For 1-second core/extra signals.
const WECSTD_STALE_AFTER_MS = 20 * 60 * 1000; // 10-min signals; stale after ~2 cycles.

let ratedCapacityKw = 4245; // Default/fallback; refined from the API once at startup.

// --- Signal catalogue for the "Explore more data" panel -------------------
// Only real, working sensors are listed here. A few wecstd weather fields
// (precipitation_mean, visibility_mean, ambient_brightness_mean,
// air_humidity_mean) were checked against the live feed while building this
// concept and found to always return a constant sentinel value (e.g.
// 65535/65.535, the raw register's maximum), meaning those sensors are not
// actually fitted on this turbine even though the API marks them "good"
// quality. Per this project's "honest data only" rule, they are left out
// rather than shown as if they were real readings. See README.md.
//
// `fields` is always what the live value above the chart is read from (the
// fast wec_instantaneous poller, for a true "right now" reading). Where the
// API also offers a proper pre-averaged "_mean" counterpart in the wecstd
// family, `chartFields`/`chartLabel` point the *history chart* at that
// instead — this matches what the official ACE reference dashboard plots
// ("Mean active power", "Mean wind speed", etc.), which can look noticeably
// different in shape from a run of single instantaneous samples. When
// omitted, the chart just reuses `fields`/`label`.
const SIGNAL_CATALOG = [
  // --- Wind & weather ---
  { id: 'wind_speed', group: 'Wind & weather', label: 'Wind speed', unit: 'm/s', decimals: 1,
    source: 'core', fields: ['wec_wind_speed'],
    chart: { family: 'wecstd', resolution: '10m', hours: 24 * 7 }, chartFields: ['wind_speed_mean'], chartLabel: 'Mean wind speed' },
  { id: 'wind_direction', group: 'Wind & weather', label: 'Wind direction', unit: '°', decimals: 0, compass: true,
    source: 'core', fields: ['wec_wind_direction'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
  { id: 'air_pressure', group: 'Wind & weather', label: 'Air pressure', unit: 'mbar', decimals: 0,
    source: 'wecstd', fields: ['air_pressure_mean'], chart: { family: 'wecstd', resolution: '10m', hours: 24 } },

  // --- Turbine mechanics ---
  { id: 'rotor_speed', group: 'Turbine mechanics', label: 'Rotor speed', unit: 'rpm', decimals: 1,
    source: 'core', fields: ['wec_rotor_speed'],
    chart: { family: 'wecstd', resolution: '10m', hours: 24 * 7 }, chartFields: ['rotor_speed_mean'], chartLabel: 'Mean rotor speed' },
  { id: 'nacelle_position', group: 'Turbine mechanics', label: 'Nacelle position (heading)', unit: '°', decimals: 0, compass: true,
    source: 'core', fields: ['wec_nacelle_position'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
  { id: 'blade_angle', group: 'Turbine mechanics', label: 'Blade (pitch) angle', unit: '°', decimals: 1,
    source: 'wecstd', fields: ['blade_angle_mean'], chart: { family: 'wecstd', resolution: '10m', hours: 24 } },
  { id: 'operating_hours', group: 'Turbine mechanics', label: 'Operating hours (lifetime)', unit: 'h', decimals: 0,
    source: 'core', fields: ['wec_operating_hours'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },

  // --- Power & electrical ---
  { id: 'active_power', group: 'Power & electrical', label: 'Active power', unit: 'kW', decimals: 0,
    source: 'core', fields: ['wec_active_power'],
    chart: { family: 'wecstd', resolution: '10m', hours: 24 * 7 }, chartFields: ['active_power_mean'], chartLabel: 'Mean active power',
    note: 'A small negative reading is normal — it means the turbine is briefly drawing a little power from the grid for its own systems (e.g. yaw motors) in low wind, rather than generating.' },
  { id: 'reactive_power', group: 'Power & electrical', label: 'Reactive power', unit: 'kvar', decimals: 0,
    source: 'core', fields: ['wec_reactive_power'],
    chart: { family: 'wecstd', resolution: '10m', hours: 24 * 7 }, chartFields: ['reactive_power_mean'], chartLabel: 'Mean reactive power',
    note: 'Reactive power (kvar) supports grid voltage rather than doing useful work directly — it can be positive or negative depending on grid conditions, independent of whether the turbine is generating active power.' },
  { id: 'power_factor', group: 'Power & electrical', label: 'Power factor', unit: '', decimals: 2,
    source: 'core', fields: ['wec_power_factor'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
  { id: 'grid_frequency', group: 'Power & electrical', label: 'Grid frequency', unit: 'Hz', decimals: 2,
    source: 'core', fields: ['wec_frequency'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
  { id: 'grid_voltage', group: 'Power & electrical', label: 'Grid voltage (3-phase)', unit: 'V', decimals: 0, multi: true,
    source: 'core', fields: ['wec_voltage_l1', 'wec_voltage_l2', 'wec_voltage_l3'], seriesLabels: ['L1', 'L2', 'L3'],
    chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
  { id: 'grid_current', group: 'Power & electrical', label: 'Grid current (3-phase)', unit: 'A', decimals: 1, multi: true,
    source: 'core', fields: ['wec_current_l1', 'wec_current_l2', 'wec_current_l3'], seriesLabels: ['L1', 'L2', 'L3'],
    chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },

  // --- Energy & availability ---
  { id: 'energy_exported', group: 'Energy & availability', label: 'Lifetime energy exported', unit: 'kWh', decimals: 0,
    source: 'core', fields: ['wec_energy_exported'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
  { id: 'availability_today', group: 'Energy & availability', label: 'Daily availability', unit: '%', decimals: 1,
    source: 'availability', fields: ['availability'], chart: { family: 'wec_availability', resolution: 'daily', hours: 24 * 14 } },
  { id: 'available_power_by_wind', group: 'Energy & availability', label: 'Available power by wind', unit: 'kW', decimals: 0,
    source: 'core', fields: ['wec_available_power_by_wind'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
  { id: 'technically_available_power', group: 'Energy & availability', label: 'Technically available power', unit: 'kW', decimals: 0,
    source: 'core', fields: ['wec_technically_available_power'], chart: { family: 'wec_instantaneous', resolution: '60s', hours: 3 } },
];

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
const operatingHoursEl = document.getElementById('operating-hours');

const explorerToggleEl = document.getElementById('explorer-toggle');
const explorerPanelEl = document.getElementById('explorer-panel');
const signalSelectEl = document.getElementById('signal-select');
const signalValueEl = document.getElementById('signal-value');
const signalUnitEl = document.getElementById('signal-unit');
const signalFreshnessEl = document.getElementById('signal-freshness');
const signalChartEl = document.getElementById('signal-chart');
const chartStatusEl = document.getElementById('chart-status');
const chartTitleEl = document.getElementById('chart-title');
const signalLegendEl = document.getElementById('signal-legend');
const signalNoteEl = document.getElementById('signal-note');

// --- State ---------------------------------------------------------------
let lastGoodObservedAtMs = null;
let unavailable = false;
let wecstdUnavailable = false;

// Per-signal caches, keyed by field name, each holding the latest
// { value, observedAtMs, good } reading from whichever poller owns it.
const coreCache = {};
const wecstdCache = {};
let availabilityValue = null;
let availabilityObservedAtMs = null;

let selectedSignalId = SIGNAL_CATALOG[0].id;
let chartAbortController = null;
let chartRequestToken = 0;

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

const decimalFormatters = new Map();
function formatNumber(value, decimals) {
  if (!decimalFormatters.has(decimals)) {
    decimalFormatters.set(decimals, new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  }
  return decimalFormatters.get(decimals).format(value);
}

function findSignal(id) {
  return SIGNAL_CATALOG.find((s) => s.id === id);
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
const ROTOR_PIVOT = '1000 393';
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

// --- Freshness (core animation) --------------------------------------------
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

  // Cache every field opportunistically (best-effort), so the explorer panel
  // can show whatever is valid even if something else is briefly missing.
  ALL_INSTANT_FIELDS.forEach((field) => {
    const value = series[field]?.[0];
    const observed = observedAt[field]?.[0];
    const good =
      Number.isFinite(value) &&
      isGoodQuality(quality[field]?.[0]) &&
      Number.isFinite(observed) &&
      Number.isFinite(new Date(observed / 1000).getTime()) &&
      observed / 1000 <= Date.now() + 60_000;
    coreCache[field] = good ? { value, observedAtMs: observed / 1000, good: true } : { ...(coreCache[field] || {}), good: false };
  });

  // The animation and core info panel only ever depend on CORE_FIELDS,
  // exactly as in concept-3 — a problem with an "extra" field never freezes
  // the turbine or marks the whole page offline.
  const requiredOk = CORE_FIELDS.every((field) => coreCache[field]?.good);

  if (!requiredOk) {
    throw new Error('Missing or invalid signal in wec_instantaneous response');
  }

  const power = coreCache.wec_active_power.value;
  const wind = coreCache.wec_wind_speed.value;
  const rotorRpm = coreCache.wec_rotor_speed.value;
  const heading = coreCache.wec_nacelle_position.value;
  const lifetimeEnergy = coreCache.wec_energy_exported.value;

  const oldestObservedMicros = Math.min(...CORE_FIELDS.map((f) => observedAt[f][0]));
  lastGoodObservedAtMs = oldestObservedMicros / 1000;

  powerValueEl.textContent = numberFormatter.format(power);
  windValueEl.textContent = oneDecimalFormatter.format(wind);
  observedEl.textContent = new Date(lastGoodObservedAtMs).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
  });
  lifetimeEnergyEl.textContent = numberFormatter.format(lifetimeEnergy);

  // Operating hours is a best-effort "extra" field, not a CORE_FIELD — show
  // it opportunistically, but never let it block the info panel otherwise.
  const operatingHours = coreCache.wec_operating_hours;
  operatingHoursEl.textContent = operatingHours?.good ? numberFormatter.format(operatingHours.value) : '--';

  const fraction = Math.max(0, Math.min(1, power / ratedCapacityKw));
  meterFillEl.style.height = `${fraction * 100}%`;

  headingValueEl.textContent = `${compassLabel(heading)} (${Math.round(heading)}°)`;
  updateWindVisual(wind);
  currentRpm = rotorRpm;

  unavailable = false;
  showFreshness();
  refreshExplorerLiveValue();
}

function handleLiveError() {
  unavailable = true;
  showFreshness();
  // Extra/core-cached fields also age out naturally via their own freshness
  // checks in refreshExplorerLiveValue(), so no separate handling is needed.
  refreshExplorerLiveValue();
}

const poller = createAcePoller({
  endpoint: LIVE_ENDPOINT,
  onData: handleLiveData,
  onError: handleLiveError,
  intervalMs: 1000,
});

function handleWecstdData(data) {
  // Unlike wec_instantaneous, the wecstd family's /latest response has no
  // per-field series_quality/series_observed_at (both come back null) — only
  // a shared top-level quality/timestamps pair for the single requested row.
  // Fall back to those shared values when the per-field ones are absent.
  const series = data.series || {};
  const perFieldQuality = data.series_quality || {};
  const perFieldObservedAt = data.series_observed_at || {};
  const sharedQuality = data.quality?.[0];
  const sharedObservedAt = data.timestamps?.[0];
  WECSTD_FIELDS.forEach((field) => {
    const value = series[field]?.[0];
    const quality = perFieldQuality[field]?.[0] ?? sharedQuality;
    const observed = perFieldObservedAt[field]?.[0] ?? sharedObservedAt;
    const good =
      Number.isFinite(value) &&
      isGoodQuality(quality) &&
      Number.isFinite(observed) &&
      Number.isFinite(new Date(observed / 1000).getTime());
    wecstdCache[field] = good ? { value, observedAtMs: observed / 1000, good: true } : { ...(wecstdCache[field] || {}), good: false };
  });
  wecstdUnavailable = false;
  refreshExplorerLiveValue();
}

function handleWecstdError() {
  wecstdUnavailable = true;
  refreshExplorerLiveValue();
}

const wecstdPoller = createAcePoller({
  endpoint: WECSTD_ENDPOINT,
  onData: handleWecstdData,
  onError: handleWecstdError,
  intervalMs: 60_000, // Matches this family/resolution's recommended refresh cadence.
});

setInterval(showFreshness, 1000); // Updates labels/visual state only; no network call.
setInterval(refreshExplorerLiveValue, 1000); // Same: re-derives staleness from cached data only.

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    poller.stop();
    wecstdPoller.stop();
  } else {
    poller.start();
    wecstdPoller.start();
  }
});

if (!document.hidden) {
  poller.start();
  wecstdPoller.start();
}

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
    const observed = data.timestamps?.[0];
    if (Number.isFinite(value)) {
      availabilityValue = value;
      availabilityObservedAtMs = Number.isFinite(observed) ? observed / 1000 : Date.now();
    }
  } catch (error) {
    console.warn('Could not load daily availability:', error);
  }
  refreshExplorerLiveValue();
}

loadStaticConfiguration();
loadAvailability();
// Availability is a daily figure; the API's own recommended refresh for this
// family is hourly, so re-check occasionally rather than every second.
setInterval(loadAvailability, 60 * 60 * 1000);

// --- "Explore more data" panel ---------------------------------------------

function populateSignalSelect() {
  const groups = new Map();
  SIGNAL_CATALOG.forEach((signal) => {
    if (!groups.has(signal.group)) groups.set(signal.group, []);
    groups.get(signal.group).push(signal);
  });
  groups.forEach((signals, groupName) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = groupName;
    signals.forEach((signal) => {
      const option = document.createElement('option');
      option.value = signal.id;
      option.textContent = signal.label;
      optgroup.appendChild(option);
    });
    signalSelectEl.appendChild(optgroup);
  });
  signalSelectEl.value = selectedSignalId;
}

function cacheFor(source) {
  if (source === 'core') return coreCache;
  if (source === 'wecstd') return wecstdCache;
  return null;
}

function staleAfterFor(source) {
  // Only reached for 'core'/'wecstd' sources — 'availability' is handled as
  // a special case in refreshExplorerLiveValue() before this is consulted.
  return source === 'wecstd' ? WECSTD_STALE_AFTER_MS : STALE_AFTER_MS;
}

function readSignalNow(signal) {
  if (signal.source === 'availability') {
    return {
      values: [availabilityValue],
      observedAtMs: availabilityObservedAtMs,
      good: Number.isFinite(availabilityValue),
    };
  }
  const cache = cacheFor(signal.source);
  const entries = signal.fields.map((f) => cache[f]);
  const good = entries.every((e) => e && e.good && Number.isFinite(e.value));
  const observedAtMs = good ? Math.min(...entries.map((e) => e.observedAtMs)) : null;
  return {
    values: entries.map((e) => (e && Number.isFinite(e.value) ? e.value : null)),
    observedAtMs,
    good,
  };
}

function isSourceUnavailable(source) {
  if (source === 'core') return unavailable;
  if (source === 'wecstd') return wecstdUnavailable;
  return false;
}

function refreshExplorerLiveValue() {
  const signal = findSignal(selectedSignalId);
  if (!signal) return;
  const { values, observedAtMs, good } = readSignalNow(signal);

  if (signal.multi) {
    signalValueEl.textContent = signal.fields
      .map((_, i) => `${signal.seriesLabels[i]}: ${Number.isFinite(values[i]) ? formatNumber(values[i], signal.decimals) : '--'}`)
      .join('   ');
  } else {
    const value = values[0];
    let text = Number.isFinite(value) ? formatNumber(value, signal.decimals) : '--';
    if (signal.compass && Number.isFinite(value)) text = `${compassLabel(value)} (${text}°)`;
    signalValueEl.textContent = text;
  }
  signalUnitEl.textContent = signal.multi ? '' : signal.unit;

  let state;
  let label;
  if (!good && observedAtMs === null) {
    state = 'offline';
    label = 'Unavailable';
  } else if (!good) {
    state = 'offline';
    label = 'Offline — showing last known reading';
  } else if (isSourceUnavailable(signal.source)) {
    // The underlying poller has just reported a network/API failure — treat
    // this as authoritative and immediate, the same way the main scene's
    // freshness badge does, rather than waiting on the clock-based staleness
    // check below (which depends on this device's clock agreeing with the
    // API's observation timestamps).
    state = 'offline';
    label = 'Offline — showing last known reading';
  } else if (signal.source === 'availability') {
    // A "daily" figure is, by its own nature, always for a recently
    // completed day rather than this exact instant — that is not a
    // connectivity problem, so it is never flagged stale/offline here.
    state = 'good';
    label = `As of ${new Date(observedAtMs).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}`;
  } else if (Date.now() - observedAtMs > staleAfterFor(signal.source)) {
    state = 'stale';
    label = `Stale · as of ${new Date(observedAtMs).toLocaleString('en-GB', { timeZone: 'Europe/London' })}`;
  } else {
    state = 'good';
    label = `Live · updated ${new Date(observedAtMs).toLocaleTimeString('en-GB', { timeZone: 'Europe/London' })}`;
  }
  signalFreshnessEl.textContent = label;
  signalFreshnessEl.className = `explorer-freshness ${state}`;
}

const CHART_COLORS = ['#3ddc84', '#64b5f6', '#f48fb1'];

function clearChart() {
  while (signalChartEl.firstChild) signalChartEl.removeChild(signalChartEl.firstChild);
}

function formatSpanLabel(hours) {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = hours / 24;
  return `${days} day${days === 1 ? '' : 's'}`;
}

function formatAxisTime(ms, spanHours) {
  const date = new Date(ms);
  if (spanHours <= 48) {
    return date.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' });
}

// Draws the chart as a plain, labelled line chart — gridlines plus real
// value/time tick labels — so the axes read clearly at a glance rather than
// relying on just two corner numbers, similar in spirit to the official ACE
// reference dashboard's own charts.
function renderChart(seriesList, { decimals = 1, unit = '', hours = 3 } = {}) {
  clearChart();
  const svgNS = 'http://www.w3.org/2000/svg';
  const width = 600;
  const height = 220;
  const pad = { left: 58, right: 14, top: 12, bottom: 34 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const allPoints = seriesList.flatMap((s) => s.points);
  if (allPoints.length < 2) return false;

  const ts = allPoints.map((p) => p.t);
  const vs = allPoints.map((p) => p.v);
  const minT = Math.min(...ts);
  const maxT = Math.max(...ts);
  let minV = Math.min(...vs);
  let maxV = Math.max(...vs);
  if (minV === maxV) {
    // Perfectly flat data (e.g. 100% availability for days on end) — centre
    // a small fixed range on the value instead of a one-sided fallback that
    // would misleadingly suggest the real value is drifting upward.
    minV -= 0.5;
    maxV += 0.5;
  }
  const spanV = maxV - minV;
  const spanT = maxT - minT || 1;

  const x = (t) => pad.left + ((t - minT) / spanT) * plotWidth;
  const y = (v) => pad.top + plotHeight - ((v - minV) / spanV) * plotHeight;

  const Y_TICKS = 4;
  for (let i = 0; i <= Y_TICKS; i += 1) {
    const v = minV + (spanV * i) / Y_TICKS;
    const yPos = y(v);

    const grid = document.createElementNS(svgNS, 'line');
    grid.setAttribute('x1', String(pad.left));
    grid.setAttribute('x2', String(width - pad.right));
    grid.setAttribute('y1', yPos.toFixed(1));
    grid.setAttribute('y2', yPos.toFixed(1));
    grid.setAttribute('class', 'chart-gridline');
    signalChartEl.appendChild(grid);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', String(pad.left - 8));
    label.setAttribute('y', (yPos + 4).toFixed(1));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'chart-axis-label');
    label.textContent = unit ? `${formatNumber(v, decimals)} ${unit}` : formatNumber(v, decimals);
    signalChartEl.appendChild(label);
  }

  const X_TICKS = 3;
  for (let i = 0; i <= X_TICKS; i += 1) {
    const t = minT + (spanT * i) / X_TICKS;
    const xPos = x(t);

    const tick = document.createElementNS(svgNS, 'line');
    tick.setAttribute('x1', xPos.toFixed(1));
    tick.setAttribute('x2', xPos.toFixed(1));
    tick.setAttribute('y1', (height - pad.bottom).toFixed(1));
    tick.setAttribute('y2', (height - pad.bottom + 5).toFixed(1));
    tick.setAttribute('class', 'chart-axis-line');
    signalChartEl.appendChild(tick);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', xPos.toFixed(1));
    label.setAttribute('y', String(height - 8));
    label.setAttribute('text-anchor', i === 0 ? 'start' : i === X_TICKS ? 'end' : 'middle');
    label.setAttribute('class', 'chart-axis-label');
    label.textContent = formatAxisTime(t / 1000, hours);
    signalChartEl.appendChild(label);
  }

  const yAxis = document.createElementNS(svgNS, 'line');
  yAxis.setAttribute('x1', String(pad.left));
  yAxis.setAttribute('x2', String(pad.left));
  yAxis.setAttribute('y1', String(pad.top));
  yAxis.setAttribute('y2', String(height - pad.bottom));
  yAxis.setAttribute('class', 'chart-axis-line');
  signalChartEl.appendChild(yAxis);

  const xAxis = document.createElementNS(svgNS, 'line');
  xAxis.setAttribute('x1', String(pad.left));
  xAxis.setAttribute('x2', String(width - pad.right));
  xAxis.setAttribute('y1', String(height - pad.bottom));
  xAxis.setAttribute('y2', String(height - pad.bottom));
  xAxis.setAttribute('class', 'chart-axis-line');
  signalChartEl.appendChild(xAxis);

  // Data lines drawn last so they sit on top of the gridlines/axes.
  seriesList.forEach((series, i) => {
    if (series.points.length < 2) return;
    const d = series.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'chart-line');
    path.setAttribute('stroke', CHART_COLORS[i % CHART_COLORS.length]);
    signalChartEl.appendChild(path);
  });

  return true;
}

function renderLegend(signal) {
  if (!signal.multi) {
    signalLegendEl.hidden = true;
    signalLegendEl.textContent = '';
    return;
  }
  signalLegendEl.hidden = false;
  signalLegendEl.innerHTML = '';
  signal.seriesLabels.forEach((label, i) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = CHART_COLORS[i % CHART_COLORS.length];
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(label));
    signalLegendEl.appendChild(item);
  });
}

async function loadChartFor(signal) {
  const requestToken = ++chartRequestToken;
  chartAbortController?.abort();
  chartAbortController = new AbortController();
  clearChart();
  renderLegend(signal);
  chartStatusEl.hidden = false;
  chartStatusEl.textContent = 'Loading recent history…';

  const chartFields = signal.chartFields || signal.fields;
  const chartLabel = signal.chartLabel || signal.label;
  chartTitleEl.textContent = `${chartLabel} — last ${formatSpanLabel(signal.chart.hours)}`;

  const end = new Date();
  const start = new Date(end.getTime() - signal.chart.hours * 3600 * 1000);
  const url =
    `${API_BASE}/v1/sites/${SITE}/assets/${ASSET}/data/${signal.chart.family}/range` +
    `?resolution=${signal.chart.resolution}&fields=${chartFields.join(',')}` +
    `&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;

  try {
    const response = await fetch(url, { signal: chartAbortController.signal });
    if (requestToken !== chartRequestToken) return; // Superseded by a newer selection.
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (requestToken !== chartRequestToken) return;

    const timestamps = data.timestamps || [];
    const seriesQuality = data.series_quality || {};
    const seriesList = chartFields.map((field, i) => {
      const raw = data.series?.[field] || [];
      const quality = seriesQuality[field] || [];
      const points = [];
      for (let idx = 0; idx < raw.length; idx += 1) {
        const v = raw[idx];
        const t = timestamps[idx];
        const q = quality[idx];
        if (Number.isFinite(v) && Number.isFinite(t) && (q == null || isGoodQuality(q))) {
          points.push({ t, v });
        }
      }
      return { label: signal.multi ? signal.seriesLabels[i] : chartLabel, points };
    });

    const hasAnyData = seriesList.some((s) => s.points.length >= 2);
    if (!hasAnyData) {
      chartStatusEl.hidden = false;
      chartStatusEl.textContent = 'No recent history available for this signal.';
      return;
    }
    const rendered = renderChart(seriesList, { decimals: signal.decimals, unit: signal.unit, hours: signal.chart.hours });
    chartStatusEl.hidden = rendered;
    if (!rendered) chartStatusEl.textContent = 'Not enough recent history to draw a chart.';
  } catch (error) {
    if (requestToken !== chartRequestToken) return;
    if (error.name === 'AbortError') return;
    console.warn('Could not load signal history:', error);
    chartStatusEl.hidden = false;
    chartStatusEl.textContent = 'Could not load history for this signal — try again shortly.';
  }
}

function onSignalChange() {
  selectedSignalId = signalSelectEl.value;
  const signal = findSignal(selectedSignalId);
  refreshExplorerLiveValue();
  renderLegend(signal);
  loadChartFor(signal);
  signalNoteEl.hidden = !signal.note;
  signalNoteEl.textContent = signal.note || '';
}

explorerToggleEl.addEventListener('click', () => {
  const expanded = explorerToggleEl.getAttribute('aria-expanded') === 'true';
  explorerToggleEl.setAttribute('aria-expanded', String(!expanded));
  explorerPanelEl.hidden = expanded;
  if (!expanded && explorerPanelEl.dataset.loaded !== 'true') {
    explorerPanelEl.dataset.loaded = 'true';
    onSignalChange();
  }
});

signalSelectEl.addEventListener('change', onSignalChange);

populateSignalSelect();
