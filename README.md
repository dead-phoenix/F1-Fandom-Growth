# 🏎 The Global Growth of Formula 1 Fandom

An interactive narrative data visualisation exploring how global F1 fan engagement evolved between 2015 and 2025 — and whether that growth was driven by on-track performance, Netflix, or something else entirely.

**[View the live visualisation](https://dead-phoenix.github.io/F1-Fandom-Growth/)**

---

> **Academic context:** FIT5147 Data Exploration and Visualisation · Semester 1, 2026 · Monash University  
> Tanisha Thapa · 35909684

---

## Table of Contents

- [Project overview](#project-overview)
- [Motivation](#motivation)
- [Research questions](#research-questions)
- [Data sources](#data-sources)
- [Data wrangling and challenges](#data-wrangling-and-challenges)
- [Tableau exploration and findings](#tableau-exploration-and-findings)
- [Five Design Sheet methodology](#five-design-sheet-methodology)
- [D3 interactive visualisation](#d3-interactive-visualisation)
- [How to run locally](#how-to-run-locally)
- [Repository structure](#repository-structure)
- [Technologies used](#technologies-used)

---

## Project overview

Formula 1 went from a niche European motorsport to a global cultural phenomenon between 2015 and 2025. This project uses Google Trends search interest as a proxy for fan engagement across 14 countries, combined with race performance data from the FastF1 API and manually compiled media event data, to answer a deceptively simple question:

**Did F1 grow because of great racing - or because of Netflix?**

The answer turns out to be: both, but not equally, and not everywhere.

---

## Motivation

As an F1 fan, I noticed the sport's popularity surge among people who'd never watched a race before 2019. The Netflix documentary *Drive to Survive*, the 2021 Verstappen–Hamilton title fight, and Sergio Pérez's rise with Red Bull all seemed to play a role — but in very different ways for different countries. This project sits at the intersection of three things I care about: Formula 1, data analysis, and human behaviour.

---

## Research Questions

Three questions guided the entire project—from data collection and exploration through to the final visualisation:

| ID | Question |
|----|----------|
| **Q1** | How has global digital interest in Formula 1 evolved between 2015 and 2025? |
| **Q2** | To what extent does the national success of a driver or constructor drive regional fan engagement compared to general growth in non-traditional F1 markets? |
| **Q3** | How do major events—championship wins, Netflix *Drive to Survive* releases, and the 2025 F1 Movie—affect fan engagement? |

---

## Data sources

Three datasets were combined:

### A. Google Trends (primary)
- **URL:** https://trends.google.com
- **What it measures:** Relative weekly search interest for "Formula 1" by country, on a 0–100 scale
- **Coverage:** 14 countries × 2015–2025 → 154 rows × 7 columns after aggregation
- **Type:** Time-series + spatial
- **Countries:** United Kingdom, Germany, Italy, Spain, Brazil *(traditional markets)* + United States, Australia, Netherlands, Japan, Mexico, India, Singapore, UAE, China *(non-traditional markets)*

### B. FastF1 API
- **URL:** https://github.com/theOehrly/FastF1
- **What it contains:** Race results, driver standings, constructor standings, championship clinch dates
- **Coverage:** 1,900 race rows · 244 driver-standing rows · 11 clinch rows
- **Type:** Tabular / Relational

### C. F1 Media Events (manually compiled)
- **What it contains:** Release dates for Drive to Survive Seasons 1–7 and the 2025 F1 Movie
- **Coverage:** 9 rows × 8 columns
- **Type:** Tabular

---

## Data wrangling and challenges

All wrangling was performed in Python (pandas, numpy, pytrends). Seven pre-formatted JSON files were produced for the D3 visualisation.

### The Google Trends normalisation problem

Google Trends returns values on a 0–100 scale normalised *within each query window*. A query covering 2015–2019 and a separate query covering 2020–2025 are scaled independently — you can't directly compare a "60" from one window to a "60" from the other.

**Fix:** Overlapping-window stitching. Data was collected in 4-year windows with ~18-month overlaps (e.g., 2015–2019 and 2018–2022). For each consecutive pair of windows, the mean ratio of overlapping observations was used as a scaling factor to rescale the newer window onto the base window's scale before concatenating. This produced one continuous, comparable weekly series per country.

```python
# Simplified: compute scaling factor from overlap
overlap_base = base_series.loc[overlap_idx].mean()
overlap_new  = new_series.loc[overlap_idx].mean()
scale_factor = overlap_base / overlap_new
new_series_rescaled = new_series * scale_factor
```

Requests were spaced 1.5 seconds apart per country to avoid Google's rate limiting.

### Other Cleaning Steps

| Issue | Dataset | Resolution |
|--------|---------|------------|
| Race and schedule dates entirely missing for 2015–2017 (1,300+ nulls) | race_results, schedule | Filled from official F1 race calendar archives. Schedule cleaned first; race results dates filled via left merge on Year + Round. |
| Championship clinch dates null for 2015, 2016, 2017 | championship_clinch | Filled from historical records: 2015-11-02 (Brazil), 2016-11-27 (Abu Dhabi), 2017-10-29 (Mexico). |
| 3 wildcard drivers (Magnussen 2015, Button 2017, di Resta 2017) had null Position | driver_standings | Sentinel value 99 added; `is_wildcard` flag created. Excluded from ranking analyses. |
| Media event dates stored as DD-MM-YYYY strings | media_events | Parsed with `pd.to_datetime(dayfirst=True)`. Season 8 (2026) flagged as outside study window. |
| Force India constructor nationality listed as "Indian" | constructor_standings | Normalised to "British" because Force India was legally incorporated in the UK per FIA registration. |
| `peak_month` stored as float64 (e.g. 3.0) | yearly_interest | Cast to integer and `peak_month_name` added (3 → Mar). |
| pandas NaN written as literal `NaN` in JSON | All JSON files | Recursive `clean()` function replaces NaN/Inf with Python `None` before `json.dump()`. |
| Singapore invisible on 110m world map (~728 km²) | Choropleth | Manual D3 circle projected at correct coordinates. |
| Bump chart labels overlapping | Bump chart | `staggeredLabels()` function enforces minimum 14px spacing. |

### Merged datasets produced

Two analysis-ready merged files were created for Tableau:

- **interest_with_champion.csv** — yearly_interest joined to championship_clinch (inner) and media_events (left join). 154 rows. Contains champion nationality, clinch month, and media release flags per country-year.
- **interest_with_driver_perf.csv** — yearly_interest joined to best-placed focus driver per nationality per year. Adds year-on-year interest change and % change columns. 154 rows.

---

## Tableau exploration and findings

The initial data exploration was performed in Tableau Desktop. Ten visualisations were produced across the three research questions.

### Q1 — Global digital interest (2015–2025)

**Global average interest nearly doubled from 27.3 (2015) to 53.2 (2022), before falling to 31.3 by 2025.**

- The largest single-year jump was 2020→2021: **+17.3 points** — coinciding with the Verstappen–Hamilton title fight and Drive to Survive Season 3 (released March 2021)
- 2020 saw a **–6.4% YoY decline** from the COVID-disrupted calendar
- 2022–2025 shows **consecutive negative growth rates**, confirming post-peak normalisation
- OLS trend line: slope = 1.85 pts/yr, R² = 0.41 — growth is event-driven, not steady

**The 2025 crossover:** for the first time in the dataset, non-traditional markets (avg 34.2) overtook traditional markets (avg 26.1). Traditional markets fell 46% from peak; non-traditional fell only 21%.

| Country | Notable Pattern |
|----------|----------------|
| UK | Consistently high throughout (44.0–64.9). |
| India | Persistent outlier, 55.1–122.6 on stitched scale. |
| US | Biggest absolute growth: 48.1 → 112.9 (+134.8%). |
| Netherlands | Peaked at 27.7 in 2022 (Verstappen's dominant year), then fell to 9.1 by 2025. |
| China | Near-zero throughout. Google is blocked in China; data reflects platform absence rather than F1 interest. |

### Q2 — Driver success and regional engagement

**The relationship between driver performance and national interest is real but context-dependent.**

| Country | Finding |
|----------|---------|
| 🇲🇽 Mexico | **Strongest link.** Interest rose from 12.8 (2020) to 46.9 (2022) when Pérez joined Red Bull. Interest trend p = 0.005. Fell −38.64 in 2025 after his exit. |
| 🇳🇱 Netherlands | **Paradox.** Verstappen's position improved significantly (p = 0.011), but national interest stayed flat and declined (p = 0.640). Sustained dominance may reduce engagement. |
| 🇬🇧 United Kingdom | Consistently high with a slight upward trend (p = 0.069). Biggest spike was 2021—the closest championship fight, not the one Hamilton won. |
| 🇪🇸 Spain | Event-driven. Spiked in 2023–24 (Alonso and Sainz moments), then collapsed in 2025 after Sainz left Ferrari. |

**Scatter plot (all focus countries):** avg interest = 1.69 × position + 21.63 · R² = 0.40 · p = 0.051. The positive slope is counterintuitive — countries with *worse* drivers tend to show higher interest — but this is driven by the US outlier (highest interest, no competitive driver).

### Q3 — Impact of major events

**The US is the clearest evidence that Drive to Survive worked.**

The US had no competitive American driver (Logan Sargeant finished P21–23) and no home race until the 2022 Miami GP — yet interest grew **+134.8%** from 48.1 to 112.9. Growth began accelerating in 2019, aligned with DtS Season 1.

- Paired t-test (pre-DtS 2015–18 vs DtS era 2019–25): **t = –3.29, p = 0.006** — statistically significant uplift
- Pre-DtS global mean: 28.6 → DtS era mean: 40.7 → **+42% increase**
- Largest absolute DtS gains: India +42.7 pts, US +37.6 pts, Mexico +28.3 pts
- Netherlands: only country with negligible net DtS change (+4.5 pts, masking a rise and fall)

**Peak month heatmap finding:** Race calendar dominates *when* interest peaks, not DtS. Singapore always peaks in September (Singapore GP), Mexico in October (Mexican GP), UAE in November (Abu Dhabi finale), Australia in March (season opener). These patterns are completely stable across 2015–2025. DtS shifted peak timing only slightly and inconsistently — primarily for the US and UK in the most recent years.

---

## Five Design Sheet methodology

The visualisation design followed the FDS methodology (Roberts et al., 2016), progressing through five sheets.

### Sheet 1 — Brainstorm

Generated 12 chart type candidates, then filtered, categorised, and combined them into three design directions:

**Ideas generated:** choropleth map, bump chart, dual-axis line, slope chart, scatter plot, annotated line, small multiples, area chart, bar chart, symbol/dot map, radial chart, timeline strip

**Filtered out:**
- Waffle chart — same information as slope chart, higher implementation cost
- Radial clock chart — unfamiliar idiom for casual audience, no added analytical value
- Standalone timeline — better as an annotation layer on existing charts

**Categorised into:** Geographic/spatial · Temporal trend · Country comparison · Driver correlation

**Three design directions emerged:** scroll story (A), rank explorer (B), single-view dashboard (C)

---

### Sheet 2 — Design A: Scrollytelling Story

**Narrative genre:** Martini glass (author-driven linear narrative)  
**Map type:** Choropleth (blue→amber scale)  
**Structure:** Single scrolling column. Charts animate in as user scrolls.

| Section | Charts |
|----------|--------|
| Q1 | Choropleth map (syncs to scroll year) + annotated global trend line |
| Q2 | Mexico annotated bar chart + Netherlands dual-axis line |
| Q3 | Slope chart (pre/post DtS) + grouped bar chart |

**Pros:** Cinematic, suits the DtS audience, guided story arc  
**Cons:** Low audience agency, scroll triggers add D3 complexity

---

### Sheet 3 — Design B: Country Rank Explorer

**Narrative genre:** Reader-driven exploration  
**Map type:** Bump chart (rank lines — a non-geographic spatial encoding)  
**Structure:** Three stacked panels, all visible simultaneously. No tabs.

| Panel | Charts |
|--------|--------|
| Q1 | Bump chart — 14 country rank lines (2015–2025) |
| Q2 | Interest trend line + dual-axis driver position + stat cards |
| Q3 | US annotated line + slope chart |

Clicking any country line updates the Q2 panel. Teal = non-traditional markets, slate = traditional.

**Pros:** High audience agency, bump chart shows rank crossovers immediately, all 3 questions answered in one view  
**Cons:** 14 lines may feel cluttered, no geographic spatial context

---

### Sheet 4 — Design C: Single-View Dashboard

**Narrative genre:** Mixed martini–drill-down  
**Map type:** Symbol/proportional dot map (circle area encodes magnitude — no colour-blind issues)  
**Structure:** Persistent event timeline banner at top. All three question regions always visible. No tabs.

| Region | Charts |
|---------|--------|
| Q1 | Symbol map + annotated global trend line |
| Q2 | Small multiples (NL, MX, GB, ES) + scatter plot with OLS |
| Q3 | Slope chart + peak month heatmap |

Clicking a country circle highlights it across all panels simultaneously.

**Pros:** All questions visible at once, event timeline anchors all views, size channel avoids colour-blind issues  
**Cons:** Six charts may feel dense on smaller screens

---

### Sheet 5 — Final Realisation (implemented)

The final design is a **hybrid** combining the best elements of all three:

| Source | What Was Taken |
|---------|----------------|
| Design A | Choropleth map with blue→amber scale and narrative framing |
| Design B | Bump chart, country drill-down panel, and linked views |
| Design C | Persistent event timeline, slope chart, scatter plot, and heatmap |

**Key design decisions:**
- Both the choropleth and the bump chart can select a country — both update the same country story panel (linked views)
- Narrative reframed from "Q1/Q2/Q3" academic labels to three story chapters: *"A sport goes global"* · *"When your driver wins, your country watches"* · *"Netflix changed everything — or did it?"*
- Consistent colour system throughout: teal = growth, coral = decline, slate = neutral, amber = events
- Blue→amber map scale replaces the red→green palette used in Tableau (accessibility fix for deuteranopia)

---

## D3 interactive visualisation

### Charts implemented

| Chart | Research Question | Description |
|---------|-----------------|-------------|
| Choropleth world map | Q1 | Blue→amber scale, animated year slider, click-to-select country |
| Bump chart | Q1 | 14 country rank lines, traditional vs non-traditional markets |
| Country interest line | Q1/Q2 | Annotated trend with DtS era band and event markers |
| Driver position chart | Q2 | Mini line chart below interest line |
| Small multiples | Q2 | Four-country comparison panel |
| Scatter plot + OLS | Q2 | Correlation between interest and driver performance |
| Slope chart | Q3 | Pre-DtS vs DtS-era averages |
| Peak month heatmap | Q3 | Country × year peak-interest month |

### Key interactions

| Interaction | Effect |
|-------------|--------|
| Click country on choropleth | Updates bump chart and country story panel |
| Click country on bump chart | Same linked-view behaviour |
| Year slider | Updates choropleth for selected year |
| Event timeline click | Jumps slider to event year |
| Hover data point | Shows contextual tooltip |
| Hover slope chart | Displays pre/post DtS values |
| Hover heatmap cell | Shows country, year, and peak month |

### Technical notes

- **Singapore:** The city-state (~728 km²) is excluded from the world-atlas 110m TopoJSON — too small to appear as a polygon. Rendered as a manually projected D3 circle at coordinates (lon 103.82, lat 1.35) with a "SG" label. Fully interactive.
- **NaN fix:** pandas serialises Python `float('nan')` as the literal string `NaN` which is invalid JSON. Fixed with a recursive `clean()` function that replaces all NaN/Inf values with `None` before `json.dump`.
- **Label overlap:** Bump chart end-labels use a `staggeredLabels()` function that enforces a minimum 14px vertical gap between adjacent labels.
- **World map:** `countries-110m.json` is loaded from jsDelivr CDN at runtime. Requires internet connection. See [How to run locally](#how-to-run-locally) for offline instructions.

---

## How to run locally

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/f1-fandom-growth-visualisation.git
cd f1-fandom-growth-visualisation

# 2. Start a local server (required — D3 uses fetch() for JSON files)
python3 -m http.server 8000

# 3. Open in browser
# http://localhost:8000
```

**Offline mode (no internet connection):**  
Download `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` and place it in the root directory. Then in `main.js`, change:
```javascript
// FROM:
d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
// TO:
d3.json('countries-110m.json')
```

**Regenerating data files:**  
If you want to rebuild the JSON files from the original CSVs:
```bash
pip install pandas
python3 prepare_data.py
```
Place the four cleaned CSVs (`yearly_interest.csv`, `interest_with_driver_perf.csv`, `media_events.csv`, `interest_with_champion.csv`) in the same directory as `prepare_data.py`.

---

## Repository structure

```
f1-fandom-growth-visualisation/
│
├── index.html              # Main page — layout, CSS, HTML structure
├── main.js                 # All D3 visualisation code
├── prepare_data.py         # Python script to regenerate JSON from CSVs
├── README.md               # This file
│
└── data/
    ├── interest_by_country.json   # 154 rows: all countries × years, rank, market type
    ├── global_trend.json          # 11 rows: global average per year + media flag
    ├── driver_perf.json           # 83 rows: focus-driver countries only
    ├── media_events.json          # 8 rows: DtS S1–S7 + F1 Movie
    ├── slope_data.json            # 14 rows: pre/post DtS averages per country
    ├── peak_month.json            # 154 rows: peak month per country × year
    └── champion_data.json         # 11 rows: world champion per year
```

---

## Technologies used

| Purpose | Tool |
|----------|------|
| Interactive visualisation | D3.js v7 |
| World map topology | TopoJSON v3 (world-atlas@2) |
| Data wrangling | Python (pandas, numpy, scipy) |
| Google Trends collection | pytrends |
| Race data | FastF1 API |
| Exploratory analysis | Tableau Desktop 2026.1 |
| Hosting | GitHub Pages |

---

## References

- Bostock, M. et al. (2011). D³ data-driven documents. *IEEE TVCG, 17*(12), 2301–2309.
- Roberts, J. C. et al. (2016). Sketching designs using the five design-sheet methodology. *IEEE TVCG, 22*(1), 419–428.
- Segel, E., & Heer, J. (2010). Narrative visualization: Telling stories with data. *IEEE TVCG, 16*(6), 1139–1148.
- Munzner, T. (2014). *Visualization Analysis and Design.* CRC Press.
- Tufte, E. R. (1990). *Envisioning Information.* Graphics Press.
- Ware, C. (2004). *Information Visualization: Perception for Design* (2nd ed.). Morgan Kaufmann.
- Google LLC. (n.d.). Google Trends. https://trends.google.com
- Oehrly. FastF1. https://github.com/theOehrly/FastF1
- Motorsport Network. (2025). 2025 Global F1 Fan Survey. https://cdn8.motorsport.com/static/custom/piano/2025globalf1fansurvey.pdf

---

*FIT5147 Data Exploration and Visualisation · Semester 1, 2026 · Monash University*
