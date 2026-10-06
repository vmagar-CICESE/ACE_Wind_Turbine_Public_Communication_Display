# Concept 4 — ACE Live Wind: Digital Twin (Extended)

Everything in [Concept 3](../concept-3-live-digital-twin/) — the same
full-screen animated turbine illustration, driven by the same five core live
signals — **plus** an optional "Explore more turbine data" panel that lets a
visitor pick from 17 additional real signals (grid voltage/current, power
factor, blade pitch, air pressure, available-power estimates, daily
availability trend, and more) and see both the current live value and a
small recent-history chart for it.

Concept 3 is left completely untouched; this is a separate, additive
concept so the simpler version stays available for anyone who prefers it.

## Why this exists

The official ACE reference dashboard (linked from the ACE website's "Use the
data or build a dashboard" button) exposes dozens of signals through
site/asset/family/signal/resolution dropdowns. Concept 3's digital twin only
ever showed 5 of those. This concept keeps the calm, glanceable animation as
the default view, but adds a discoverable way to dig into more of the same
live dataset — for a classroom, an engineer, or anyone who wants more than
the headline numbers — without turning the main screen into a dense
dashboard.

## What's in the "Explore more turbine data" panel

The panel is collapsed by default (a single small button, bottom-left) so it
never competes with the animation. Expanding it reveals a dropdown grouped
into four categories, a live value for whatever is selected, and a recent
history chart:

| Group | Signals |
|---|---|
| Wind & weather | Wind speed, wind direction, air pressure |
| Turbine mechanics | Rotor speed, nacelle position (heading), blade (pitch) angle, operating hours |
| Power & electrical | Active power, reactive power, power factor, grid frequency, grid voltage (3-phase), grid current (3-phase) |
| Energy & availability | Lifetime energy exported, daily availability, available power by wind, technically available power |

### Signals deliberately left out

While building this concept, four more wecstd weather fields were checked
against the live feed and found to permanently return a constant sentinel
value even while marked "good" quality — meaning those sensors are not
actually fitted on this turbine:

| Field | Observed value | Apparent meaning |
|---|---|---|
| `precipitation_mean` | constantly `65.535` | 16-bit register overflow/placeholder |
| `visibility_mean` | constantly `6553.5` | same pattern |
| `ambient_brightness_mean` | constantly `65535` | same pattern |
| `air_humidity_mean` | constantly `65535` | same pattern |

Per this project's "honest data only" rule (see the top-level
[solutions README](../README.md)), these are excluded entirely rather than
displayed as if they were real readings. `air_pressure_mean` and
`blade_angle_mean` were checked the same way and do vary realistically, so
they're included. A handful of the most purely diagnostic/engineering-only
fields the official dashboard exposes (raw sampling counts, min/max
variants of every signal, ice-sensor internals, "available power after
force majeure/external setpoints") were also left out as a deliberate
curation choice for a public, non-technical display — see the parent
[solutions README](../README.md) for how this concept compares to the other
three.

## Live ACE data used

| Data | Endpoint | Resolution | Refresh | Notes |
|---|---|---|---|---|
| Core animation fields (power, wind speed, rotor speed, nacelle position, lifetime energy) | `.../data/wec_instantaneous/latest` | 1s | every 1 second | Identical to Concept 3; drives the animation and info panel |
| 13 additional wec_instantaneous fields (wind direction, operating hours, power factor, reactive power, 3-phase voltage/current, frequency, available-power estimates) | same request as above | 1s | every 1 second | Merged into the **same** request/poller as the core fields — adds zero extra requests against the API's rate budget |
| Air pressure, blade angle | `.../data/wecstd/latest` | 10m | every 60 seconds | Separate, slower poller; matches this family/resolution's recommended cadence |
| Daily availability | `.../data/wec_availability/latest` | daily | once at load, then hourly | Same as Concept 3 |
| Turbine configuration | `.../configuration/latest` | — | once at load | Rated capacity for the energy meter |
| Recent history chart | `.../data/{family}/range` | 60s (3h window) or 10m (24h window) or daily (14-day window), depending on the selected signal | once per dropdown selection | Not polled continuously — only fetched when a visitor picks a new signal |

All requests are made directly from the browser to
`https://ace-api.duckdns.org` — no backend/proxy. The page makes at most
**one request per second** overall: the 18-field core poller, the 60-second
wecstd poller, and the one-off chart fetches on selection change are the
only network activity, matching the challenge's rate-limit rule.

## Freshness and offline behaviour

Each signal in the explorer panel shows its own freshness, independent of
the others and of the main scene:

- **Offline** — shown immediately (not waiting on a stale-data timer) if the
  underlying poller for that signal's data family reports a request
  failure, exactly like the main scene's own freshness badge.
- **Stale** — shown if the connection is nominally fine but a specific
  reading hasn't updated within that signal's own expected cadence (15s for
  1-second fields, 20 minutes for 10-minute fields).
- **Daily availability** is never marked stale/offline from its own age —
  by its nature a "daily" figure always describes a recently completed day
  rather than this exact instant, so the panel instead shows "As of
  &lt;date&gt;" for it.
- The chart itself shows its own loading/empty/error state independently of
  the live value above it, and in-flight chart requests are aborted if a
  visitor picks a different signal before the previous one finishes
  loading.

This mirrors Concept 3's own freshness rules (see its README) rather than
inventing a different convention.

## Run it locally

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/concept-4-live-digital-twin-extended/`. As
with the other concepts, serving the parent `solutions` folder matches the
path structure the WeDoWind gallery would use.

## Files

| File | Purpose |
|---|---|
| `index.html` | Scene structure (identical to Concept 3) plus the "Explore more turbine data" panel markup |
| `styles.css` | Concept 3's styling plus the explorer panel's dropdown, value display, inline SVG chart and legend |
| `app.js` | Concept 3's animation/poller logic, extended with the merged 18-field core request, a second wecstd poller, the signal catalogue, and the explorer panel's rendering/chart-fetching logic |
| `ace-live.mjs` | Unmodified copy of the official ACE polling helper (`createAcePoller`) |

## Data source, licence and credit

Live and historical data: **ACE Wind Turbine Data**, Plumley, Charlie;
Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew.
Zenodo. DOI: [10.5281/zenodo.22662372](https://doi.org/10.5281/zenodo.22662372).
Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Live endpoint: `https://ace-api.duckdns.org` (accessed 6 October 2026).

Community context: [Ambition Community Energy (ACE)](https://ambitioncommunityenergy.org/)
and [Ambition Lawrence Weston (ALW)](https://www.ambitionlw.org/) public websites.

This project's own source code is licensed under the [MIT License](LICENSE);
the turbine data itself remains CC BY 4.0.
