# Swan Landing — 3D Scroll Property Showcase

A cinematic, scroll-driven landing page for the waterfront estate at
**227 Dock Lane, Great Neck, NY**. You open on the front door; as you scroll
you move forward, the door swings open in 3D, you travel through the principal
rooms, out to the pool and grounds, and finally the camera pulls all the way
back to reveal the water. Built to feel like the reference reel — smooth,
continuous, and professional.

## Run it

It's a static site — no build step. From this folder:

```bash
# any static server works; pick one
python3 -m http.server 8080
#   or
npx serve .
```

Then open <http://localhost:8080>. (Opening `index.html` directly via
`file://` also works, but a local server is recommended so relative asset
paths resolve exactly like production.)

## The scroll journey (acts)

| # | Act        | What happens on scroll                                        |
|---|------------|--------------------------------------------------------------|
| 1 | Approach   | Framed on the front door; camera dollies forward, title fades|
| 2 | Enter      | The door swings open in real 3D; camera passes through it    |
| 3 | Interior   | Forward push through foyer → great room → kitchen → garden room |
| 4 | Grounds    | Emerge to the pool, terraces, and gardens                    |
| 5 | The View   | Camera pulls all the way back to reveal the waterfront       |
| 6 | Details    | Price, stats, description, and a "Private Showing" CTA       |

## Photos & cinematic clips

The real listing photos live in [`/assets`](assets/README.md) and drive every
scene. On top of each photo the site plays a **cinematic motion clip** — a slow
push-in / drift / pull-back generated from that exact photo with Higgsfield
(Kling 3.0 Pro). As you scroll, each clip's playhead follows your scroll, so
the whole page feels like a smooth walkthrough you drive with the wheel.

- **By default the clips stream from Higgsfield's CDN**, so the motion works
  with zero setup. If a clip can't load, the still photo simply shows.
- **To make the site fully self-contained**, run `node scripts/fetch-clips.mjs`
  to download the clips into `assets/clips/`. The player automatically prefers
  those local files whenever they exist (see `CLIP_CDN` / `setupClips` in
  `js/main.js`).

## Bonus: standalone walkthrough video

The same clips can be stitched into one continuous ~30s video for
Instagram / Zillow:

```bash
node scripts/fetch-clips.mjs      # 1. get the clips locally
npm i ffmpeg-static               # 2. (or have ffmpeg on your PATH)
node scripts/build-walkthrough.mjs   # 3. → assets/walkthrough.mp4
```

The clips are silent, so add music in any editor (or let the platform add a
track).

## How it's built

- **Vanilla HTML/CSS/JS** — no framework, no build tooling.
- **[GSAP](https://gsap.com) + ScrollTrigger** — pinned, scroll-scrubbed
  timelines drive every act, including each clip's playhead. Vendored in
  `/vendor` (no CDN for the libraries).
- **[Lenis](https://github.com/darkroomengineering/lenis)** — inertial smooth
  scrolling, tied into GSAP's ticker so animation stays perfectly in sync.
- **[Higgsfield](https://higgsfield.ai) / Kling 3.0 Pro** — image-to-video
  clips generated from each real photo.
- **Progressive enhancement** — with JS off, or when the visitor has
  *reduce motion* enabled, every scene collapses to a clean, readable, static
  layout on the real photos.

## Structure

```
property-showcase/
├── index.html          # the storyboard / DOM for every act
├── css/style.css       # design system, scenes, 3D transforms, legibility
├── js/main.js          # Lenis + GSAP orchestration, clip scrubbing, loader
├── vendor/             # gsap.min.js, ScrollTrigger.min.js, lenis.min.js
├── assets/             # real property photos (+ clips/ once self-hosted)
└── scripts/            # fetch-clips.mjs, build-walkthrough.mjs, fetch-images.mjs
```

## Customizing copy & numbers

Property name, address, price and stats live as plain text in `index.html`
(search for `data-count` for the animated figures). Colors, fonts and the
gold accent are CSS variables at the top of `css/style.css`.
