# /assets — property photos

The site works out of the box on hand-built CSS placeholder scenes.
To show the **real house**, drop images in here with these exact names
(any of `.jpg`, `.png`, or `.webp` — `.jpg` is what the CSS looks for):

| Scene in the scroll journey | Filename            |
| --------------------------- | ------------------- |
| Landing / front of house    | `exterior-front.jpg`|
| Grand foyer (through door)  | `foyer.jpg`         |
| Great room                  | `great-room.jpg`    |
| Chef's kitchen              | `kitchen.jpg`       |
| Primary suite               | `primary.jpg`       |
| Pool / backyard / grounds   | `backyard.jpg`      |
| Waterfront view / dock      | `waterfront.jpg`    |

**Two ways to fill this folder:**

1. **Manual** — save the photos you want from the listing and rename them
   to match the table above.
2. **Scripted** — paste the image URLs into `../scripts/image-urls.txt`
   (one per line, in the order above) and run
   `node scripts/fetch-images.mjs` from your own machine.

Recommended: landscape photos, ~2400px wide, optimized (< ~500 KB each)
for smooth scrolling. That's it — refresh the page and the scenes are live.
