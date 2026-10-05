# Concept 3 — ACE Live Wind: Digital Twin

A full-screen, ambient animated illustration — a "digital twin" of the ACE
turbine overlooking a simplified Lawrence Weston — where every moving part is
driven by real, live data rather than decoration. This is the most visual/
data-artwork-style concept of the three, aimed at being glanceable, calming
and a little bit magical, especially for children and casual passers-by.

## Story angle

Instead of reading numbers, you **watch the turbine work**:

- The blades really spin — their speed is calculated from the live rotor RPM.
- A vertical glowing meter fills up in proportion to real power output (out
  of the turbine's rated 4,245 kW capacity).
- Faint streaks drift across the sky — more and faster when it's windier.
- Small houses sit either side of the turbine, a simple nod to the Lawrence
  Weston community the turbine was built for.
- The sky's colour shifts gently through the day (dawn/day/dusk/night) —
  this part is purely cosmetic, based on the visitor's own clock, not ACE
  data, and is disclosed as such below.

Numeric detail is kept close to a necessary minimum so the animation itself
does the storytelling — but a small, secondary **info panel** (top-left,
stacked below the freshness badge and readout) adds the community-value
context that Concept 1 has and this concept initially lacked: lifetime
energy generated, today's availability, and the same Ambition Lawrence
Weston mission sentence used elsewhere. It's deliberately compact and
secondary to the animation, not a second dashboard.

## Live ACE data used

| Data | Endpoint | Refresh | Drives |
|---|---|---|---|
| Instantaneous power, wind speed, rotor speed, nacelle position, lifetime energy exported | `GET /v1/sites/ace/assets/wec-1/data/wec_instantaneous/latest?resolution=1s&fields=wec_active_power,wec_wind_speed,wec_rotor_speed,wec_nacelle_position,wec_energy_exported&limit=1` | every 1 second (one shared poller) | blade spin speed, energy meter fill, wind-streak speed/density, wind/heading readout, info panel's lifetime energy stat |
| Daily turbine availability | `GET /v1/sites/ace/assets/wec-1/data/wec_availability/latest?resolution=daily&fields=availability&limit=1` | once at load, then every hour | info panel's "available today" stat |
| Turbine configuration | `GET /v1/sites/ace/assets/wec-1/configuration/latest` | once at load | rated capacity used to scale the energy meter (falls back to 4,245 kW if the request fails) |

All requests are made directly from the browser to
`https://ace-api.duckdns.org` — no backend/proxy. At most one request per
second across the whole page.

### What's real data vs. decoration

| Element | Driven by |
|---|---|
| Blade rotation speed | **Real** — `wec_rotor_speed` (rpm), via `requestAnimationFrame` |
| Energy meter fill | **Real** — `wec_active_power` ÷ rated capacity |
| Wind streak speed/density | **Real** — `wec_wind_speed` |
| Wind/heading text readout | **Real** — `wec_wind_speed`, `wec_nacelle_position` |
| Info panel: lifetime energy, availability | **Real** — `wec_energy_exported`, daily `availability` |
| Info panel: mission sentence | Static text, paraphrased from the public ACE/ALW websites (not an invented figure) |
| Turbine does **not** physically yaw in this view | By design — a flat side-view illustration can't meaningfully show a compass heading as a 3D yaw, so the heading is shown as text instead of a misleading rotation |
| Sky colour (dawn/day/dusk/night) | **Decorative only** — the visitor's local clock, not ACE data |
| Houses, hill | Decorative illustration representing Lawrence Weston |

### Freshness and offline behaviour

- A reading is **stale** after 15 seconds without an update.
- If the API fails, the scene **desaturates**, the blades freeze in place,
  the freshness badge turns red ("Offline — showing last known reading"),
  and a short on-screen message explains what's happening — verified by
  deliberately blocking the API during testing (see screenshots/README
  history for details).
- Polling pauses when the tab/screen is hidden and resumes when visible.

## Run it locally

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/`. To preview it under the same relative
path the WeDoWind gallery would use, serve the parent `solutions` folder and
browse to `/concept-3-live-digital-twin/`.

## A note on an SVG rotation pitfall (for anyone reusing this code)

The turbine blades are rotated using JavaScript (`requestAnimationFrame`)
calling `element.setAttribute('transform', 'rotate(angle, cx, cy)')` directly,
**not** a CSS `@keyframes` animation. Early in development the blades
disappeared entirely because the `<g>` element also carried an XML
`transform-origin="cx cy"` attribute — browsers apply that CSS-level origin
*in addition to* the pivot already embedded in the SVG `rotate(angle, cx, cy)`
function, doubling the effective offset and rotating the blades off-canvas.
If you copy this pattern, only set the pivot in **one** place: either the
`rotate(angle, cx, cy)` SVG transform function, or a CSS `transform-origin`
paired with a CSS `rotate(angle)` — never both.

## Layout note: why the overlay is one flex column, not several

The freshness badge, wind/heading readout, and the info panel all live
inside a single flex-column container (`.overlay`) anchored top-left, rather
than being positioned independently (e.g. one top-left, one bottom-left).
Stacking them in normal document flow guarantees they can never visually
overlap, regardless of how tall or short the screen is. As a safety net for
unusually short screens, the container also scrolls (`overflow-y: auto`)
instead of letting content spill over other elements. On any realistic
community-centre display (1280×720 and up) there is ample room and this
never triggers — verified directly via `getBoundingClientRect()` at
1920×1080, where the whole overlay used well under a third of its available
height.

## Files

| File | Purpose |
|---|---|
| `index.html` | Scene structure: sky, wind-streak layer, SVG landscape/turbine, energy meter, text overlay |
| `styles.css` | Visual styling, offline desaturation, streak animation |
| `app.js` | Live data fetching, `requestAnimationFrame`-driven blade rotation, wind-streak and sky updates |
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
