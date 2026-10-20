# Concept 9 — ACE Live Wind: Digital Twin, Community Stories, Status Explainer & Grid Connection

Everything in [Concept 8](../concept-8-status-explainer/) — unchanged: the
full-screen animated turbine, the live info panel, the 17-signal explorer,
the Story & Impact Dock, the "What's it doing right now?" status explainer,
the "last hour" energy overlay, and the official ACE credits box — **plus**
a decorative **local substation and grid cables**, drawn between the turbine
and the houses, so the "⚡ The Grid" story ("power feeds into the 33,000-volt
local grid, powering nearby homes, schools and shops first") is visible in
the illustration, not only described in a pop-up.

Concept 8 remains completely untouched; this is a separate, experimental fork
— exactly so the substation idea can be tried and judged on its own merits
without risking the (already-reviewed) concept-8 build. If it doesn't earn
its place, concept-8 is simply used as-is and this folder can be dropped.

## Why a substation?

Several of this concept family's existing "Story Dock" topics already *talk*
about the turbine's connection to the wider world (the grid, the homes it
powers, the community income it generates) — but the illustration itself
only ever showed the turbine and a row of houses, with nothing in between.
A small lattice pylon, transformer yard and two power cables (turbine →
substation → houses) make that connection visible at a glance, reinforcing
the existing "⚡ The Grid" story rather than replacing it.

**Deliberately decorative, not data-driven** — like the hill and houses it
sits alongside, the substation and cables are static illustration, not wired
up to any live signal (there is no API field for "grid connection status" to
honestly visualise here). It exists purely to make an already-true, already-
told story ("your electricity goes out the turbine and onto the local grid")
visually concrete, the same way the houses make "ACE's own stated impact: ~3,000 homes"
visually concrete without claiming to show those specific homes.

## Everything else, inherited unchanged from Concept 8

## Why a status explainer?

The single most common question a passer-by asks about a wind turbine is
*"why isn't it moving?"* — usually on a calm day, or occasionally in very
strong wind. Without an explanation, a stationary turbine can look broken
even when it's working exactly as designed. The status explainer turns that
moment of confusion into a short, honest, plain-English teaching moment,
using live signals the rest of this concept already trusts and displays.

Collapsed by default (so it doesn't compete with the Story Dock above it),
it shows a one-line headline with a coloured icon; tapping it expands a short
explanation.

## How the explanation is generated — and what it deliberately avoids

ACE's API exposes a turbine status-event feed (`main_status`, `substatus`,
`fault_message_flag`, `warning_message_flag`, `service_flag`), but **ACE does
not publish a decoder for what each numeric code means** (confirmed via
`/v1/event-families`, which lists only field names, no meanings). Inventing a
mapping from these undocumented codes to specific claims (e.g. "code 3 means
a gearbox fault") would be fabricating facts the API doesn't actually provide
— something the challenge's own contributor guidance explicitly warns
against.

Instead, the plain-English headline is generated entirely from three signals
that are already live-polled every second for the rest of this concept (no
extra request needed): **wind speed**, **rotor speed**, and **power output**.

| Headline | Condition | Icon |
|---|---|---|
| Generating electricity | Rotor turning (≥ 1 rpm) and producing power | 🌀 |
| Resting — not enough wind | Not turning; wind below ~3.5 m/s | 🍃 |
| Paused — strong-wind safety stop | Not turning; wind above ~20 m/s | ⚠️ |
| Not generating right now | Not turning; wind in between | ⏸️ |

The ~3.5 m/s and ~20 m/s thresholds are general wind-industry ballpark
figures used only to choose a sensible explanation, **not** an assertion
about this specific turbine's certified cut-in/cut-out specification — that
exact figure isn't published anywhere in ACE's API or public materials that
could be verified for this build.

A second, collapsed-by-default **"Turbine specs"** sub-panel shows a short
spec sheet — model, serial number, rated power, commissioning date, and
location — pulled directly from the turbine's own configuration record on
the ACE API, not estimated or looked up elsewhere. This replaced an earlier
version of this panel that showed the raw, undocumented status/fault codes
instead; those codes turned out to add little value for a public audience
since they can't be meaningfully interpreted without an official decoder (see
git history for that earlier iteration if useful as reference).

The specs panel also adds four **manufacturer-verified reference figures**
(rotor diameter, swept area, hub height, tip height) below the live API
fields, visually separated and sourced from Enercon's own E-115 data sheet
and Wikipedia's citation-backed technical write-up for this specific
turbine, rather than the live API. This also corrects an earlier mistaken
guess at the model (E-126/EP3) — the installed turbine is an **Enercon
E-115 EP3**: a 115.7m rotor on a 92m hub, reaching the 150m tip height ACE
itself advertises (150m is tip height, not hub height — Enercon's own E-115
data sheet lists 149m as a separate, taller hub-height option for a
different, lower-wind-class variant, not the one installed here).

## The tower now shows two things: instantaneous power *and* the last hour

The tower's live fill is an **instantaneous power gauge**: full height =
4,245 kW rated capacity, current height = `wec_active_power ÷ 4,245 kW`. That
is genuinely a kW-scaled, fast-moving reading, and deliberately stays that
way — it is what lets the tower feel "live".

But a single instantaneous kW reading taken on a gusty day can look wildly
unrepresentative of what the turbine is actually delivering. So a second,
amber, dashed marker line is now drawn on the tower showing **the average
output over the last hour**, and a floating card beside the tower spells out
the exact kWh. Both share the tower's own 0–4,245 kW scale without changing
its meaning, because of one bit of unit arithmetic: kWh generated over
exactly one hour is numerically identical to an *average* kW over that hour
(`kWh ÷ 1h = kW`). So the last hour's kWh is converted back into an implied
average kW and plotted on the same axis as the live fill — the dashed line
stays visible even when the live (brighter) fill currently covers that height,
so you can always compare "right now" against "the last hour" in one glance.

**The last-hour kWh itself is exact, not estimated.** `wec_energy_exported`
is a cumulative lifetime meter (confirmed live against the API: it only ever
rises), so `(reading now) − (reading ~60 minutes ago)` is the turbine's own
metered output for that hour — fetched once a minute via the documented
`.../data/wec_instantaneous/range` endpoint, not approximated from average
instantaneous power.

### Making an abstract kWh figure relatable

Beside the kWh figure, a small ticker cycles through a few everyday
equivalents computed from that same exact last-hour kWh: UK homes' typical
hourly electricity use, kettle boils, hours of PlayStation gameplay, phone
charges, and LED-bulb hours. These conversion factors are well-established
public reference figures (Ofgem's Typical Domestic Consumption Value for
homes; Energy Saving Trust/manufacturer-typical draws for the appliances) —
**not** specific to this turbine or independently re-verified for this
project, used only to make the number relatable, consistent with this
concept's policy of not inventing unverifiable turbine-specific facts (see
`APPLIANCE_EQUIVALENTS` in `app.js` for the exact factors and sources).

### Why there's no £ income figure

ACE sells its output to OVO Energy under what is almost certainly a
commercial, confidential power purchase agreement — the actual sale price
isn't published anywhere in ACE's API or public materials, so turning the
last hour's kWh into a real £ income figure isn't possible without
fabricating a number. Instead, the ticker's final item is **CO₂ avoided**:
last-hour kWh × the GB grid's live carbon intensity (gCO₂/kWh), fetched from
National Grid ESO's free, public [Carbon Intensity
API](https://carbonintensity.org.uk/). This ties directly into ACE's own
published claim of saving "87,600 tonnes of CO2 over its lifetime", using a
real, live, independently-verifiable public data source rather than a guessed
retail or wholesale electricity price.

### Live ACE data used (new in this concept)

| Data | Endpoint | Refresh | Used for |
|---|---|---|---|
| Wind speed, rotor speed, power | Already-polled `.../data/wec_instantaneous/latest` (no new request) | every 1 second | plain-English headline and explanation |
| Turbine model, serial number, rated power, commissioning date | `.../configuration/latest` (shared with the cache already used to scale the power meter — no duplicate request) | once, when "Turbine specs" is first opened | specs sub-panel |
| Site location name | `.../sites/ace/configuration/latest` | once, when "Turbine specs" is first opened | specs sub-panel |
| Lifetime exported energy, ~60 minutes ago | `.../data/wec_instantaneous/range?resolution=60s&fields=wec_energy_exported` (a single historical point) | every 60 seconds | exact last-hour kWh delta, tower marker, equivalences |
| GB grid carbon intensity | `api.carbonintensity.org.uk/intensity` (National Grid ESO, not an ACE endpoint) | every 5 minutes | CO₂-avoided ticker item |

Both configuration endpoints are static metadata that essentially never
changes, so they're fetched once, lazily, only the first time a visitor
actually opens the specs panel — not on every refresh and not for visitors
who never open it.

### Offline behaviour

If the live feed goes down, the headline keeps showing the last known state
(consistent with how the rest of this concept behaves) and the panel's
border switches to the same red "offline" colour used elsewhere, rather than
guessing or resetting to a blank state. Verified by deliberately blocking the
ACE API during testing.

## A layout note: one flex column, not three separately-positioned boxes

Adding a third right-hand panel was a good opportunity to fix a latent
fragility: in Concept 7, the Story Dock and credits box were each
independently `position: absolute` with hard-coded `top`/`bottom` values. That
works until any one box's content changes height — at which point two
independently-positioned boxes can silently start overlapping. In this
concept, the Story Dock, status explainer, and credits box are instead all
children of one `.right-rail` flex column (`display: flex; flex-direction:
column; gap: ...`), anchored top-to-bottom. Flow layout means they can never
overlap regardless of how long any one panel's content is, with
`overflow-y: auto` as a safety net on unrealistically short screens. Verified
directly via `getBoundingClientRect()` at 1920×1080 with both the Story
Dock's second topic and the full status explainer (including the raw log)
expanded at once — no overlap, no scrollbar needed.

## The 5 Community Pop-up Topics

### 1. 💡 Why is Clean Energy Important? (Global Health & SDGs)
- **Primary link:** [World Health Organization (WHO) — Energy and Health](https://www.who.int/health-topics/energy-and-health#tab=tab_1)
- **Key SDGs:** SDG 7 (Affordable & Clean Energy), SDG 3 (Good Health & Well-being), SDG 1 (No Poverty), SDG 13 (Climate Action)
- **Core message:** Clean energy is not just about kilowatt-hours or utility bills — it is fundamental healthcare.
- **Featured WHO quotation:**
  > "Energy and health are inextricably linked. Access to clean, sustainable and affordable energy, outlined in the seventh Sustainable Development Goal (SDG 7), plays a crucial role in advancing health (SDG 3). Energy is also critical for achieving almost all other global goals that include eradication of poverty (SDG 1), opportunities for quality education (SDG 4), achievement of gender equality (SDG 5), access to clean water (SDG 6), jobs security and economic growth (SDG 8) and combat of climate change (SDG 13).
  >
  > The links between energy and health are particularly evident in homes and health-care facilities. Access to clean and sustainable energy in homes is essential to protect people’s health from household air pollution due to the use of polluting stoves and fuels such as coal and biomass. Access to clean and reliable energy in health-care facilities is important to ensure the delivery of essential health care services for disease prevention and treatment."
- **Local connection:** Connecting the WHO's global insight to Bristol: zero outdoor air pollution from wind generation, warm-home funding via ALW to fight fuel poverty, and dependable power for community health.

### 2. 🏘️ How Does This Help Lawrence Weston? (Community Wealth)
- **Primary link:** [Ambition Lawrence Weston (ALW)](https://www.ambitionlw.org/)
- **Key SDGs:** SDG 1 (No Poverty), SDG 8 (Decent Work & Economic Growth), SDG 11 (Sustainable Communities)
- **Core message:** 100% community-owned — unlike corporate wind farms where profits leave the area, every penny of surplus revenue is reinvested in BS11 to fund emergency fuel support, home insulation grants, youth programmes, and community regeneration.

### 3. 🌬️ How Big Is Our Wind Turbine? (Local Pride & Engineering)
- **Primary link:** [Ambition Community Energy (ACE) — The Turbine](https://ambitioncommunityenergy.org/the-turbine/)
- **Key SDGs:** SDG 7 (Clean Energy), SDG 9 (Industry, Innovation & Infrastructure)
- **Core message:** Standing 150 metres tall to blade tip, the ACE turbine is the tallest onshore wind turbine in England — taller than Bristol Cathedral (65m) and the London Eye (135m). Its 115m rotor diameter sweeps an area wider than a football pitch, generating over 10 million kWh per year.

### 4. ⚡ Where Does the Electricity Actually Go? (The Grid)
- **Primary link:** [Official Live ACE Dashboard](https://ace-api.duckdns.org/dashboard/)
- **Key SDGs:** SDG 7 (Clean Energy), SDG 11 (Sustainable Cities), SDG 12 (Responsible Consumption)
- **Core message:** Tracing the journey of a breeze: mechanical rotation in the nacelle converts to high-voltage electricity, travels down heavy insulated cables inside the 100m steel tower, passes through an on-site transformer, and feeds directly into the local 33kV Western Power Distribution (National Grid) network, powering nearby homes and schools first.

### 5. 🫁 Clean Air and Warm Homes in Bristol (Health & Environment)
- **Primary link:** [ALW Warmth & Energy Advice](https://www.ambitionlw.org/services/energy-advice/)
- **Key SDGs:** SDG 3 (Good Health & Well-being), SDG 7 (Clean Energy), SDG 13 (Climate Action)
- **Core message:** Displacing coal and gas generation prevents toxic nitrogen oxides ($NO_x$) and fine particulate matter ($PM_{2.5}$) from entering local air, while ALW energy advisers help residents solve dampness, insulate drafty homes, and keep heating affordable in winter.

## Right-hand Side Layout Architecture

The display is architected with a balanced, symmetric layout:
- **Turbine Tower as Live Power Gauge:** Rather than an auxiliary vertical bar, the wind turbine tower itself serves as the active generation power gauge, rising from the base to 4,245 kW rated capacity in brand green (`#3ddc84`), with the live numeric kW reading cleanly badged directly beneath the tower foot.
- **Left-hand Overlay:** Anchored to `left: clamp(1rem, 3vw, 2rem)` and `top: clamp(3rem, 6.5vh, 5rem)`, displaying live connection status, wind speed/direction, and cumulative energy.
- **Right-hand rail:** A single flex column anchored to `right: clamp(1rem, 3vw, 2rem)`, spanning from `top: clamp(5.2rem, 10vh, 7rem)` to `bottom: clamp(1.5rem, 3.5vh, 2.75rem)`, containing — in order — the Story Dock, the status explainer, and the credits box. See "A layout note" above for why this is one flex column rather than three independently-positioned boxes.
- **Story modal:** Center-stage overlay with dark frosted backdrop (`backdrop-filter: blur(8px)`), accessible close button (`✕`), keyboard navigation (`Escape`, `Tab`), previous/next topic paging, and indicator dots.

## Live ACE Data Used

| Data | Endpoint | Resolution | Refresh |
|---|---|---|---|
| Core animation fields (power, wind speed, rotor speed, nacelle position, lifetime energy) | `.../data/wec_instantaneous/latest` | 1s | every 1 second |
| 13 additional instantaneous fields (voltage, current, power factor, frequency, etc.) | same request as above | 1s | every 1 second |
| Air pressure, blade pitch | `.../data/wecstd/latest` | 10m | every 60 seconds |
| Daily availability | `.../data/wec_availability/latest` | daily | once at load, then hourly |
| Turbine configuration (rated capacity; also model/serial/commissioning date for the specs panel) | `.../assets/wec-1/configuration/latest` | — | once at load (specs panel reuses this cached response) |
| Site location name (new, for specs panel) | `.../sites/ace/configuration/latest` | — | once, when "Turbine specs" is first opened |
| Signal history chart | `.../data/{family}/range` | 60s / 10m / daily | on demand when selected |

## How to Run

No build step, no dependencies. Serve with any static web server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/solutions/concept-9-grid-connection/` in your browser.
