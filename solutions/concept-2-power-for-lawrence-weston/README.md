# Concept 2 — Power for Lawrence Weston

A slow-cycling, four-slide story designed to run **unattended** on a community
centre screen — a gentle loop rather than a single static card, so anyone who
glances at the screen for 10–40 seconds sees the full picture: what the
turbine is doing now, the energy it has generated, how reliably it runs, and
why it exists.

## Story angle

Where [Concept 1](../concept-1-turbine-right-now/) is a calm "right now" card,
this concept leans into **community relevance and storytelling**: it slowly
cycles through four short "scenes", each built around one honest, real
number, so the turbine's value to Lawrence Weston builds up over the full
cycle instead of being crammed onto one screen.

1. **Live right now** — current power output and wind speed.
2. **The energy story** — lifetime clean energy generated (kWh) and why that
   matters (income funds Ambition Lawrence Weston's community work).
3. **Working hard for the community** — today's availability % and how long
   the turbine has been running, framing reliability as a community asset.
4. **About this turbine** — a short explanation of ACE/ALW and full data
   credit.

Slides auto-advance every 12 seconds. Clicking/tapping a dot jumps straight
to a slide and pauses auto-advance for 20 seconds before it resumes — useful
if someone wants to linger on one slide, while still returning to unattended
looping for the rest of the day.

## Why no "homes powered" or £ figures

The challenge guidance explicitly warns against inventing community-impact
figures. ACE/ALW have not published a specific £ income or "X homes powered"
conversion, so this concept **only uses values the API actually returns**
(power, energy, availability, operating hours) plus ACE/ALW's own published
mission statement — never an invented multiplier.

## Live ACE data used

| Data | Endpoint | Refresh | Used on |
|---|---|---|---|
| Instantaneous power, wind speed, nacelle position, lifetime energy exported, operating hours | `GET /v1/sites/ace/assets/wec-1/data/wec_instantaneous/latest?resolution=1s&fields=wec_active_power,wec_wind_speed,wec_nacelle_position,wec_energy_exported,wec_operating_hours&limit=1` | every 1 second (one shared poller) | Slide 1 (power, wind), Slide 2 (lifetime energy), Slide 3 (operating years) |
| Daily turbine availability | `GET /v1/sites/ace/assets/wec-1/data/wec_availability/latest?resolution=daily&fields=availability&limit=1` | once at load, then hourly | Slide 3 |
| Turbine configuration | `GET /v1/sites/ace/assets/wec-1/configuration/latest` | once at load | Slide 2 rated-capacity fact (falls back to the hard-coded value in the HTML if the request fails) |

All requests are made directly from the browser to `https://ace-api.duckdns.org`
— no backend/proxy. At most one request per second across the whole page.

### Freshness and offline behaviour

Same approach as Concept 1: a shared **Live / Stale / Offline** badge (top
right, visible on every slide), a 15-second staleness threshold for the 1 Hz
feed, retained last-known values if the API fails, exponential back-off with
`Retry-After` support (via the unmodified `ace-live.mjs` poller), and polling
pauses when the tab/screen is hidden.

## Run it locally

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/`. To preview it under the same relative
path the WeDoWind gallery would use, serve the parent `solutions` folder and
browse to `/concept-2-power-for-lawrence-weston/`.

## Files

| File | Purpose |
|---|---|
| `index.html` | The four slides and navigation dots |
| `styles.css` | Slide fade transitions, typography, freshness badge states |
| `app.js` | Live data fetching, slide auto-advance/manual navigation logic |
| `ace-live.mjs` | Unmodified copy of the official ACE polling helper (`createAcePoller`) |

## Data source, licence and credit

Live and historical data: **ACE Wind Turbine Data**, Plumley, Charlie;
Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew.
Zenodo. DOI: [10.5281/zenodo.22662372](https://doi.org/10.5281/zenodo.22662372).
Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Live endpoint: `https://ace-api.duckdns.org` (accessed 4 October 2026).

Community context: [Ambition Community Energy (ACE)](https://ambitioncommunityenergy.org/)
and [Ambition Lawrence Weston (ALW)](https://www.ambitionlw.org/) public websites.

This project's own source code is licensed under the [MIT License](LICENSE);
the turbine data itself remains CC BY 4.0.
