#!/usr/bin/env node
/* =====================================================================
   Swan Landing — image fetcher
   ---------------------------------------------------------------------
   Downloads the property photos into ../assets with the exact filenames
   the site expects. Run it from YOUR machine (Zillow's CDN is reachable
   there; it is blocked inside the build sandbox).

   USAGE
     1. Open scripts/image-urls.txt and paste one image URL per line,
        in this order (blank line = keep the placeholder for that scene):
            1  exterior-front   (front of the house / façade)
            2  foyer            (entry / staircase)
            3  great-room       (living room)
            4  kitchen
            5  primary          (primary bedroom / suite)
            6  backyard         (pool / patio / grounds)
            7  waterfront       (the water view / dock)
        You can add more lines; extras are saved as extra-1.jpg, etc.
     2. Run:   node scripts/fetch-images.mjs
        (Node 18+; uses built-in fetch — no npm install needed.)

   Where do the URLs come from? On the Zillow listing, open a photo,
   right-click → "Copy image address" for each one, or grab them from
   the page source (they live on photos.zillowstatic.com). Any direct
   image URL works — Dropbox, Google Drive (direct link), your own host.
   ===================================================================== */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "assets");
const LIST = join(__dirname, "image-urls.txt");

const NAMES = [
  "exterior-front",
  "foyer",
  "great-room",
  "kitchen",
  "primary",
  "backyard",
  "waterfront",
];

async function main() {
  await mkdir(ASSETS, { recursive: true });

  let raw;
  try {
    raw = await readFile(LIST, "utf8");
  } catch {
    console.error(`\n  Could not read ${LIST}\n  Create it and paste one image URL per line (see header of this file).\n`);
    process.exit(1);
  }

  const urls = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => !l.startsWith("#")); // keep blanks to preserve ordering

  let ok = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue; // blank line → keep placeholder for this scene
    const base = NAMES[i] || `extra-${i - NAMES.length + 1}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const buf = Buffer.from(await res.arrayBuffer());
      const out = join(ASSETS, `${base}.${ext}`);
      await writeFile(out, buf);
      // The CSS references .jpg — if we saved png/webp, also write a copy as .jpg-named file
      if (ext !== "jpg") await writeFile(join(ASSETS, `${base}.jpg`), buf);
      console.log(`  ✓ ${base}  ←  ${url.slice(0, 60)}${url.length > 60 ? "…" : ""}`);
      ok++;
    } catch (err) {
      console.warn(`  ✗ ${base}  (${err.message}) — placeholder kept`);
    }
  }

  console.log(`\n  Done. ${ok} image(s) saved to /assets.`);
  if (ok === 0) console.log("  (No URLs were provided — the site still runs on its built-in placeholder scenes.)\n");
}

main();
