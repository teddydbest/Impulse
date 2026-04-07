import * as THREE from 'three';

function nearest(tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function checkerTex(c1 = '#181828', c2 = '#121222', tiles = 8, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const ts = size / tiles;
  for (let x = 0; x < tiles; x++) {
    for (let y = 0; y < tiles; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x * ts, y * ts, ts, ts);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return nearest(t);
}

export function brickTex(bg = '#2a2a3c', line = '#1a1a2c', size = 64) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size / 2;
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = line;
  // mortar horizontals
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, h / 2 - 1, w, 2);
  ctx.fillRect(0, h - 1, w, 1);
  // mortar verticals – staggered
  const bw = w / 2;
  ctx.fillRect(bw - 1, 0, 2, h / 2);
  ctx.fillRect(0, h / 2, 2, h / 2);
  ctx.fillRect(w - 2, h / 2, 2, h / 2);

  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return nearest(t);
}

export function woodTex(bg = '#6b4a1f', grain = '#5a3c18', size = 64) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = grain;
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return nearest(t);
}

export function marbleTex(bg = '#e8e0d0', vein = '#c8c0b0', size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = vein;
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, 0);
    ctx.lineTo(Math.random() * size, size);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return nearest(t);
}

export function solidColorTex(hex, size = 4) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  return nearest(new THREE.CanvasTexture(cv));
}

export function screenIdleTex(size = 128) {
  const cv = document.createElement('canvas');
  cv.width = size * 2; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, cv.width, cv.height);
  // scan lines
  ctx.fillStyle = '#0a0a10';
  for (let y = 0; y < cv.height; y += 4) {
    ctx.fillRect(0, y, cv.width, 2);
  }
  // "NO SIGNAL" text area
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(cv.width / 2 - 60, cv.height / 2 - 12, 120, 24);
  return nearest(new THREE.CanvasTexture(cv));
}
