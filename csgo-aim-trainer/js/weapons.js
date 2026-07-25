// weapons.js — weapon definitions, procedural viewmodels and per-weapon feel.
import * as THREE from 'three';
import { tex } from './textures.js';

// Weapon stat table. damage is per-bullet; headshotMult applied on head hits.
// rpm = rounds/min, spread in radians (hip), recoil = vertical kick per shot.
export const WEAPON_DEFS = {
  ak: {
    id: 'ak', name: 'AK-47', slot: 1, key: '1',
    damage: 36, headshotMult: 4.0, rpm: 600, mag: 30, reserve: 90,
    reloadTime: 2.4, spread: 0.012, recoil: 0.028, recoilRecover: 0.12,
    auto: true, range: 200, pellets: 1, color: 0x2a2118, sound: 'ak',
  },
  m4: {
    id: 'm4', name: 'M4A4', slot: 2, key: '2',
    damage: 30, headshotMult: 4.0, rpm: 666, mag: 30, reserve: 90,
    reloadTime: 2.6, spread: 0.009, recoil: 0.020, recoilRecover: 0.14,
    auto: true, range: 200, pellets: 1, color: 0x33383b, sound: 'm4',
  },
  awp: {
    id: 'awp', name: 'AWP', slot: 3, key: '3',
    damage: 115, headshotMult: 2.4, rpm: 41, mag: 5, reserve: 25,
    reloadTime: 3.4, spread: 0.0009, recoil: 0.09, recoilRecover: 0.05,
    auto: false, range: 400, pellets: 1, color: 0x1d2f1d, sound: 'awp', scoped: true,
  },
  deagle: {
    id: 'deagle', name: 'Desert Eagle', slot: 4, key: '4',
    damage: 58, headshotMult: 3.2, rpm: 267, mag: 7, reserve: 35,
    reloadTime: 2.2, spread: 0.006, recoil: 0.05, recoilRecover: 0.10,
    auto: false, range: 250, pellets: 1, color: 0xb8862b, sound: 'deagle',
  },
  smg: {
    id: 'smg', name: 'MP9', slot: 5, key: '5',
    damage: 21, headshotMult: 3.0, rpm: 857, mag: 30, reserve: 120,
    reloadTime: 2.0, spread: 0.016, recoil: 0.014, recoilRecover: 0.16,
    auto: true, range: 150, pellets: 1, color: 0x2b2b2e, sound: 'smg',
  },
};

export const LOADOUT = ['ak', 'm4', 'awp', 'deagle', 'smg'];

// ---- Procedural gun mesh builders (low-poly but recognizable silhouettes) ----
// A small emissive lift keeps the viewmodel readable even in shadow.
function metalMat(color = 0x2a2118, rough = 0.55, metal = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: tex('metal', '#3a3a3e'), emissive: new THREE.Color(color).multiplyScalar(0.28) });
}
function plasticMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, emissive: new THREE.Color(color).multiplyScalar(0.28) });
}
function woodMat() {
  return new THREE.MeshStandardMaterial({ map: tex('crate'), roughness: 0.8, metalness: 0.05, color: 0xffe0b0, emissive: 0x2a1e10 });
}

function part(group, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}

function buildAK() {
  const g = new THREE.Group();
  const metal = metalMat(0x20242a, 0.5, 0.8);
  const wood = woodMat();
  part(g, new THREE.BoxGeometry(0.09, 0.11, 1.15), metal, 0, 0, -0.35);          // receiver
  part(g, new THREE.BoxGeometry(0.07, 0.07, 0.7), metal, 0, 0.005, -1.0);        // barrel
  part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8), metal, 0, 0.01, -1.45, Math.PI / 2, 0, 0); // muzzle
  part(g, new THREE.BoxGeometry(0.08, 0.09, 0.42), wood, 0, 0, 0.05);            // upper handguard
  part(g, new THREE.BoxGeometry(0.09, 0.10, 0.2), wood, 0, -0.02, 0.02);         // lower handguard
  const mag = part(g, new THREE.BoxGeometry(0.08, 0.32, 0.14), metal, 0, -0.22, -0.18, -0.35, 0, 0); // curved mag
  mag.material = plasticMat(0x3a2c14);
  part(g, new THREE.BoxGeometry(0.07, 0.16, 0.1), plasticMat(0x1a1a1c), 0, -0.11, 0.02); // grip
  part(g, new THREE.BoxGeometry(0.07, 0.1, 0.5), wood, 0, 0.0, 0.55);            // stock
  part(g, new THREE.BoxGeometry(0.02, 0.06, 0.02), metal, 0, 0.09, -1.15);       // front sight
  return g;
}

function buildM4() {
  const g = new THREE.Group();
  const metal = metalMat(0x33383b, 0.45, 0.8);
  const black = plasticMat(0x1c1e20);
  part(g, new THREE.BoxGeometry(0.09, 0.10, 1.0), black, 0, 0, -0.3);
  part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.75, 10), metal, 0, 0.01, -1.05, Math.PI / 2, 0, 0); // barrel shroud
  part(g, new THREE.CylinderGeometry(0.028, 0.028, 0.2, 8), metal, 0, 0.01, -1.5, Math.PI / 2, 0, 0);    // muzzle
  part(g, new THREE.BoxGeometry(0.075, 0.28, 0.13), black, 0, -0.2, -0.12, -0.15, 0, 0);                 // mag
  part(g, new THREE.BoxGeometry(0.07, 0.16, 0.1), black, 0, -0.11, 0.08);                                // grip
  part(g, new THREE.BoxGeometry(0.08, 0.11, 0.42), black, 0, 0.0, 0.55);                                 // stock
  part(g, new THREE.BoxGeometry(0.03, 0.05, 0.5), black, 0, 0.08, -0.35);                                // carry rail
  part(g, new THREE.BoxGeometry(0.02, 0.05, 0.02), metal, 0, 0.11, -0.15);                               // rear sight
  return g;
}

function buildAWP() {
  const g = new THREE.Group();
  const green = plasticMat(0x24361f);
  const metal = metalMat(0x15181a, 0.4, 0.85);
  part(g, new THREE.BoxGeometry(0.10, 0.13, 1.3), green, 0, 0, -0.2);            // long body
  part(g, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 10), metal, 0, 0.02, -1.1, Math.PI / 2, 0, 0); // long barrel
  part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8), metal, 0, 0.02, -1.62, Math.PI / 2, 0, 0); // muzzle brake
  // scope
  part(g, new THREE.CylinderGeometry(0.06, 0.06, 0.42, 12), metal, 0, 0.13, -0.35, Math.PI / 2, 0, 0);
  part(g, new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), metal, 0, 0.13, -0.56, Math.PI / 2, 0, 0);
  part(g, new THREE.BoxGeometry(0.09, 0.30, 0.14), green, 0, -0.2, 0.05);        // mag
  part(g, new THREE.BoxGeometry(0.07, 0.16, 0.1), plasticMat(0x14140f), 0, -0.11, 0.2); // grip
  part(g, new THREE.BoxGeometry(0.10, 0.16, 0.55), green, 0, 0.0, 0.75);         // stock (thumbhole-ish)
  return g;
}

function buildDeagle() {
  const g = new THREE.Group();
  const gold = metalMat(0xc79a3a, 0.35, 0.9);
  const black = plasticMat(0x1a1a1c);
  part(g, new THREE.BoxGeometry(0.08, 0.13, 0.5), gold, 0, 0.02, -0.15);         // slide
  part(g, new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8), gold, 0, 0.03, -0.44, Math.PI / 2, 0, 0); // barrel
  part(g, new THREE.BoxGeometry(0.07, 0.2, 0.09), black, 0, -0.13, 0.06, 0.35, 0, 0); // grip
  part(g, new THREE.BoxGeometry(0.06, 0.06, 0.14), gold, 0, -0.04, 0.12);        // frame
  part(g, new THREE.BoxGeometry(0.02, 0.03, 0.02), black, 0, 0.10, -0.36);       // front sight
  return g;
}

function buildSMG() {
  const g = new THREE.Group();
  const black = plasticMat(0x232326);
  const metal = metalMat(0x2b2b2e, 0.5, 0.7);
  part(g, new THREE.BoxGeometry(0.08, 0.11, 0.6), black, 0, 0, -0.15);
  part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), metal, 0, 0.01, -0.55, Math.PI / 2, 0, 0);
  part(g, new THREE.BoxGeometry(0.065, 0.26, 0.11), black, 0, -0.18, 0.02, -0.1, 0, 0); // mag
  part(g, new THREE.BoxGeometry(0.06, 0.14, 0.09), black, 0, -0.09, 0.14);       // grip
  part(g, new THREE.BoxGeometry(0.06, 0.09, 0.3), metal, 0, 0.0, 0.42);          // folding stock
  return g;
}

const BUILDERS = { ak: buildAK, m4: buildM4, awp: buildAWP, deagle: buildDeagle, smg: buildSMG };

// A muzzle flash sprite reused by all weapons.
function makeMuzzleFlash() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
  const star = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), mat.clone());
  star.rotation.x = -Math.PI / 2;
  star.position.z = -0.2;
  g.add(core, star);
  g.visible = false;
  return g;
}

export class WeaponManager {
  constructor(camera, audio) {
    this.camera = camera;
    this.audio = audio;
    this.viewGroup = new THREE.Group();  // parented to camera
    camera.add(this.viewGroup);
    // Dedicated short-range light so the gun is always lit; small range keeps
    // it from noticeably spilling onto world geometry.
    const vmLight = new THREE.PointLight(0xfff2dc, 1.8, 3.2, 2);
    vmLight.position.set(0.15, 0.1, -0.5);
    this.viewGroup.add(vmLight);
    this.models = {};
    this.state = {};   // per-weapon ammo state
    this.current = null;
    this.lastShot = 0;
    this.reloading = false;
    this.reloadEnd = 0;
    this.recoilOffset = 0;   // accumulated vertical recoil (radians)
    this.kick = 0;           // viewmodel kick animation
    this.swayT = 0;
    this.onReloadDone = null;

    for (const id of LOADOUT) {
      const model = BUILDERS[id]();
      model.scale.setScalar(0.82);
      model.visible = false;
      // position in lower-right of view
      model.position.set(0.24, -0.2, -0.5);
      this.viewGroup.add(model);
      const flash = makeMuzzleFlash();
      // attach flash to muzzle (approx front of model)
      flash.position.set(0, 0.02, id === 'awp' ? -1.65 : id === 'deagle' ? -0.5 : -1.5);
      model.add(flash);
      this.models[id] = { model, flash, def: WEAPON_DEFS[id] };
      this.state[id] = { mag: WEAPON_DEFS[id].mag, reserve: WEAPON_DEFS[id].reserve };
    }
  }

  reset() {
    for (const id of LOADOUT) {
      this.state[id] = { mag: WEAPON_DEFS[id].mag, reserve: WEAPON_DEFS[id].reserve };
    }
    this.reloading = false;
    this.recoilOffset = 0;
  }

  equip(id, force = false) {
    if (!this.models[id]) return;
    if (this.current === id && !force) return WEAPON_DEFS[id];
    this.reloading = false;
    document.getElementById('reload-hint').classList.add('hidden');
    if (this.current) this.models[this.current].model.visible = false;
    this.current = id;
    this.models[id].model.visible = true;
    this.kick = 0.25;  // little equip nudge
    return WEAPON_DEFS[id];
  }

  get def() { return WEAPON_DEFS[this.current]; }
  get ammo() { return this.state[this.current]; }

  canFire(now) {
    if (this.reloading) return false;
    const def = this.def;
    const interval = 60000 / def.rpm;
    if (now - this.lastShot < interval) return false;
    if (this.ammo.mag <= 0) return false;
    return true;
  }

  // Returns { fired: bool, dry: bool }. Actual raycast is done by caller.
  fire(now) {
    if (this.reloading) return { fired: false };
    if (this.ammo.mag <= 0) {
      if (now - this.lastShot > 120) { this.audio.dryFire(); this.lastShot = now; }
      return { fired: false, dry: true };
    }
    if (!this.canFire(now)) return { fired: false };
    this.lastShot = now;
    this.ammo.mag--;
    const def = this.def;
    this.audio.shoot(def.sound);
    // recoil + viewmodel kick
    this.recoilOffset += def.recoil;
    this.kick = Math.min(0.6, this.kick + def.recoil * 6 + 0.12);
    this._showFlash();
    // auto-reload prompt when empty handled by caller
    return { fired: true, def };
  }

  _showFlash() {
    const { flash } = this.models[this.current];
    flash.visible = true;
    flash.children.forEach(c => { c.material.opacity = 1; });
    flash.rotation.z = Math.random() * Math.PI;
    const s = 0.8 + Math.random() * 0.6;
    flash.scale.setScalar(s);
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => { flash.visible = false; }, 45);
  }

  startReload() {
    if (this.reloading) return false;
    const def = this.def, st = this.ammo;
    if (st.mag >= def.mag || st.reserve <= 0) return false;
    this.reloading = true;
    this.reloadEnd = performance.now() + def.reloadTime * 1000;
    this.audio.reload(def.sound);
    document.getElementById('reload-hint').classList.remove('hidden');
    return true;
  }

  update(dt, now, moveState) {
    // finish reload
    if (this.reloading && now >= this.reloadEnd) {
      this.reloading = false;
      const def = this.def, st = this.ammo;
      const need = def.mag - st.mag;
      const take = Math.min(need, st.reserve);
      st.mag += take;
      st.reserve -= take;
      document.getElementById('reload-hint').classList.add('hidden');
      if (this.onReloadDone) this.onReloadDone();
    }
    // recoil recovery
    this.recoilOffset = Math.max(0, this.recoilOffset - this.def.recoilRecover * dt * 8);
    // viewmodel kick recovery
    this.kick *= Math.pow(0.0001, dt); // fast decay
    if (this.kick < 0.001) this.kick = 0;

    // weapon sway based on movement
    this.swayT += dt * (moveState?.speed || 0) * 3;
    const model = this.models[this.current]?.model;
    if (model) {
      const bobX = Math.cos(this.swayT) * 0.006 * (moveState?.speed || 0);
      const bobY = Math.abs(Math.sin(this.swayT)) * 0.006 * (moveState?.speed || 0);
      const reloadDip = this.reloading ? -0.12 : 0;
      model.position.set(0.24 + bobX, -0.2 + bobY + reloadDip - this.kick * 0.12, -0.5 + this.kick * 0.18);
      // Builders point the barrel toward -Z (camera forward), so no 180° flip.
      model.rotation.set(this.kick * 0.5 + (this.reloading ? 0.5 : 0), bobX * 0.5, this.reloading ? 0.4 : 0);
    }
  }

  // Current effective spread given movement & recoil (radians).
  currentSpread(moveState) {
    const def = this.def;
    let s = def.spread;
    if (moveState) s += moveState.speed * 0.004;           // moving hurts accuracy
    if (moveState && moveState.airborne) s += 0.03;        // jumping is terrible
    return s;
  }
}
