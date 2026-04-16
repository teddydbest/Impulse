# Peppi's Pizza Mia — Squarespace Redesign Guide

Reference site: pizzeriabeddia.com  
Goal: Dark, editorial, minimalist — sparse layout, big serif type, full-bleed photography  
Plan: Business plan with custom CSS

---

## Quick Summary of What You're Doing

| Layer | Tool | Time |
|---|---|---|
| Global colors + fonts | Design → Custom CSS | 10 min |
| Navigation style | Design → Custom CSS (included) | Already done |
| Homepage structure | Fluid Engine page editor | 30–45 min |
| Menu page | Text blocks + Page CSS | 20 min |
| Photography | Upload to sections | 20 min |

---

## STEP 1 — Add the Global CSS

1. In Squarespace, go to **Design → Custom CSS**
2. Delete anything already in there (or leave it and paste at the end — your call)
3. Open the file `squarespace/global-styles.css` from this repo
4. Copy the **entire file** and paste it into the CSS editor
5. Click **Save**
6. Preview your site — it should immediately turn dark with Cormorant Garamond headings

> If you see the fonts didn't change: Squarespace sometimes needs you to clear a cached style. Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) in preview mode.

---

## STEP 2 — Site Styles (Design Panel)

Go to **Design → Site Styles** and set these manually to match:

### Colors
| Setting | Value |
|---|---|
| Page Background | `#111111` |
| Heading | `#f0ebe0` |
| Body Text | `#f0ebe0` |
| Link | `#f0ebe0` |
| Button Background | Transparent |
| Button Border | `#f0ebe0` |
| Navigation Links | `#f0ebe0` |

### Fonts
- Heading font: **Cormorant Garamond**
- Body font: **Jost** (or Raleway if Jost isn't listed)
- If neither appears: the CSS @import handles it — just pick any serif for heading, any sans for body in the panel, then the CSS overrides it

### Header Settings
- Style: **Overlay** (floats on top of the hero)
- Transparent: **On**
- Scroll behavior: Solid (the CSS will make it a dark blur on scroll)

---

## STEP 3 — Homepage Layout (Fluid Engine)

Edit your homepage. **Delete all existing sections** and rebuild from scratch:

### Section 1 — Hero
- Add a new section
- Click the section background → **Image** → upload your best **dark/moody food photo**
- Set **Overlay opacity** to about 30–40% (dark)
- Set section **min-height** to 100vh in section settings
- Add a **Text Block** with a single H1: `Peppi's` (or your tagline)
- Center everything
- The transparent header will float over this

### Section 2 — Story / Ethos
- Add a new section, background: **#111111**
- Add a **Text Block** with 2–3 sentences about the restaurant in a paragraph
- Center the text block, set it to ~60% width (use the column resize handles)
- Don't add a heading — just the paragraph. Let the words breathe.

### Section 3 — Menu Preview
- Add a new section, background: **#111111**
- Add a Text Block:
  - H3: `The Menu`
  - H3s for each category: `Pizza`, `Salads`, `Drinks`
  - Paragraphs for each item
- See STEP 5 for full menu page instructions

### Section 4 — Full-Bleed Photo
- Add a new section
- Set background to your second best food photo (can be a bright photo — set overlay to 15–20%)
- No text inside — just the image fills the section
- Set section height to ~70vh

### Section 5 — Hours + Location
- Add a new section, background: **#111111**
- Add a Text Block:
  ```
  Hours
  
  Tuesday – Sunday
  5pm – Close
  
  1234 Your Street
  Philadelphia, PA
  ```
- Center align, no heading above "Hours" — let the smallcaps H3 do the work

### Section 6 — CTA (Order / Reserve)
- Add a new section, background: **#111111**
- Add a **Button Block**
- Link to your ordering platform or OpenTable/Resy
- The CSS will automatically make buttons into the outline style

---

## STEP 4 — Apply Homepage Hero CSS

1. In Squarespace: **Pages → Home → gear icon → Advanced**
2. In **Page Header Code Injection**, paste:

```html
<style>
/* paste entire contents of squarespace/homepage-hero.css here */
</style>
```

3. Open `squarespace/homepage-hero.css` from this repo and copy its contents inside the `<style>` tags

---

## STEP 5 — Build the Menu Page

### Page structure
- Do **NOT** use Squarespace's built-in "Menu" block
- Use a regular **Page** with **Text Blocks**

### How to format your menu items

In each Text Block, structure it like this using Squarespace's rich text editor:

```
PIZZA                          ← H3 (category heading)

Margherita  18                 ← Paragraph (item + price)
Tomato, fior di latte, basil   ← italicize this line in the editor

Pepperoni  20                  ← Paragraph
House-made pepperoni, honey    ← italicize

...

SALADS                         ← H3

...
```

### Apply Menu Page CSS

1. **Pages → [Menu page] → gear icon → Advanced**
2. **Page Header Code Injection**, paste:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@200;300&display=swap" rel="stylesheet">
<style>
/* paste entire contents of squarespace/menu-page.css here */
</style>
```

---

## STEP 6 — Photography Notes

| Section | Photo type | Squarespace overlay |
|---|---|---|
| Hero | Dark/moody food shot | 25–35% dark overlay |
| Full-bleed middle | Either moody or bright works | 10–20% if bright |
| Any other image sections | Bright or moody | Adjust overlay to match tone |

- Avoid white-background food photos in this layout
- Shoot-style that works best: dark wood table, dramatic side lighting, overhead on slate/stone
- Squarespace crops to fill — upload at least 2000px wide

---

## STEP 7 — Navigation Structure

Keep navigation minimal. Suggested nav items:

```
Menu    About    Reserve
```

That's it. 3 items maximum. The Beddia aesthetic is about removing, not adding.

- No dropdown menus
- No social icons in the nav (put them in the footer)
- Logo: either an image logo OR your restaurant name in text (the CSS will style it in italic serif)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Fonts aren't changing | Hard-refresh (Ctrl+Shift+R). Clear browser cache. |
| Background still white | Check that your section backgrounds are set to #111 in each section, OR add `body { background: #111 !important; }` at top of CSS |
| Nav not transparent | Confirm Header style is set to "Overlay" in Design → Header |
| Text hard to read on hero | Increase section overlay opacity slider in the section settings |
| Mobile looks off | Add this to Custom CSS: `@media (max-width: 767px) { h1 { font-size: 3rem !important; } }` |
| Cormorant not loading | It loads from Google Fonts — if site is offline, it falls back to Georgia serif |

---

## Final Checklist Before Going Live

- [ ] Dark background across all sections (no white bleeding through)
- [ ] Cormorant Garamond loading on all headings
- [ ] Hero is full-viewport-height with transparent nav
- [ ] No default Squarespace button colors (all outline style)
- [ ] Menu page is clean typographic list
- [ ] Mobile navigation works (hamburger menu visible on dark background)
- [ ] All images are full-bleed (no white padding around them)
- [ ] Footer is dark with minimal text
- [ ] Test on iPhone and Android (Squarespace preview → Mobile view)
