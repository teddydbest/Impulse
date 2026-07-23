#!/usr/bin/env node
/* =====================================================================
   Swan Landing — clip fetcher (self-hosting)
   ---------------------------------------------------------------------
   The site streams the cinematic clips from Higgsfield's CDN by default,
   so it works with no setup. Run this once to pull those clips INTO the
   repo (assets/clips/) so the site is fully self-contained and no longer
   depends on the CDN. The player automatically prefers the local files
   when they exist.

   USAGE:  node scripts/fetch-clips.mjs          (Node 18+, built-in fetch)
   ===================================================================== */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "assets", "clips");

const BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_3GMlQ1a8asLkV2qJWhGfwh9mU45/";
const CLIPS = {
  "exterior.mp4":    "hf_20260723_213004_6b4fcdc8-ce22-4f5c-9a1d-bf8e5fa635f0.mp4",
  "foyer.mp4":       "hf_20260723_212848_e9ee5dde-0ea8-462a-a390-f7df639748b6.mp4",
  "great-room.mp4":  "hf_20260723_212852_72bb26bd-bbae-4380-8e69-c88b8aded961.mp4",
  "kitchen.mp4":     "hf_20260723_212919_08ec4d83-3059-4571-8efd-65ed9ec8a9a9.mp4",
  "garden-room.mp4": "hf_20260723_212937_d7f8f5c9-84c8-495f-aa40-ee5c58fd95ae.mp4",
  "backyard.mp4":    "hf_20260723_212944_f7b9fb68-9805-4a26-8fdc-162f29794573.mp4",
  "waterfront.mp4":  "hf_20260723_212946_ce913111-2e44-4ae1-8525-b5040938aa99.mp4",
};

// Order the site plays them in (also used by build-walkthrough.mjs).
export const CLIP_ORDER = [
  "exterior.mp4", "foyer.mp4", "great-room.mp4", "kitchen.mp4",
  "garden-room.mp4", "backyard.mp4", "waterfront.mp4",
];

async function main() {
  await mkdir(OUT, { recursive: true });
  let ok = 0;
  for (const [name, file] of Object.entries(CLIPS)) {
    try {
      const res = await fetch(BASE + file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(join(OUT, name), Buffer.from(await res.arrayBuffer()));
      console.log(`  ✓ ${name}`);
      ok++;
    } catch (e) {
      console.warn(`  ✗ ${name} — ${e.message}`);
    }
  }
  console.log(`\n  ${ok}/${Object.keys(CLIPS).length} clips saved to assets/clips/`);
  if (ok) console.log("  The site will now use these local files automatically.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
