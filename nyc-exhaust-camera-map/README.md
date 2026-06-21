# NYC Exhaust / Noise Camera Map

An interactive, deflock.org-style map of New York City's roadside **noise
enforcement cameras** — the "SoundCam" devices the NYC Department of
Environmental Protection (DEP) uses to ticket vehicles with illegally loud
exhaust / modified mufflers (and excessive honking).

![type:map](./) <!-- Open index.html to view -->

## What this is

The City runs the **Noise Camera Enforcement Program**. A roadside sound meter +
camera triggers when it measures **85 dB or louder from 50+ feet away**, records
video of the offending vehicle, and DEP staff mail the registered owner a
notice. Muffler-noise violations carry an **$800 minimum** penalty.

As of the latest reporting there are about **11 cameras** deployed citywide
(none yet on Staten Island). **Local Law 7 of 2024** mandates at least five
cameras per borough.

## Important caveat about the data

**The City deliberately does not publish exact camera locations** — partly to
prevent vandalism and to keep drivers from routing around them. Every point on
this map is therefore compiled from **public news reporting, DEP annual reports,
and community reports** (Waze threads, neighborhood groups, etc.), and the
**coordinates are approximate**. Treat this as a community awareness tool, not an
official source. Each marker links to the source(s) it came from.

## Running it

It's a static site — no build step.

```bash
cd nyc-exhaust-camera-map
python3 -m http.server 8000
# then open http://localhost:8000
```

A local server is required because the app `fetch()`es `data/cameras.json`
(browsers block that for `file://` URLs). Any static host works
(GitHub Pages, Netlify, etc.).

## Features

- Interactive Leaflet map (dark CARTO basemap) with marker clustering
- Custom camera markers colored by status (active vs. community-reported)
- Synced, searchable list panel
- Filter by **borough** and **status**
- "Near me" geolocation button
- Per-camera popups with notes, confidence, and source links
- Mobile-responsive layout

## Contributing a location

All data lives in [`data/cameras.json`](data/cameras.json). To add or correct a
camera, add an object to the `cameras` array:

```json
{
  "id": "unique-slug",
  "address": "123 Example Ave",
  "neighborhood": "Neighborhood",
  "borough": "Manhattan",
  "lat": 40.7000,
  "lng": -73.9800,
  "status": "active",          // "active" or "reported"
  "confidence": "reported",
  "type": "noise/exhaust",
  "notes": "How this was sourced / context.",
  "sources": ["https://…"]
}
```

Please include a source link so others can verify. Then open a pull request.

## Sources

- [NYC DEP — Noise Code](https://www.nyc.gov/site/dep/environment/noise-code.page)
- [DEP 2025 Annual Report for Noise Camera Enforcement Program (PDF)](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/2025-annual-report-noise-camera-enforcement-program.pdf)
- [DEP 2024 Annual Report (PDF)](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/2024-annual-report-noise-camera-enforcement-program.pdf)
- [Time Out NY — NYC's noise cameras explained](https://www.timeout.com/newyork/news/nycs-noise-cameras-are-here-to-fine-you-everything-to-know-about-the-new-hidden-tech-091725)
- [Gothamist — crackdown on noisy drivers](https://gothamist.com/news/accelerate-crackdown-on-noisy-drivers-with-ai-nyc-councilmember-says)
- [Brooklyn Paper — Bay Ridge noise camera](https://www.brooklynpaper.com/city-noise-camera-program-expands-bay-ridge/)
- [Waze community thread — noise camera reports](https://www.waze.com/discuss/t/noise-camera/365476)

## Disclaimer

This is an independent, community-built awareness project. It is not affiliated
with or endorsed by the City of New York. Locations are approximate and may be
inaccurate or out of date.
