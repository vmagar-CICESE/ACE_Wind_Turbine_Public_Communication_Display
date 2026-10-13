# Concept 7 — ACE Live Wind: Digital Twin (Community Pop-ups)

Everything in [Concept 6](../concept-6-live-digital-twin-branded/) —
unchanged: the full-screen animated turbine, the live info panel, the 17-signal
explorer, the centred title banner, and the official ACE credits box — **plus**
an interactive **right-hand side Story & Impact Dock** featuring expandable
text pop-ups tailored for a community centre display (Option B).

Concept 6 remains completely untouched; this is a separate, additive concept.

## Why text pop-ups for the community centre?

A screen in the Lawrence Weston community centre serves two distinct viewing modes:
1. **Passive viewing:** People walking past or sitting across the hall glance at the screen for 5–15 seconds.
2. **Interactive exploration:** Curious visitors, students, or community members standing at the screen (or using a touchscreen/tablet) who want to know what the turbine actually does for them.

The **Story & Impact Dock** on the right-hand side satisfies both modes:
- **In passive mode**, the teaser card gently auto-cycles every 14 seconds across five curated topics, displaying an intriguing headline, a one-sentence takeaway, and a subtle counter (`● 1 / 5`).
- **In interactive mode**, tapping any topic pill or clicking **"Read full story ↗"** pauses the timer and opens a rich, accessible pop-up overlay modal with in-depth context, authoritative quotations, Sustainable Development Goal (SDG) alignments, and outbound source links.

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
- **Right-hand Story Dock:** Anchored to `right: clamp(1rem, 3vw, 2rem)` and `top: clamp(3rem, 6.5vh, 5rem)`, perfectly mirroring the left overlay to create an uncluttered, horizontally symmetric upper display.
- **Credits box:** Anchored to the bottom-right corner (`right: clamp(1rem, 3vw, 2rem); bottom: clamp(1.5rem, 3.5vh, 2.75rem)`), aligned with the story dock.
- **Story modal:** Center-stage overlay with dark frosted backdrop (`backdrop-filter: blur(8px)`), accessible close button (`✕`), keyboard navigation (`Escape`, `Tab`), previous/next topic paging, and indicator dots.

## Live ACE Data Used

| Data | Endpoint | Resolution | Refresh |
|---|---|---|---|
| Core animation fields (power, wind speed, rotor speed, nacelle position, lifetime energy) | `.../data/wec_instantaneous/latest` | 1s | every 1 second |
| 13 additional instantaneous fields (voltage, current, power factor, frequency, etc.) | same request as above | 1s | every 1 second |
| Air pressure, blade pitch | `.../data/wecstd/latest` | 10m | every 60 seconds |
| Daily availability | `.../data/wec_availability/latest` | daily | once at load, then hourly |
| Turbine configuration | `.../configuration/latest` | — | once at load |
| Signal history chart | `.../data/{family}/range` | 60s / 10m / daily | on demand when selected |

## How to Run

No build step, no dependencies. Serve with any static web server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/solutions/concept-7-live-digital-twin-popups/` in your browser.
