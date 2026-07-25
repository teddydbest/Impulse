// map.js — builds a Dust2-inspired desert arena out of textured boxes.
// Exposes the walkable arena bounds and an array of AABB colliders used by
// both the player and enemies for movement + shooting cover.
import * as THREE from 'three';
import { tex } from './textures.js';

export class GameMap {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];   // { box: THREE.Box3, mesh } — solid obstacles
    this.coverPoints = []; // suggested spots near cover for spawns
    this.arena = { minX: -58, maxX: 58, minZ: -58, maxZ: 58 };
    this.solids = [];      // meshes raycast-able for bullets (walls/crates)
    this.build();
  }

  _mat(texName, ...args) {
    return new THREE.MeshStandardMaterial({
      map: tex(texName, ...args),
      roughness: 0.95,
      metalness: 0.02,
    });
  }

  // Add a solid box obstacle at (x, z), sized (w,h,d), centered vertically on h.
  _box(x, z, w, h, d, texName, texArgs = [], y = null) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this._mat(texName, ...texArgs);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y === null ? h / 2 : y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    this.colliders.push({ box, mesh: m });
    this.solids.push(m);
    return m;
  }

  build() {
    const A = this.arena;
    const W = A.maxX - A.minX;
    const D = A.maxZ - A.minZ;

    // ---------- Ground ----------
    const groundMat = new THREE.MeshStandardMaterial({ map: tex('sand'), roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Far dunes ring (non-colliding backdrop)
    const duneMat = new THREE.MeshStandardMaterial({ map: tex('sand'), roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2;
      const r = 150 + Math.random() * 40;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(20 + Math.random() * 30, 10, 6), duneMat);
      dune.position.set(Math.cos(ang) * r, -8 - Math.random() * 6, Math.sin(ang) * r);
      dune.scale.y = 0.35;
      this.scene.add(dune);
    }

    // ---------- Perimeter walls ----------
    const wallH = 14, wt = 3;
    this._box((A.minX + A.maxX) / 2, A.minZ - wt / 2, W + wt * 2, wallH, wt, 'wall');       // north
    this._box((A.minX + A.maxX) / 2, A.maxZ + wt / 2, W + wt * 2, wallH, wt, 'wall');       // south
    this._box(A.minX - wt / 2, (A.minZ + A.maxZ) / 2, wt, wallH, D + wt * 2, 'wall', ['#a8905c']); // west
    this._box(A.maxX + wt / 2, (A.minZ + A.maxZ) / 2, wt, wallH, D + wt * 2, 'wall', ['#a8905c']); // east

    // ---------- Buildings (like Dust2 bombsite structures) ----------
    // Big double-door building (north) with an open interior for line-of-sight breaks
    this._building(-30, -34, 26, 9, 16);
    // Squat CT-side hut (south east)
    this._building(34, 30, 20, 7, 18);
    // Long site A platform (west)
    this._box(-46, 6, 14, 3.2, 26, 'concrete', [], 1.6);  // raised platform
    this._box(-46, 6 - 14, 14, 6, 2, 'wall');             // platform back wall

    // Central bombsite mound with crates (the iconic "double stack")
    this._crateStack(2, 0);
    this._crateStack(8, -3, 1);
    this._crateStack(-4, 5);

    // ---------- Scattered crates & barrels for cover ----------
    const crateSpots = [
      [20, 12], [22, 16], [-18, 18], [-24, 14], [14, -20], [18, -24],
      [-14, -12], [-8, -20], [30, -6], [-34, -8], [40, 18], [-40, 24],
      [6, 26], [-2, 34], [26, -30], [-28, 34],
    ];
    for (const [x, z] of crateSpots) {
      const s = 2.6 + Math.random() * 0.6;
      const stacked = Math.random() < 0.4;
      this._box(x, z, s, s, s, 'crate');
      if (stacked) this._box(x + (Math.random() - 0.5), z + (Math.random() - 0.5), s * 0.8, s * 0.8, s * 0.8, 'crate');
      this.coverPoints.push(new THREE.Vector3(x, 0, z));
    }

    // Barrels
    const barrelMat = new THREE.MeshStandardMaterial({ map: tex('metal', '#7a3d22'), roughness: 0.7, metalness: 0.4 });
    const barrelSpots = [[12, 8], [-10, -6], [28, 22], [-30, 12], [16, 30], [-20, -28], [36, -20]];
    for (const [x, z] of barrelSpots) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3, 16), barrelMat);
      b.position.set(x, 1.5, z);
      b.castShadow = true; b.receiveShadow = true;
      this.scene.add(b);
      b.updateMatrixWorld(true);
      this.colliders.push({ box: new THREE.Box3().setFromObject(b), mesh: b });
      this.solids.push(b);
      this.coverPoints.push(new THREE.Vector3(x, 0, z));
    }

    // Sandbag walls (low cover)
    this._sandbags(0, -22, 8, 0);
    this._sandbags(-38, 0, 6, Math.PI / 2);
    this._sandbags(38, -2, 6, Math.PI / 2);

    // A couple of archways for silhouette / depth
    this._arch(-16, -34);
    this._arch(24, 34);

    // Precompute cover points from all colliders for spawns
    for (const c of this.colliders) {
      const ctr = c.box.getCenter(new THREE.Vector3());
      if (Math.abs(ctr.x) < A.maxX - 6 && Math.abs(ctr.z) < A.maxZ - 6) {
        this.coverPoints.push(ctr.clone().setY(0));
      }
    }
  }

  _building(x, z, w, h, d) {
    const t = 0.8;
    // four walls with a doorway gap on the +z face
    this._box(x, z - d / 2, w, h, t, 'wall');                 // back
    this._box(x - w / 2, z, t, h, d, 'wall', ['#a8905c']);    // left
    this._box(x + w / 2, z, t, h, d, 'wall', ['#a8905c']);    // right
    // front with a door gap (two segments)
    const doorW = 5;
    const seg = (w - doorW) / 2;
    this._box(x - (doorW / 2 + seg / 2), z + d / 2, seg, h, t, 'wall');
    this._box(x + (doorW / 2 + seg / 2), z + d / 2, seg, h, t, 'wall');
    // lintel above door
    this._box(x, z + d / 2, doorW, h - 5, t, 'wall', [], h - (h - 5) / 2);
    // flat roof
    this._box(x, z, w, t, d, 'concrete', [], h);
  }

  _crateStack(x, z, extra = 0) {
    this._box(x, z, 3, 3, 3, 'crate');
    this._box(x, z, 3, 3, 3, 'crate', [], 4.5);
    if (extra) this._box(x + 3, z, 3, 3, 3, 'crate');
    this.coverPoints.push(new THREE.Vector3(x, 0, z));
  }

  _sandbags(x, z, count, rot) {
    const mat = new THREE.MeshStandardMaterial({ map: tex('sandbag'), roughness: 1 });
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      for (let row = 0; row < 2; row++) {
        const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 4, 8), mat);
        bag.rotation.z = Math.PI / 2;
        bag.position.set((i - count / 2) * 1.5 + (row * 0.6), 0.55 + row * 1.0, 0);
        bag.castShadow = true; bag.receiveShadow = true;
        group.add(bag);
      }
    }
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    this.scene.add(group);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, mesh: group });
    this.solids.push(...group.children);
    this.coverPoints.push(new THREE.Vector3(x, 0, z));
  }

  _arch(x, z) {
    const t = 1.2, h = 9, span = 7;
    this._box(x - span / 2, z, t, h, t, 'wall', ['#a8905c']);
    this._box(x + span / 2, z, t, h, t, 'wall', ['#a8905c']);
    this._box(x, z, span + t, t, t, 'wall', [], h);
  }

  // Resolve a horizontal position against all colliders (radius = player/enemy width).
  resolveCollision(pos, radius, yBottom, yTop) {
    for (const c of this.colliders) {
      const b = c.box;
      // vertical overlap test (so you can stand on nothing here — obstacles are tall)
      if (yTop < b.min.y || yBottom > b.max.y) continue;
      const closestX = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const closestZ = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = (radius - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
    // arena bounds
    pos.x = Math.max(this.arena.minX + radius, Math.min(this.arena.maxX - radius, pos.x));
    pos.z = Math.max(this.arena.minZ + radius, Math.min(this.arena.maxZ - radius, pos.z));
    return pos;
  }

  // Random spawn point near cover, at the arena edges, away from `avoid`.
  randomSpawn(avoid, minDist = 22) {
    for (let tries = 0; tries < 40; tries++) {
      const edge = Math.floor(Math.random() * 4);
      let x, z;
      const m = 8;
      if (edge === 0) { x = this.arena.minX + m + Math.random() * 6; z = this.arena.minZ + m + Math.random() * (D() - 2 * m); }
      else if (edge === 1) { x = this.arena.maxX - m - Math.random() * 6; z = this.arena.minZ + m + Math.random() * (D() - 2 * m); }
      else if (edge === 2) { z = this.arena.minZ + m + Math.random() * 6; x = this.arena.minX + m + Math.random() * (Wd() - 2 * m); }
      else { z = this.arena.maxZ - m - Math.random() * 6; x = this.arena.minX + m + Math.random() * (Wd() - 2 * m); }
      const p = new THREE.Vector3(x, 0, z);
      if (p.distanceTo(avoid) < minDist) continue;
      if (this._blocked(p, 1.4)) continue;
      return p;
    }
    // fallback
    return new THREE.Vector3(this.arena.minX + 6, 0, 0);

    function D() { return 58 * 2; }
    function Wd() { return 58 * 2; }
  }

  _blocked(pos, radius) {
    for (const c of this.colliders) {
      const b = c.box;
      const closestX = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const closestZ = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - closestX, dz = pos.z - closestZ;
      if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
  }
}
