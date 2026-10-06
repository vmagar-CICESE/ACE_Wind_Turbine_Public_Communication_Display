# Concept 5 — ACE Live Wind: Digital Twin (Plus)

Everything in [Concept 4](../concept-4-live-digital-twin-extended/) — the
same animated turbine illustration, live info panel and "Explore more
turbine data" signal/chart panel — refined after a closer look at the
official ACE reference dashboard and a first round of feedback:

1. **The turbine moved right** and the text panels on the left were made
   noticeably bigger, so the readout is easier to read from across a room.
2. **History charts now plot the same "mean" signals the official dashboard
   plots** (e.g. `active_power_mean`, not a raw instantaneous sample), so a
   chart here and the same chart on ACE's own dashboard tell the same story.
3. **Charts now have real, clearly labelled axes** — gridlines, an actual
   time axis (real clock times/dates) and an actual value axis (real
   numbers with units) — rather than just two corner numbers, closer to how
   [ambitioncommunityenergy.org](https://ambitioncommunityenergy.org/)'s own
   dashboard presents its charts.

Concept 4 is left completely untouched; this is a separate, additive
concept.

## What changed from Concept 4, and why

### 1. Turbine position and text size

The turbine's pivot moved from the centre of the scene (x=800 of 1600) to
x=1000 — clearly right-of-centre — freeing up consistent space on the left
for the overlay text. With that space available, font sizes across the
freshness badge, wind/heading readout, info panel and the explorer panel
were all increased (roughly 15–25%, via the same `clamp()` responsive
sizing already used elsewhere) so the numbers that matter are legible from
typical community-centre viewing distances, not just up close.

### 2. Charting the same "mean" signals as the official dashboard

While comparing this concept's "Active power" chart against the official
ACE dashboard's "Mean active power" chart, the two did not visually match.
The reason: Concept 4's chart queried `wec_active_power` from the
`wec_instantaneous` family — genuine single-instant samples, taken once per
minute for the chart — while the official dashboard plots `active_power_mean`
from the `wecstd` family, a true pre-averaged mean computed by the turbine's
own controller. These are different signals that can look meaningfully
different, especially when the wind is variable.

Four signals now point their *chart* (not their live "right now" value,
which still comes from the fast instantaneous feed) at the matching wecstd
mean field instead:

| Signal | Live value source | Chart source |
|---|---|---|
| Wind speed | `wec_wind_speed` (instantaneous) | `wind_speed_mean` (wecstd) |
| Rotor speed | `wec_rotor_speed` (instantaneous) | `rotor_speed_mean` (wecstd) |
| Active power | `wec_active_power` (instantaneous) | `active_power_mean` (wecstd) |
| Reactive power | `wec_reactive_power` (instantaneous) | `reactive_power_mean` (wecstd) |

The chart title now says explicitly what it's showing (e.g. "Mean active
power — last 3 hours") so this distinction is visible, not hidden. All other
signals (ones without a wecstd mean counterpart — wind direction, power
factor, voltages/currents, etc.) are unaffected and keep charting the
instantaneous feed, as before.

### 3. Clearly labelled, gridded chart axes

Each chart now draws:

- **4 horizontal gridlines with real value labels** (including the unit,
  e.g. "-24 kW"), spanning the data's actual min/max for that signal.
- **4 vertical tick labels with real clock times** (`HH:MM`, Europe/London)
  for short windows, or real calendar dates (`D Mon`) for the 14-day daily
  availability window.
- **A visible axis title line below the chart** stating exactly what's
  plotted and over what period (e.g. "Daily availability — last 14 days").

A signal that happens to be perfectly flat for its whole window (e.g. 100%
availability for two weeks) gets a small, symmetric fallback range around
that value rather than an axis that looks like it's trending upward from a
single reading — this was checked directly against live data during
development.

## Addressing the challenge's own judging criteria

| Criterion | How this concept addresses it |
|---|---|
| **Public accessibility** | The default view needs no interaction at all — a calm animated turbine, a plain-English wind/heading sentence, and three community-relevant numbers, all now sized for across-the-room reading. Nothing requires wind-energy background knowledge. The optional explorer panel is opt-in and clearly labelled, so it adds depth without being required reading. |
| **Effective use of live data** | Every moving part (blade speed, energy meter, wind streaks) and every number on screen is driven by the real ACE API, polled within the challenge's rate limits. The 17 additional explorer signals use genuinely different, verified-real sensors (several apparently-broken "weather" fields were checked against live data and deliberately excluded rather than shown as fake readings), and history charts now use the same statistically meaningful "mean" signals the official ACE dashboard itself uses, so numbers shown here are directly comparable to ACE's own public dashboard. |
| **Community relevance** | The info panel keeps Concept 3/4's lifetime-energy-generated figure, today's availability, and the one-sentence Ambition Lawrence Weston mission statement front and centre — the turbine is framed as *this community's* turbine, not just a generic data source. |
| **Creativity and engagement** | The turbine is a living illustration, not a table of numbers — blades really spin at the live rotor speed, the sky shifts through the day, and wind streaks speed up and slow down with real wind speed. The explorer panel turns "one more stat" into a small discovery moment (pick a signal, watch its own chart draw) rather than a wall of simultaneous numbers. |
| **Practicality and robustness** | No backend, no build step, no API key — a static page anyone can host (this one is on GitHub Pages). The whole page makes at most one request per second, with graceful, clearly-labelled offline/stale states verified by deliberately blocking the API during development (both for the main scene and, independently, for whichever signal is selected in the explorer). It is designed to run unattended on a screen for long periods: polling pauses when the tab/screen is hidden and resumes automatically, and a connection drop never leaves stale data silently mislabelled as live. |

## What's in the "Explore more turbine data" panel

Unchanged from Concept 4 — the panel is collapsed by default (a single small
button, bottom-left) so it never competes with the animation. Expanding it
reveals a dropdown grouped into four categories, a live value for whatever
is selected, and a recent history chart:

| Group | Signals |
|---|---|
| Wind & weather | Wind speed, wind direction, air pressure |
| Turbine mechanics | Rotor speed, nacelle position (heading), blade (pitch) angle, operating hours |
| Power & electrical | Active power, reactive power, power factor, grid frequency, grid voltage (3-phase), grid current (3-phase) |
| Energy & availability | Lifetime energy exported, daily availability, available power by wind, technically available power |

### Signals deliberately left out

Four wecstd weather fields were checked against the live feed and found to
permanently return a constant sentinel value even while marked "good"
quality — meaning those sensors are not actually fitted on this turbine:

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
[solutions README](../README.md) for how this concept compares to the
others.

## Live ACE data used

| Data | Endpoint | Resolution | Refresh | Notes |
|---|---|---|---|---|
| Core animation fields (power, wind speed, rotor speed, nacelle position, lifetime energy) | `.../data/wec_instantaneous/latest` | 1s | every 1 second | Drives the animation and info panel |
| 13 additional wec_instantaneous fields (wind direction, operating hours, power factor, reactive power, 3-phase voltage/current, frequency, available-power estimates) | same request as above | 1s | every 1 second | Merged into the **same** request/poller as the core fields — adds zero extra requests against the API's rate budget |
| Air pressure, blade angle | `.../data/wecstd/latest` | 10m | every 60 seconds | Separate, slower poller; matches this family/resolution's recommended cadence |
| Daily availability | `.../data/wec_availability/latest` | daily | once at load, then hourly | |
| Turbine configuration | `.../configuration/latest` | — | once at load | Rated capacity for the energy meter |
| Recent history chart | `.../data/{family}/range` | 60s (3h window, instantaneous or wecstd mean fields) or 10m (24h window, wecstd) or daily (14-day window) | once per dropdown selection | Not polled continuously — only fetched when a visitor picks a new signal |

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

## Run it locally

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/concept-5-live-digital-twin-plus/`. As with
the other concepts, serving the parent `solutions` folder matches the path
structure the WeDoWind gallery would use.

## Files

| File | Purpose |
|---|---|
| `index.html` | Scene structure (turbine re-positioned right) plus the "Explore more turbine data" panel, including the chart title element |
| `styles.css` | Enlarged text sizing throughout the overlay/explorer panel, plus gridline/axis styling for the chart |
| `app.js` | Animation/poller logic; the signal catalogue now distinguishes each signal's live-value fields from its (optionally different, "mean") chart fields; the chart renderer draws labelled axes and gridlines instead of two corner numbers |
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
