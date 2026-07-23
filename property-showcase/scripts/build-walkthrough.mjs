#!/usr/bin/env node
/* =====================================================================
   Swan Landing — bonus walkthrough builder
   ---------------------------------------------------------------------
   Stitches the 7 cinematic clips into ONE continuous ~30s walkthrough
   video (assets/walkthrough.mp4) with smooth crossfades — ready to post
   to Instagram / Zillow / YouTube. The clips are silent, so add music in
   any editor (or let the platform add a track).

   PREREQS:
     1. node scripts/fetch-clips.mjs      (downloads the clips locally)
     2. npm i ffmpeg-static               (or have ffmpeg on your PATH)
   RUN:
     node scripts/build-walkthrough.mjs
   ===================================================================== */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLIP_ORDER } from "./fetch-clips.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIPS = join(__dirname, "..", "assets", "clips");
const OUT = join(__dirname, "..", "assets", "walkthrough.mp4");

const CLIP_DUR = 5;      // seconds per clip
const XFADE = 0.8;       // crossfade duration
const W = 1920, H = 1080, FPS = 30;

async function ffmpegPath() {
  try { return (await import("ffmpeg-static")).default; }
  catch { return "ffmpeg"; } // fall back to system ffmpeg
}

function build() {
  const files = CLIP_ORDER.map((n) => join(CLIPS, n));
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length) {
    console.error("\n  Missing clips — run `node scripts/fetch-clips.mjs` first:\n  " +
      missing.join("\n  ") + "\n");
    process.exit(1);
  }

  // Normalise every input, then chain xfade transitions between them.
  const inputs = files.flatMap((f) => ["-i", f]);
  let fc = "";
  files.forEach((_, i) => {
    fc += `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
          `crop=${W}:${H},fps=${FPS},format=yuv420p,settb=AVTB[v${i}];`;
  });
  let prev = "v0";
  let offset = CLIP_DUR - XFADE;
  for (let i = 1; i < files.length; i++) {
    const out = i === files.length - 1 ? "vout" : `x${i}`;
    fc += `[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(2)}[${out}];`;
    prev = out;
    offset += CLIP_DUR - XFADE;
  }
  fc = fc.replace(/;$/, "");

  const args = [
    ...inputs,
    "-filter_complex", fc,
    "-map", "[vout]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-y", OUT,
  ];
  return args;
}

async function main() {
  const bin = await ffmpegPath();
  const args = build();
  console.log(`  Stitching ${CLIP_ORDER.length} clips → assets/walkthrough.mp4 …`);
  const p = spawn(bin, args, { stdio: ["ignore", "ignore", "inherit"] });
  p.on("close", (code) => {
    if (code === 0) console.log("\n  ✓ Done: assets/walkthrough.mp4  (silent — add music in your editor)\n");
    else console.error(`\n  ✗ ffmpeg exited with code ${code}\n`);
  });
}

main();
