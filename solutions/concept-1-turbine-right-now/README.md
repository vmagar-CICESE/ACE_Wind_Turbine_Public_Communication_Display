# Concept 1 — ACE Turbine: Right Now

A calm, single-screen status card for the community centre. One glance tells
you what the ACE wind turbine in Lawrence Weston is doing **right now**, with
a short set of honest, real facts about the turbine's contribution underneath.

## Story angle

"See what your turbine is doing right now." No charts, no jargon — just a
big number (current power output), an animated turbine whose blades really
spin at the turbine's real rotor speed and whose nacelle points the real
wind direction, and three supporting facts (lifetime clean energy generated,
rated capacity, today's availability). A short, factual sentence explains
*why it matters*: income from the turbine supports Ambition Lawrence
Weston's work tackling poverty in the area, with a link to learn more
(we deliberately do not invent a "homes powered" or £-value conversion —
see [Design notes](#design-notes) below).

## What it looks like

- Full-screen dark sky-blue background (works well in a dim community space).
- Centre-left: an animated SVG turbine — blades spin at a speed derived from
  live rotor RPM, and a small compass under the tower shows which way the
  nacelle is facing.
- Centre-right: the live active power in kW, plus wind speed, rotor speed and
  compass heading.
- Footer: three key facts (lifetime energy exported, rated capacity, today's
  availability), the community-benefit sentence, and full data attribution.
- A badge top-right shows **Live** (green), **Stale** (amber) or **Offline**
  (red), so viewers always know how fresh the display is.

## Live ACE data used

| Data | Endpoint | Refresh | Used for |
|---|---|---|---|
| Instantaneous power, wind speed, rotor speed, nacelle position, lifetime energy exported, operating hours | `GET /v1/sites/ace/assets/wec-1/data/wec_instantaneous/latest?resolution=1s&fields=wec_active_power,wec_wind_speed,wec_rotor_speed,wec_nacelle_position,wec_energy_exported,wec_operating_hours&limit=1` | every 1 second (one shared poller, one request) | hero number, turbine animation, compass, lifetime energy fact |
| Daily turbine availability | `GET /v1/sites/ace/assets/wec-1/data/wec_availability/latest?resolution=daily&fields=availability&limit=1` | once at load, then every hour | "available today" fact |
| Turbine configuration | `GET /v1/sites/ace/assets/wec-1/configuration/latest` | once at load | rated capacity (falls back to the hard-coded 4,245 kW shown in the HTML if the request fails) |

All requests are made **directly from the visitor's browser** to
`https://ace-api.duckdns.org` — there is no backend/proxy server. At most one
request per second is made in total, as required by the ACE API's fair-use
guidance.

### Freshness and offline behaviour

- A reading is considered **stale** once it is more than 15 seconds old
  (the live feed's recommended refresh is 1 second, so 15 seconds already
  indicates a problem upstream).
- If the API request fails (network issue, server error, timeout), the
  display keeps showing the **last known good reading** and switches the
  badge to **Offline**, rather than showing blank or zero values.
- The underlying poller (`ace-live.mjs`, copied unmodified from the official
  WeDoWind challenge template) retries with a timeout and exponential
  back-off, and honours HTTP 429 `Retry-After`.
- The page pauses polling when the browser tab/screen is hidden
  (`visibilitychange`) and resumes when visible again, to avoid wasting
  requests when nobody can see the display.

## A note on an SVG rotation pitfall

The compass needle is rotated via JavaScript (`element.setAttribute('transform',
'rotate(heading, cx, cy)')`). It initially disappeared off-canvas because the
`<g>` also carried an XML `transform-origin="cx cy"` attribute, which
browsers apply *in addition to* the pivot already embedded in `rotate(angle,
cx, cy)`, doubling the offset. The fix was to remove the `transform-origin`
attribute and rely solely on the pivot inside `rotate()`. (The spinning
blades are unaffected — they use a plain CSS `@keyframes` animation, which
*does* need `transform-origin` since CSS `rotate(deg)` has no built-in pivot.)
See [Concept 3's README](../concept-3-live-digital-twin/README.md) for the
full explanation.

## Design notes

Per the challenge organisers' guidance, this display **never invents figures**
(e.g. "powers X homes", "£X raised for the community"). Every number shown is
either a verbatim value from the ACE API or a publicly stated fact from the
ACE/Ambition Lawrence Weston websites, each clearly sourced below. If ACE
later publishes a specific income or community-impact figure, that would be
a good addition to the footer.

## Run it locally

No build step, no dependencies to install. From this folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/` in a browser. (Any static file server
works — Python's is just the simplest for local testing on Windows.)

To preview it the same way it will run under the WeDoWind gallery's GitHub
Pages path, serve the **parent** `solutions` folder instead and browse to
`/concept-1-turbine-right-now/`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure and the inline SVG turbine/compass illustration |
| `styles.css` | All visual styling, including the blade-spin and freshness-badge states |
| `app.js` | Fetches live data, updates the DOM, and drives the turbine animation |
| `ace-live.mjs` | Unmodified copy of the official ACE polling helper (`createAcePoller`) |

## Data source, licence and credit

Live and historical data: **ACE Wind Turbine Data**, Plumley, Charlie;
Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew.
Zenodo. DOI: [10.5281/zenodo.22662372](https://doi.org/10.5281/zenodo.22662372).
Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Live endpoint: `https://ace-api.duckdns.org` (accessed 4 October 2026).

Community context: [Ambition Community Energy (ACE)](https://ambitioncommunityenergy.org/)
and [Ambition Lawrence Weston (ALW)](https://www.ambitionlw.org/) public websites.

This project's own source code is licensed under the [MIT License](LICENSE)
(see `LICENSE`); the turbine data itself remains CC BY 4.0.
