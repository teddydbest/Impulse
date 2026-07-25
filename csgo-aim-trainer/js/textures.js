// textures.js — procedural canvas textures evoking the Dust2 desert palette.
// Everything is generated at runtime so the game ships with zero image assets.
import * as THREE from 'three';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Simple value-noise helper for grain.
function grain(ctx, size, amount, alpha) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    if (alpha !== undefined) d[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
}

function toTexture(canvas, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- Sandy ground / dust ----
export function sandTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c2a565';
  ctx.fillRect(0, 0, size, size);
  // patchy tone variation
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 8 + Math.random() * 60;
    const shade = 150 + Math.random() * 70;
    ctx.fillStyle = `rgba(${shade}, ${shade - 30}, ${shade - 90}, ${0.05 + Math.random() * 0.12})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // scattered pebbles / cracks
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(90,70,40,${0.1 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  grain(ctx, size, 26);
  return toTexture(c, 22);
}

// ---- Plaster / stucco wall (dusty tan, like Dust2 buildings) ----
export function wallTexture(base = '#b39a63') {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // blotchy weathering
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 10 + Math.random() * 80;
    ctx.fillStyle = `rgba(${120 + Math.random() * 60|0}, ${100 + Math.random() * 50|0}, ${60 + Math.random() * 40|0}, ${0.04 + Math.random() * 0.1})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // horizontal grime streaks
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(70,55,30,${0.03 + Math.random() * 0.06})`;
    ctx.fillRect(0, y, size, 1 + Math.random() * 3);
  }
  // occasional cracks
  ctx.strokeStyle = 'rgba(60,45,25,0.35)';
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    let x = Math.random() * size, y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  grain(ctx, size, 18);
  return toTexture(c, 3);
}

// ---- Wooden ammo crate ----
export function crateTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9c7638';
  ctx.fillRect(0, 0, size, size);
  // planks
  const planks = 5, ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y = p * ph;
    const tone = 120 + Math.random() * 40;
    ctx.fillStyle = `rgb(${tone}, ${tone - 34}, ${tone - 84})`;
    ctx.fillRect(0, y + 1, size, ph - 2);
    // wood grain lines
    ctx.strokeStyle = 'rgba(70,45,15,0.35)';
    for (let g = 0; g < 6; g++) {
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      const gy = y + 4 + Math.random() * (ph - 8);
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(size * 0.33, gy + (Math.random() - 0.5) * 6, size * 0.66, gy + (Math.random() - 0.5) * 6, size, gy);
      ctx.stroke();
    }
    // plank gap shadow
    ctx.fillStyle = 'rgba(40,26,8,0.6)';
    ctx.fillRect(0, y, size, 2);
  }
  // metal border frame
  ctx.strokeStyle = '#5a4622';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, size - 10, size - 10);
  // corner bolts
  ctx.fillStyle = '#3d3018';
  const bolts = [[14, 14], [size - 14, 14], [14, size - 14], [size - 14, size - 14]];
  for (const [x, y] of bolts) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  // stencil marking
  ctx.fillStyle = 'rgba(40,30,12,0.55)';
  ctx.font = 'bold 46px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('AMMO', size / 2, size / 2 + 4);
  ctx.font = 'bold 20px monospace';
  ctx.fillText('7.62 × 39', size / 2, size / 2 + 34);
  grain(ctx, size, 14);
  return toTexture(c, 1);
}

// ---- Concrete / stone block ----
export function concreteTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9d968a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 4 + Math.random() * 40;
    const s = 130 + Math.random() * 60;
    ctx.fillStyle = `rgba(${s},${s - 6},${s - 16},${0.05 + Math.random() * 0.1})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // pits
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(60,58,52,${0.2 + Math.random() * 0.3})`;
    ctx.beginPath(); ctx.arc(Math.random() * size, Math.random() * size, 0.5 + Math.random() * 2, 0, 7); ctx.fill();
  }
  grain(ctx, size, 20);
  return toTexture(c, 2);
}

// ---- Sandbag ----
export function sandbagTexture() {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8f7b4a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(60,48,24,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 5) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 3, size); ctx.stroke();
  }
  grain(ctx, size, 22);
  return toTexture(c, 1);
}

// ---- Sky dome gradient (procedural desert dusk) ----
export function skyTexture() {
  const w = 1024, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#2b3b57');   // upper atmosphere
  g.addColorStop(0.35, '#5f7591');
  g.addColorStop(0.55, '#b6b099');
  g.addColorStop(0.72, '#e6c98d');  // haze near horizon
  g.addColorStop(0.85, '#e9b56a');
  g.addColorStop(1.0, '#d69a4c');   // dusty horizon
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soft sun glow
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.62, 10, w * 0.72, h * 0.62, 240);
  sun.addColorStop(0, 'rgba(255,244,214,0.95)');
  sun.addColorStop(0.2, 'rgba(255,226,160,0.55)');
  sun.addColorStop(1, 'rgba(255,226,160,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // faint clouds
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w, y = h * (0.1 + Math.random() * 0.4), r = 30 + Math.random() * 120;
    ctx.fillStyle = `rgba(230,220,200,${0.02 + Math.random() * 0.05})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.3, 0, 0, 7); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// ---- Enemy body camo (T / CT tone) ----
export function camoTexture(kind = 't') {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const pal = kind === 'ct'
    ? ['#3a4a5a', '#2d3a47', '#4a5c6e', '#222c35']
    : ['#7a6a3a', '#5e5228', '#8f7d45', '#463c1c'];
  ctx.fillStyle = pal[0];
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = pal[1 + (Math.floor(Math.random() * 3))];
    const x = Math.random() * size, y = Math.random() * size, r = 8 + Math.random() * 22;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.6), Math.random() * 3, 0, 7);
    ctx.fill();
  }
  grain(ctx, size, 12);
  return toTexture(c, 1);
}

// ---- Metal (barrels, gun details) ----
export function metalTexture(base = '#4a4a4e') {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(${20 + Math.random() * 40|0},${20 + Math.random() * 40|0},${20 + Math.random() * 40|0},${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1 + Math.random() * 3);
  }
  // rust streaks
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(120,60,20,${0.05 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * size, 0, 1 + Math.random() * 2, size);
  }
  grain(ctx, size, 16);
  return toTexture(c, 1);
}

// Cache so we build each texture only once.
const cache = {};
export function tex(name, ...args) {
  const key = name + JSON.stringify(args);
  if (cache[key]) return cache[key];
  const builders = {
    sand: sandTexture, wall: wallTexture, crate: crateTexture,
    concrete: concreteTexture, sandbag: sandbagTexture, sky: skyTexture,
    camo: camoTexture, metal: metalTexture,
  };
  const t = builders[name](...args);
  cache[key] = t;
  return t;
}
