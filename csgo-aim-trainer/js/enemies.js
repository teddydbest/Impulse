// enemies.js — bot enemies, boss types, and the wave director.
import * as THREE from 'three';
import { tex } from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);

// Enemy archetypes. hp/speed/dmg scale up per wave in the director.
const ENEMY_TYPES = {
  grunt:   { hp: 100, speed: 4.2,  dmg: 8,  fireRate: 1.1, accuracy: 0.55, scale: 1.0,  camo: 't',  points: 100, headScale: 1 },
  rusher:  { hp: 70,  speed: 7.0,  dmg: 12, fireRate: 0.0, accuracy: 0.0,  scale: 0.95, camo: 't',  points: 120, melee: true, headScale: 1 },
  marks:   { hp: 90,  speed: 3.0,  dmg: 18, fireRate: 1.9, accuracy: 0.8,  scale: 1.0,  camo: 'ct', points: 160, ranged: 'precise', headScale: 1 },
  heavy:   { hp: 260, speed: 2.6,  dmg: 16, fireRate: 0.9, accuracy: 0.5,  scale: 1.3,  camo: 'ct', points: 250, headScale: 0.9 },
};

// Boss archetypes.
const BOSS_TYPES = {
  juggernaut: { hp: 2600, speed: 3.0, dmg: 26, fireRate: 0.6, accuracy: 0.6, scale: 2.4, camo: 'ct', points: 2500, name: 'JUGGERNAUT', headScale: 0.8 },
  warlord:    { hp: 3600, speed: 4.2, dmg: 20, fireRate: 1.4, accuracy: 0.7, scale: 2.1, camo: 't',  points: 3500, name: 'DESERT WARLORD', headScale: 0.85 },
  reaper:     { hp: 3000, speed: 6.0, dmg: 30, fireRate: 0.0, accuracy: 0,   scale: 2.0, camo: 't',  points: 4000, name: 'THE REAPER', melee: true, headScale: 0.9 },
};

let _uid = 1;

export class Enemy {
  constructor(scene, type, opts = {}) {
    this.scene = scene;
    this.id = _uid++;
    this.type = type;
    this.isBoss = !!opts.isBoss;
    this.def = opts.def;
    this.maxHp = opts.hp;
    this.hp = opts.hp;
    this.speed = opts.speed;
    this.dmg = opts.dmg;
    this.fireRate = opts.fireRate;   // shots/sec, 0 = melee only
    this.accuracy = opts.accuracy;
    this.melee = opts.melee;
    this.ranged = opts.ranged;
    this.points = opts.points;
    this.scaleF = opts.scale;
    this.dead = false;
    this.fireCd = Math.random() * 1.5;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = Math.random() * 3;
    this.hurtFlash = 0;
    this.hitMeshes = [];   // { mesh, head }
    this._buildMesh(opts.camo, opts.headScale || 1);
    scene.add(this.group);
  }

  _buildMesh(camo, headScale) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ map: tex('camo', camo), roughness: 0.85, metalness: 0.05 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc99b6e, roughness: 0.8 });
    const gearMat = new THREE.MeshStandardMaterial({ color: this.isBoss ? 0x1a1a1c : 0x2a2620, roughness: 0.7, metalness: 0.2 });

    // Torso (hit: body)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 12), bodyMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    torso.userData = { enemy: this, part: 'body', mult: 1 };
    g.add(torso); this.hitMeshes.push(torso);

    // Vest
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.42), gearMat);
    vest.position.y = 1.2;
    vest.userData = { enemy: this, part: 'body', mult: 1 };
    g.add(vest); this.hitMeshes.push(vest);

    // Head (hit: head — headshot)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22 * headScale, 12, 12), skinMat);
    head.position.y = 1.78;
    head.castShadow = true;
    head.userData = { enemy: this, part: 'head', mult: 1 };
    g.add(head); this.hitMeshes.push(head);
    // Helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24 * headScale, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), gearMat);
    helmet.position.y = 1.82;
    helmet.userData = { enemy: this, part: 'head', mult: 1 };
    g.add(helmet); this.hitMeshes.push(helmet);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ map: tex('camo', camo), roughness: 0.9 });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.6, 4, 8), legMat);
      leg.position.set(side * 0.16, 0.45, 0);
      leg.userData = { enemy: this, part: 'leg', mult: 0.75 };
      g.add(leg); this.hitMeshes.push(leg);
    }
    // Arms + a little gun prop
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), bodyMat);
      arm.position.set(side * 0.42, 1.2, 0.05);
      arm.rotation.x = -0.5;
      arm.userData = { enemy: this, part: 'arm', mult: 0.85 };
      g.add(arm); this.hitMeshes.push(arm);
    }
    if (!this.melee) {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, metalness: 0.6 }));
      gun.position.set(0.28, 1.05, -0.35);
      g.add(gun);
      this.gunMesh = gun;
    } else {
      // reaper/rusher get a blade
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.9 }));
      blade.position.set(0.34, 1.1, -0.25);
      blade.rotation.x = -0.6;
      g.add(blade);
    }

    // Boss aura ring
    if (this.isBoss) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.9, 24),
        new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
      this.auraRing = ring;
    }

    // store base materials for hurt flash
    this._mats = [];
    g.traverse(o => { if (o.isMesh && o.material && o.material.emissive) this._mats.push(o.material); });

    g.scale.setScalar(this.scaleF);
    g.userData.enemy = this;
    this.group = g;
    this.head = head;
    this.torso = torso;

    // Health bar (billboard)
    this._buildHealthBar();
  }

  _buildHealthBar() {
    const w = this.isBoss ? 2.4 : 0.9;
    const cont = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.12), new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.85, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false }));
    fg.position.z = 0.001;
    bg.renderOrder = 998; fg.renderOrder = 999;
    cont.add(bg); cont.add(fg);
    cont.position.y = (this.isBoss ? 2.3 : 2.15);
    this.group.add(cont);
    this.hpBar = { cont, fg, w };
    if (!this.isBoss) cont.visible = false; // only show trash-mob bars when damaged
  }

  get position() { return this.group.position; }

  // Apply damage; returns { dead, headshot, points }
  takeDamage(amount, head) {
    if (this.dead) return { dead: false };
    this.hp -= amount;
    this.hurtFlash = 0.12;
    if (this.hpBar) {
      this.hpBar.cont.visible = true;
      this.hpBar.fg.scale.x = Math.max(0, this.hp / this.maxHp);
      this.hpBar.fg.position.x = -this.hpBar.w * (1 - Math.max(0, this.hp / this.maxHp)) / 2;
    }
    if (this.hp <= 0) {
      this.dead = true;
      return { dead: true, headshot: head, points: this.points + (head ? 50 : 0) };
    }
    return { dead: false, headshot: head };
  }

  update(dt, playerPos, arena, onShoot, hasLOS) {
    if (this.dead) return;
    const g = this.group;
    const toPlayer = new THREE.Vector3().subVectors(playerPos, g.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    toPlayer.normalize();

    // Face the player
    const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
    g.rotation.y = targetYaw;

    // Movement behavior
    const desiredRange = this.melee ? 1.4 : (this.ranged === 'precise' ? 28 : 16);
    let move = new THREE.Vector3();
    if (dist > desiredRange) {
      move.add(toPlayer);
    } else if (dist < desiredRange - 4 && !this.melee) {
      move.sub(toPlayer); // back off a bit
    }
    // strafe to feel alive
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = 1 + Math.random() * 2.5; }
    const strafe = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this.strafeDir * 0.5);
    if (!this.melee) move.add(strafe);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * dt);
      const next = g.position.clone().add(move);
      arena.resolveCollision(next, 0.5 * this.scaleF, 0, 2.0);
      g.position.x = next.x;
      g.position.z = next.z;
    }
    g.position.y = 0;

    // Little idle bob
    g.position.y = Math.abs(Math.sin(performance.now() * 0.004 + this.id)) * 0.04;

    // Attack
    this.fireCd -= dt;
    if (this.melee) {
      if (dist < 2.0 && this.fireCd <= 0) {
        onShoot(this, this.dmg, true);
        this.fireCd = 0.8;
      }
    } else if (this.fireRate > 0 && dist < 60 && hasLOS && this.fireCd <= 0) {
      onShoot(this, this.dmg, false);
      this.fireCd = 1 / this.fireRate * (0.8 + Math.random() * 0.5);
      this._muzzle();
    }

    // hurt flash decay
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt;
      const on = this.hurtFlash > 0;
      this.group.traverse(o => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(on ? 0x661111 : 0x000000); });
    }
    if (this.auraRing) { this.auraRing.rotation.z += dt * 2; this.auraRing.scale.setScalar(1 + Math.sin(performance.now() * 0.005) * 0.08); }
  }

  _muzzle() {
    if (!this.gunMesh) return;
    const flash = new THREE.PointLight(0xffcc66, 3, 6, 2);
    flash.position.set(0, 1.1, -0.5);
    this.group.add(flash);
    setTimeout(() => this.group.remove(flash), 50);
  }

  // Billboard the health bar toward camera each frame.
  faceBar(camera) {
    if (this.hpBar && this.hpBar.cont.visible) this.hpBar.cont.quaternion.copy(camera.quaternion);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) { o.geometry.dispose(); }
    });
  }
}

// ---- Death effect: quick ragdoll-ish scatter + fade ----
export class DeathFX {
  constructor(scene, position, color = 0x8a3b2a) {
    this.scene = scene;
    this.parts = [];
    this.life = 0;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat.clone());
      p.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5), 1 + Math.random(), (Math.random() - 0.5)));
      p.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4);
      scene.add(p);
      this.parts.push(p);
    }
    this.done = false;
  }
  update(dt) {
    this.life += dt;
    for (const p of this.parts) {
      p.userData.vel.y -= 9.8 * dt;
      p.position.addScaledVector(p.userData.vel, dt);
      if (p.position.y < 0.06) { p.position.y = 0.06; p.userData.vel.multiplyScalar(0.3); p.userData.vel.y *= -0.3; }
      p.rotation.x += dt * 6; p.rotation.y += dt * 4;
      p.material.opacity = Math.max(0, 1 - this.life / 1.2);
    }
    if (this.life > 1.2) {
      this.done = true;
      for (const p of this.parts) { this.scene.remove(p); p.geometry.dispose(); }
    }
  }
}

// ==================== Wave Director ====================
export class WaveDirector {
  constructor(scene, map, difficulty = 'normal', mode = 'waves') {
    this.scene = scene;
    this.map = map;
    this.difficulty = difficulty;
    this.mode = mode;
    this.wave = 0;
    this.enemies = [];
    this.deathFX = [];
    this.pendingSpawns = [];
    this.spawnTimer = 0;
    this.state = 'idle';       // idle | intermission | spawning | fighting | boss
    this.intermission = 0;
    this.onBanner = null;
    this.onWaveClear = null;
    this.onBossSpawn = null;
    this.diffMult = difficulty === 'easy' ? 0.75 : difficulty === 'hard' ? 1.35 : 1.0;
    this.aliveCount = 0;
  }

  startNextWave() {
    this.wave++;
    const isBoss = this.wave % 5 === 0;
    this.state = isBoss ? 'boss' : 'spawning';
    if (isBoss) this._queueBoss();
    else this._queueWave();
    if (this.onBanner) this.onBanner(this.wave, isBoss);
  }

  _waveScale() {
    // enemy stat multiplier grows with waves
    return (1 + (this.wave - 1) * 0.11) * this.diffMult;
  }

  _queueWave() {
    const scale = this._waveScale();
    const count = Math.min(4 + Math.floor(this.wave * 1.6), 22);
    const roster = [];
    for (let i = 0; i < count; i++) {
      let type = 'grunt';
      const r = Math.random();
      if (this.wave >= 2 && r < 0.22) type = 'rusher';
      if (this.wave >= 3 && r >= 0.22 && r < 0.40) type = 'marks';
      if (this.wave >= 4 && r >= 0.85) type = 'heavy';
      roster.push(type);
    }
    // stagger spawns so they trickle in
    let t = 0;
    for (const type of roster) {
      this.pendingSpawns.push({ type, at: t });
      t += 0.35 + Math.random() * 0.6;
    }
    this.spawnTimer = 0;
  }

  _queueBoss() {
    const keys = Object.keys(BOSS_TYPES);
    const bossKey = keys[(this.wave / 5 - 1) % keys.length | 0];
    this.pendingSpawns.push({ type: bossKey, at: 0.5, boss: true });
    // add a few adds alongside the boss
    const adds = 2 + Math.floor(this.wave / 5);
    for (let i = 0; i < adds; i++) this.pendingSpawns.push({ type: Math.random() < 0.5 ? 'grunt' : 'rusher', at: 1 + i * 0.8 });
    this._bossKey = bossKey;
  }

  _spawn(type, isBoss, playerPos) {
    const base = isBoss ? BOSS_TYPES[type] : ENEMY_TYPES[type];
    const scale = isBoss ? this.diffMult * (1 + (this.wave / 5 - 1) * 0.25) : this._waveScale();
    const opts = {
      isBoss,
      def: base,
      hp: Math.round(base.hp * scale),
      speed: base.speed * (isBoss ? 1 : Math.min(1.4, 0.9 + this.wave * 0.02)),
      dmg: Math.round(base.dmg * (isBoss ? this.diffMult : Math.min(2, this.diffMult * (1 + this.wave * 0.03)))),
      fireRate: base.fireRate,
      accuracy: base.accuracy,
      melee: base.melee,
      ranged: base.ranged,
      points: base.points,
      scale: base.scale,
      camo: base.camo,
      headScale: base.headScale,
    };
    const e = new Enemy(this.scene, type, opts);
    const spawn = this.map.randomSpawn(playerPos, isBoss ? 30 : 22);
    e.group.position.copy(spawn);
    this.enemies.push(e);
    if (isBoss && this.onBossSpawn) this.onBossSpawn(base.name, e);
    return e;
  }

  update(dt, playerPos) {
    // spawn queue
    if (this.pendingSpawns.length) {
      this.spawnTimer += dt;
      while (this.pendingSpawns.length && this.spawnTimer >= this.pendingSpawns[0].at) {
        const s = this.pendingSpawns.shift();
        this._spawn(s.type, !!s.boss, playerPos);
        // re-base remaining times
        const consumed = s.at;
        this.spawnTimer -= consumed;
        for (const p of this.pendingSpawns) p.at -= consumed;
      }
    }
    // death FX
    for (const fx of this.deathFX) fx.update(dt);
    this.deathFX = this.deathFX.filter(f => !f.done);

    this.aliveCount = this.enemies.filter(e => !e.dead).length;

    // wave clear check
    if ((this.state === 'spawning' || this.state === 'fighting' || this.state === 'boss')
        && this.pendingSpawns.length === 0 && this.aliveCount === 0) {
      this._onCleared();
    } else if (this.state === 'spawning' && this.pendingSpawns.length === 0) {
      this.state = 'fighting';
    }

    // intermission countdown
    if (this.state === 'intermission') {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startNextWave();
    }
  }

  _onCleared() {
    if (this.onWaveClear) this.onWaveClear(this.wave);
    this.state = 'intermission';
    this.intermission = this.mode === 'endless' ? 2.0 : 4.0;
  }

  removeDead() {
    const stillDead = [];
    this.enemies = this.enemies.filter(e => {
      if (e.dead) {
        this.deathFX.push(new DeathFX(this.scene, e.position, 0x8a3b2a));
        e.dispose();
        return false;
      }
      return true;
    });
  }

  reset() {
    for (const e of this.enemies) e.dispose();
    for (const fx of this.deathFX) for (const p of fx.parts) this.scene.remove(p);
    this.enemies = [];
    this.deathFX = [];
    this.pendingSpawns = [];
    this.wave = 0;
    this.state = 'idle';
  }
}
