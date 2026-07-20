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
| 3 | Interior   | Forward push through foyer → great room → kitchen → primary  |
| 4 | Grounds    | Emerge to the pool, terraces, and gardens                    |
| 5 | The View   | Camera pulls all the way back to reveal the waterfront       |
| 6 | Details    | Price, stats, description, and a "Private Showing" CTA       |

## Add the real photos

The page ships with hand-built CSS placeholder scenes so it looks finished
immediately. Drop the actual listing photos into [`/assets`](assets/README.md)
with the documented filenames (or use `node scripts/fetch-images.mjs` with a
list of image URLs) and the scenes update automatically — no code changes.

## How it's built

- **Vanilla HTML/CSS/JS** — no framework, no build tooling.
- **[GSAP](https://gsap.com) + ScrollTrigger** — pinned, scroll-scrubbed
  timelines drive every act. Vendored in `/vendor` (no CDN).
- **[Lenis](https://github.com/darkroomengineering/lenis)** — inertial smooth
  scrolling, tied into GSAP's ticker so animation stays perfectly in sync.
- **Progressive enhancement** — with JS off, or when the visitor has
  *reduce motion* enabled, every scene collapses to a clean, readable,
  static layout.
- **Zero external requests** at runtime — everything is local.

## Structure

```
property-showcase/
├── index.html          # the storyboard / DOM for every act
├── css/style.css       # design system, scenes, 3D transforms, placeholders
├── js/main.js          # Lenis + GSAP orchestration, loader, reveals, counters
├── vendor/             # gsap.min.js, ScrollTrigger.min.js, lenis.min.js
├── assets/             # drop real property photos here (see assets/README.md)
└── scripts/            # fetch-images.mjs + image-urls.txt (photo pipeline)
```

## Customizing copy & numbers

Property name, address, price and stats live as plain text in `index.html`
(search for `data-count` for the animated figures). Colors, fonts and the
gold accent are CSS variables at the top of `css/style.css`.
