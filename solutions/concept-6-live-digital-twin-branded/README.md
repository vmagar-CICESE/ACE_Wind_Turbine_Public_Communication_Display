# Concept 6 — ACE Live Wind: Digital Twin (Branded)

Everything in [Concept 4](../concept-4-live-digital-twin-extended/) —
unchanged: the same full-screen animated turbine, the same live info panel,
and the same optional "Explore more turbine data" panel with 17 additional
signals — **plus** two additions requested after reviewing the official ACE
reference dashboard:

1. **A centred "ACE Wind Turbine" title**, so the screen reads clearly as
   the turbine's own display from a distance.
2. **A credits/links box**, bottom-right, carrying the same text and three
   links shown on the official ACE dashboard's own header card ("Visit the
   ACE website", "Dataset and citation", "Use the data or build a
   dashboard"), restyled to match this concept's dark, full-screen theme.

Concept 4 is left completely untouched; this is a separate, additive
concept.

## The credits box

Adapted from the official ACE dashboard's own header card (community-owned
renewable energy label, "Data shared by Ambition Community Energy (ACE)"
title, a one-line description of the turbine, and the same three outbound
links), but restyled as a small dark, rounded card with pill-shaped link
buttons rather than the dashboard's own light desktop-card styling, to fit
this concept's full-screen dark aesthetic. It replaces Concept 4's smaller,
plain-text `credit-corner` footer in the same position, carrying the same
required ACE/CC BY 4.0 attribution plus the extra links.

| Link | Destination |
|---|---|
| Visit the ACE website | `https://ambitioncommunityenergy.org/` |
| Dataset and citation | `https://doi.org/10.5281/zenodo.22662372` |
| Use the data or build a dashboard | `https://ace-api.duckdns.org/dashboard/` (the official reference dashboard) |

### Checked for overlap, not just by eye

The credits box sits in the same bottom-right corner as the energy meter's
lower portion, so — as with Concept 5's layout changes — the exact
vertical space available was checked rather than assumed. A hidden clone of
the real credits box was rendered at its true computed width, and its
actual unclipped height measured by the browser's own layout engine, then
compared against the energy meter's own computed position at both 1280×720
and 1920×1080. The content was kept compact (one-line description, links
flowing horizontally as wrapped pills rather than stacked full-width
buttons) specifically so it clears the meter with margin at both sizes —
roughly **27px at 720p and 171px at 1080p**.

## What's in the "Explore more turbine data" panel

Unchanged from Concept 4 — the panel is collapsed by default (a single
small button, bottom-left) so it never competes with the animation.
Expanding it reveals a dropdown grouped into four categories, a live value
for whatever is selected, and a recent history chart:

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

## Run it locally

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/concept-6-live-digital-twin-branded/`. As
with the other concepts, serving the parent `solutions` folder matches the
path structure the WeDoWind gallery would use.

## Files

| File | Purpose |
|---|---|
| `index.html` | Concept 4's scene and explorer markup, plus the title heading and the credits box |
| `styles.css` | Concept 4's styling, plus `.scene-title` and the `.credits-*` family of rules |
| `app.js` | Unchanged from Concept 4 |
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
