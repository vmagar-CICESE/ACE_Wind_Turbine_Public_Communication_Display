# Materials — Challenge 5: ACE Public Communication Display

This folder collects everything pulled from the ACE API and the official
WeDoWind/GitHub challenge resources, so solution ideas can be sketched
without needing to re-browse the web each time. All times/values below were
captured on **4 October 2026** — re-check the live endpoints before building,
since figures (and even available fields) may change.

## Folder contents

| Path | What it is |
|---|---|
| [api-reference/openapi.json](api-reference/openapi.json) | Full OpenAPI 3.1 spec for the ACE API (all endpoints, params, schemas) |
| [api-reference/families-catalogue.json](api-reference/families-catalogue.json) | Raw response of `/v1/families` — every data family, its fields, units, resolutions and recommended refresh intervals |
| [api-reference/key-fields-summary.txt](api-reference/key-fields-summary.txt) | Human-readable extract of the fields most relevant to a public display (power, wind, energy, availability, temperatures, config) |
| [api-samples/](api-samples) | One real sample JSON response per endpoint type (sites, assets, attribution, status, configuration, live readings, status events) |
| [challenge-repo-guides/](challenge-repo-guides) | Local copies of the official GitHub repo's README, CONTRIBUTING, AGENTS, live-data guide, submission template and poller starter code |
| [scripts/](scripts) | Small Python helpers used to generate the summaries above — rerun them if the API's field catalogue changes |

## The essentials, at a glance

- **Live API base URL:** `https://ace-api.duckdns.org`
- **Interactive docs:** https://ace-api.duckdns.org/docs
- **Machine-readable spec:** https://ace-api.duckdns.org/openapi.json
- **Live dashboard (existing, for inspiration):** https://ace-api.duckdns.org/dashboard/
- **Site ID:** `ace` · **Turbine asset ID:** `wec-1` · **Site controller asset ID:** `controller-2`
- **Turbine:** ENERCON EP3-CS02, serial 1160104, **nominal/rated power 4245 kW** (~4.2 MW), active since 29 March 2023
- **Location:** Avonmouth, Bristol (Lawrence Weston community turbine)
- **Licence:** CC BY 4.0 — must credit ACE and cite the Zenodo DOI in any solution
  - Citation: *Plumley, Charlie; Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew. ACE Wind Turbine Data. Zenodo. https://doi.org/10.5281/zenodo.22662372*

## Two endpoints that cover most "live card" use cases

**Instantaneous power & wind speed (poll at most once/second):**
```
https://ace-api.duckdns.org/v1/sites/ace/assets/wec-1/data/wec_instantaneous/latest?resolution=1s&fields=wec_active_power,wec_wind_speed&limit=1
```

**60-second mean power & wind speed (poll once/minute):**
```
https://ace-api.duckdns.org/v1/sites/ace/assets/wec-1/data/wecstd/latest?resolution=60s&fields=active_power_mean,wind_speed_mean&limit=1
```

Response shape uses parallel arrays: `timestamps[0]` + `series.<field>[0]`, with
`series_quality` and `series_observed_at` on the 1s/60s instantaneous families.
Timestamps are **Unix microseconds** (`new Date(timestamp / 1000)`). Treat
`null`/missing as "unavailable", never as zero.

## Fields most useful for a public, non-technical display

From `wec_instantaneous` (1s) and `wecstd` (60s/10m/daily) families:

- `wec_active_power` / `active_power_mean` — **kW**, current output
- `wec_wind_speed` / `wind_speed_mean` — **m/s**, current wind
- `wec_wind_direction` — **deg**
- `wec_rotor_speed` / `rotor_speed_mean` — **rpm**
- `wec_nacelle_position` / `nacelle_position` — **deg** (which way the turbine is facing)
- `wec_energy_exported` (cumulative, kWh) and `energy_produced` (per-interval, kWh) — great for "total clean energy generated" / community-value messaging
- `wec_operating_hours` / `operating_hours` — **h**
- `wec_available_power_by_wind` / `available_power_by_wind_mean` — **kW**, what the turbine *could* produce from the wind available (useful for "performing at X% of potential" framing)

From `site_configuration` / `wec_configuration` (static facts, fetch once):
- `farm_nominal_power` = 4245 kW, `wec_nominal_power` = 4245 kW
- `location_name` = "Avonmouth, Bristol"
- `wec_type` = "EP3-CS02", `wec_availability_start` = 2023-03-29

From `wec_availability` (daily): `availability` (%) — good for a simple "uptime" stat.

From `/v1/status`: a cached health summary (ingestion freshness/gaps per series) —
useful for deciding what "stale" or "unavailable" should mean in a display, and
for testing the offline/degraded state the challenge explicitly asks us to handle.

See [api-reference/key-fields-summary.txt](api-reference/key-fields-summary.txt) for the full list, including turbine component temperatures (`tep3c021`/`tep3c022`), reactive power, voltages/currents, precipitation, visibility, ice detection, etc.

## Rules of the road (from AGENTS.md / the live-data guide)

- **Max 1 request/second per running display**, across all endpoints/widgets — share a single poller, request multiple fields in one call, fetch metadata once at startup.
- Use `limit=1` for "latest value" cards; use `range` endpoints (paginated) only for charts/history.
- Always show a timestamp and a clear **stale/unavailable** state; never silently show zero or an old value as if it were live.
- Honour HTTP 429 `Retry-After`, back off on errors, use request timeouts.
- A ready-made polling helper exists: [challenge-repo-guides/template-ace-live-poller.mjs](challenge-repo-guides/template-ace-live-poller.mjs) (`createAcePoller`), with usage example in [challenge-repo-guides/ace-live-data.md](challenge-repo-guides/ace-live-data.md).

## Submission mechanics

1. Build the display (static site preferred — no backend/API proxy allowed; the browser calls ACE directly).
2. Share source code under an open licence with a README + reproduction steps + ACE/Zenodo credit.
3. Optional but encouraged: add it to the community gallery repo (https://github.com/WeDoWind/WeDoWind-ODE-ACE-Challenge) using [challenge-repo-guides/template-creation.json](challenge-repo-guides/template-creation.json) as the entry schema — see [challenge-repo-guides/CONTRIBUTING.md](challenge-repo-guides/CONTRIBUTING.md) for the exact steps (issue form, GitHub web editor, or PR).
4. **Required official entry:** post a comment with URL, short description and screenshot on the WeDoWind "Solutions" task: https://community.wedowind.ch/posts/open-data-exploration-solutions-107654528
5. Pitch it live on **28 October 2026**; public vote decides the Overall Winner, plus a Judge's Award and a Community Contribution Award.

Two example gallery entries already exist for reference/inspiration — see
[challenge-repo-guides/existing-creations-gallery.json](challenge-repo-guides/existing-creations-gallery.json):
- **"ACE Wind Now"** — a calm card showing instantaneous power + wind speed with a freshness badge and stale/unavailable states.
- **"My first dashboard"** — a bare-bones test submission (issue-3).
