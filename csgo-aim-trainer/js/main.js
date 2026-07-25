// main.js — engine bootstrap, game loop, shooting, scoring, menus.
import * as THREE from 'three';
import { tex } from './textures.js';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { WeaponManager, LOADOUT, WEAPON_DEFS } from './weapons.js';
import { WaveDirector } from './enemies.js';
import { HUD } from './hud.js';
import { audio } from './audio.js';

class Game {
  constructor() {
    this.container = document.getElementById('game');
    this.clock = new THREE.Clock();
    this.running = false;
    this.paused = false;
    this.mode = 'waves';
    this.difficulty = 'normal';

    this.score = 0;
    this.kills = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.headshots = 0;

    this.firing = false;
    this.aiming = false;
    this.baseFov = 90;

    this.tracers = [];
    this.impacts = [];

    this._setupRenderer();
    this._setupScene();
    this._setupHelpers();
    this._buildWorld();
    this._bindUI();
    this._bindInput();

    window.addEventListener('resize', () => this._onResize());

    // hide loader once ready
    setTimeout(() => document.getElementById('loading').classList.add('hidden'), 350);
    this._renderIdle();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    const sky = tex('sky');
    this.scene.background = sky;   // equirectangular canvas texture -> skybox
    this.scene.fog = new THREE.Fog(0xd7bd88, 70, 240);

    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.05, 1000);
    this.scene.add(this.camera);

    // Lighting: warm desert sun + sky fill + gentle ambient bounce so
    // shadowed interiors and the viewmodel never go pitch black.
    const hemi = new THREE.HemisphereLight(0xdce6ff, 0xb08a4a, 0.9);
    this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight(0x4a4030, 0.35));

    const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    sun.position.set(60, 90, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 260;
    const s = 90;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    this.scene.add(sun.target);

    const rim = new THREE.DirectionalLight(0xffd9a0, 0.4);
    rim.position.set(-50, 30, 60);
    this.scene.add(rim);
  }

  _setupHelpers() {
    this.raycaster = new THREE.Raycaster();
    this.hud = new HUD();
    this._scopeEl = document.createElement('div');
    this._scopeEl.id = 'scope-overlay';
    Object.assign(this._scopeEl.style, {
      position: 'fixed', inset: '0', zIndex: '22', pointerEvents: 'none', display: 'none',
      background: 'radial-gradient(circle at center, transparent 0 28vh, rgba(0,0,0,0.55) 30vh, #000 34vh)',
    });
    const cross = document.createElement('div');
    Object.assign(cross.style, {
      position: 'absolute', left: '0', right: '0', top: '50%', height: '1px', background: 'rgba(0,0,0,0.8)',
    });
    const crossV = document.createElement('div');
    Object.assign(crossV.style, {
      position: 'absolute', top: '0', bottom: '0', left: '50%', width: '1px', background: 'rgba(0,0,0,0.8)',
    });
    this._scopeEl.append(cross, crossV);
    document.body.appendChild(this._scopeEl);
  }

  _buildWorld() {
    this.map = new GameMap(this.scene);
    this.player = new Player(this.camera, this.renderer.domElement, this.map, audio);
    this.weapons = new WeaponManager(this.camera, audio);
    this.weapons.equip('ak');
    this.weapons.onReloadDone = () => this._refreshAmmo();
    this.director = new WaveDirector(this.scene, this.map, this.difficulty, this.mode);
    this.director.onBanner = (wave, boss) => {
      if (boss) audio.bossRoar(); else audio.waveStart();
      this.hud.banner(boss ? `⚠ BOSS WAVE ${wave}` : `WAVE ${wave}`, boss ? 'ELIMINATE THE TARGET' : 'INCOMING HOSTILES', boss);
    };
    this.director.onWaveClear = (wave) => {
      audio.waveClear();
      this.player.heal(25, 25);
      this.hud.banner('WAVE CLEARED', this.mode === 'endless' ? '' : `NEXT WAVE IN 4s · +HP +ARMOR`, false, 2600);
    };
    this.director.onBossSpawn = (name) => {
      this.hud.banner(name, 'BOSS', true, 2600);
    };
  }

  _bindUI() {
    // difficulty / mode segmented buttons
    document.querySelectorAll('#difficulty-seg button').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#difficulty-seg button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.difficulty = b.dataset.diff;
      });
    });
    document.querySelectorAll('#mode-seg button').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#mode-seg button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.mode = b.dataset.mode;
      });
    });

    document.getElementById('play-btn').addEventListener('click', () => this.start());
    document.getElementById('resume-btn').addEventListener('click', () => this._requestLock());
    document.getElementById('quit-btn').addEventListener('click', () => this.toMenu());
    document.getElementById('retry-btn').addEventListener('click', () => this.start());
    document.getElementById('menu-btn').addEventListener('click', () => this.toMenu());

    this._showBest();

    // pointer lock transitions -> pause/resume
    this.player.controls.addEventListener('lock', () => {
      audio.init(); audio.resume();
      if (this.running) { this.paused = false; document.getElementById('pause').classList.add('hidden'); }
    });
    this.player.controls.addEventListener('unlock', () => {
      if (this.running && !this._gameOver) this._pause();
    });
  }

  _showBest() {
    const key = `duststrike_best_${this.mode}`;
    const best = localStorage.getItem(key);
    const el = document.getElementById('best-score');
    el.innerHTML = best ? `BEST (${this.mode}): <b>${best}</b>` : '';
  }

  _bindInput() {
    const dom = this.renderer.domElement;
    document.addEventListener('mousedown', (e) => {
      if (!this.running || this.paused) return;
      if (e.button === 0) { this.firing = true; this._tryShoot(true); }
      if (e.button === 2) this._setAim(true);
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this._setAim(false);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.code === 'KeyR') this._reload();
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= LOADOUT.length) this._switch(LOADOUT[n - 1]);
      }
    });
    document.addEventListener('wheel', (e) => {
      if (!this.running || this.paused) return;
      const idx = LOADOUT.indexOf(this.weapons.current);
      const next = (idx + (e.deltaY > 0 ? 1 : -1) + LOADOUT.length) % LOADOUT.length;
      this._switch(LOADOUT[next]);
    }, { passive: true });
  }

  _requestLock() { this.player.controls.lock(); }

  // ---------------- game state ----------------
  start() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    this.hud.show();
    this._gameOver = false;

    // reset state
    this.score = this.kills = this.streak = this.bestStreak = 0;
    this.shotsFired = this.shotsHit = this.headshots = 0;
    this.director.difficulty = this.difficulty;
    this.director.diffMult = this.difficulty === 'easy' ? 0.75 : this.difficulty === 'hard' ? 1.35 : 1.0;
    this.director.mode = this.mode;
    this.director.reset();
    this.player.reset();
    this.weapons.reset();
    this._switch('ak', true);
    this._refreshAmmo();
    this.hud.setHealth(this.player.hp, this.player.armor);
    this._updateStatsHud();

    this.running = true;
    this.paused = false;
    this._requestLock();
    // kick off first wave shortly after lock
    this.director.state = 'intermission';
    this.director.intermission = 1.4;

    if (!this._loopStarted) { this._loopStarted = true; this.clock.start(); this._loop(); }
  }

  _pause() {
    if (this._gameOver) return;
    this.paused = true;
    this.firing = false;
    this._setAim(false);
    const acc = this.shotsFired ? Math.round(this.shotsHit / this.shotsFired * 100) : 100;
    document.getElementById('pause-stats').innerHTML = this._statRows({
      Wave: this.director.wave, Score: this.score, Kills: this.kills,
      Accuracy: acc + '%', 'Best streak': this.bestStreak,
    });
    document.getElementById('pause').classList.remove('hidden');
  }

  toMenu() {
    this.running = false;
    this.paused = false;
    this._gameOver = false;
    this.director.reset();
    this.hud.hide();
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    this._showBest();
  }

  _gameEnd() {
    this._gameOver = true;
    this.running = false;
    this.firing = false;
    audio.gameOver();
    if (this.player.isLocked) this.player.controls.unlock();
    const acc = this.shotsFired ? Math.round(this.shotsHit / this.shotsFired * 100) : 0;
    const hs = this.kills ? Math.round(this.headshots / this.kills * 100) : 0;
    const key = `duststrike_best_${this.mode}`;
    const prevBest = parseInt(localStorage.getItem(key) || '0', 10);
    const record = this.score > prevBest;
    if (record) localStorage.setItem(key, String(this.score));
    document.getElementById('result-stats').innerHTML = this._statRows({
      'Waves survived': this.director.wave,
      Score: this.score,
      Kills: this.kills,
      Headshots: this.headshots,
      Accuracy: acc + '%',
      'Headshot %': hs + '%',
      'Best streak': this.bestStreak,
    }, record ? 'Score' : null);
    const dead = document.querySelector('#gameover .dead');
    dead.textContent = record ? 'NEW BEST!' : 'YOU DIED';
    setTimeout(() => document.getElementById('gameover').classList.remove('hidden'), 400);
  }

  _statRows(obj, highlightKey) {
    return Object.entries(obj).map(([k, v]) =>
      `<div class="rs${k === highlightKey ? ' hl' : ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`
    ).join('');
  }

  // ---------------- weapons ----------------
  _switch(id, force) {
    if (!force && this.weapons.current === id) return;
    const def = this.weapons.equip(id, force);
    if (def) {
      this.hud.setActiveWeapon(id);
      this._refreshAmmo();
      this._setAim(this.aiming); // recompute fov for scoped
    }
  }

  _reload() {
    if (this.weapons.startReload()) { /* handled */ }
  }

  _refreshAmmo() {
    const a = this.weapons.ammo;
    this.hud.setAmmo(a.mag, a.reserve);
  }

  _setAim(on) {
    this.aiming = on;
    const scoped = this.weapons.def?.scoped;
    this._targetFov = on ? (scoped ? 22 : 55) : this.baseFov;
    this.player.controls.pointerSpeed = on ? (scoped ? 0.35 : 0.7) : 1.0;
    this._scopeEl.style.display = (on && scoped) ? 'block' : 'none';
    // hide viewmodel when fully scoped for clarity
    if (this.weapons.models[this.weapons.current]) {
      this.weapons.models[this.weapons.current].model.visible = !(on && scoped);
    }
  }

  // ---------------- shooting ----------------
  _tryShoot(edge) {
    if (!this.running || this.paused) return;
    const now = performance.now();
    const def = this.weapons.def;
    if (!def.auto && !edge) return; // semi-auto only fires on click edge
    const res = this.weapons.fire(now);
    if (!res.fired) {
      if (res.dry) {
        // auto-reload attempt
        this.weapons.startReload();
      }
      return;
    }
    this.shotsFired++;
    this._refreshAmmo();
    // Bullet travels along the current aim first (a well-placed first shot lands),
    // then the view kicks — matching the CS feel and keeping tap-aim honest.
    this._doRaycastShot(def);
    this._applyRecoil(def);
    if (this.weapons.ammo.mag === 0) this.weapons.startReload();
  }

  _applyRecoil(def) {
    // kick the view up + slight random yaw. Track the pitch we add so the loop
    // can smoothly recover it back to the player's aim (CS-style).
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    const scale = this.aiming ? 0.6 : 1.0;
    const kick = def.recoil * scale;
    e.x += kick;
    e.x = Math.min(Math.PI / 2 - 0.01, e.x);
    e.y += (Math.random() - 0.5) * def.recoil * 0.6 * scale;
    this.camera.quaternion.setFromEuler(e);
    this._recoilAccum = (this._recoilAccum || 0) + kick;
  }

  _recoverRecoil(dt) {
    if (!this._recoilAccum || this._recoilAccum <= 0) return;
    const rate = (this.weapons.def.recoilRecover || 0.1) * 6;
    const dec = Math.min(this._recoilAccum, rate * dt);
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    e.x -= dec;
    this.camera.quaternion.setFromEuler(e);
    this._recoilAccum -= dec;
  }

  _doRaycastShot(def) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    // apply spread
    const spread = this.aiming ? this.weapons.currentSpread(this.player.moveState()) * 0.35
                               : this.weapons.currentSpread(this.player.moveState());
    if (spread > 0) {
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(side, dir).normalize();
      // gaussian-ish by averaging two randoms
      const rx = ((Math.random() + Math.random()) - 1) * spread;
      const ry = ((Math.random() + Math.random()) - 1) * spread;
      dir.addScaledVector(side, rx).addScaledVector(up, ry).normalize();
    }

    this.raycaster.set(origin, dir);
    this.raycaster.far = def.range;

    // gather enemy hit meshes
    const enemyMeshes = [];
    for (const e of this.director.enemies) if (!e.dead) enemyMeshes.push(...e.hitMeshes);

    const enemyHits = this.raycaster.intersectObjects(enemyMeshes, false);
    const wallHits = this.raycaster.intersectObjects(this.map.solids, false);
    const wallDist = wallHits.length ? wallHits[0].distance : Infinity;

    let hitPoint = origin.clone().addScaledVector(dir, def.range);
    let struckEnemy = false;

    if (enemyHits.length && enemyHits[0].distance < wallDist) {
      const hit = enemyHits[0];
      hitPoint = hit.point.clone();
      const ud = hit.object.userData;
      const enemy = ud.enemy;
      const head = ud.part === 'head';
      const mult = head ? def.headshotMult : (ud.mult || 1);
      const dmg = def.damage * mult;
      const result = enemy.takeDamage(dmg, head);
      struckEnemy = true;
      this.shotsHit++;
      this._spawnImpact(hitPoint, dir, true);
      audio.hitmarker(head);
      this.hud.hitmarker(result.dead, head);
      if (result.dead) this._onKill(enemy, head);
    } else if (wallHits.length) {
      hitPoint = wallHits[0].point.clone();
      this._spawnImpact(hitPoint, wallHits[0].face ? wallHits[0].face.normal : dir, false);
    }

    // muzzle-ish tracer origin (from lower right of screen)
    const muzzle = origin.clone()
      .addScaledVector(dir, 0.6)
      .addScaledVector(new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), 0.12)
      .add(new THREE.Vector3(0, -0.08, 0));
    this._spawnTracer(muzzle, hitPoint);
  }

  _onKill(enemy, head) {
    this.kills++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (head) this.headshots++;
    let pts = enemy.points || 100;
    if (head) pts += 50;
    // streak bonus
    pts += Math.min(this.streak, 20) * 5;
    this.score += pts;
    const name = enemy.isBoss ? (enemy.def?.name || 'BOSS') : ({ grunt: 'Grunt', rusher: 'Rusher', marks: 'Marksman', heavy: 'Heavy' }[enemy.type] || 'Bot');
    this.hud.killfeed(`${name} +${pts}`, head);
    audio.enemyDeath();
    if (enemy.isBoss) { audio.waveClear(); this.hud.banner('BOSS DOWN', `+${pts}`, true, 1800); }
    this._updateStatsHud();
  }

  _spawnTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0, ttl: 0.06 });
  }

  _spawnImpact(point, normal, blood) {
    const color = blood ? 0x9c2b1e : 0xcfc09a;
    const count = blood ? 8 : 6;
    const parts = [];
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), mat.clone());
      p.position.copy(point);
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8, (Math.random() - 0.5)).multiplyScalar(3);
      if (normal) v.addScaledVector(normal, 2);
      p.userData.vel = v;
      this.scene.add(p);
      parts.push(p);
    }
    // impact flash light
    const light = new THREE.PointLight(blood ? 0xff5533 : 0xffe0a0, 2, 4, 2);
    light.position.copy(point);
    this.scene.add(light);
    this.impacts.push({ parts, light, life: 0, ttl: 0.5 });
  }

  _updateTracers(dt) {
    for (const t of this.tracers) {
      t.life += dt;
      t.line.material.opacity = 0.9 * (1 - t.life / t.ttl);
    }
    this.tracers = this.tracers.filter(t => {
      if (t.life >= t.ttl) { this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); return false; }
      return true;
    });
    for (const im of this.impacts) {
      im.life += dt;
      for (const p of im.parts) {
        p.userData.vel.y -= 9.8 * dt;
        p.position.addScaledVector(p.userData.vel, dt);
        p.material.opacity = Math.max(0, 1 - im.life / im.ttl);
      }
      if (im.light) im.light.intensity = Math.max(0, 2 * (1 - im.life / 0.12));
    }
    this.impacts = this.impacts.filter(im => {
      if (im.life >= im.ttl) {
        for (const p of im.parts) { this.scene.remove(p); p.geometry.dispose(); }
        if (im.light) this.scene.remove(im.light);
        return false;
      }
      return true;
    });
  }

  // ---------------- enemy fire -> player ----------------
  _enemyLOS(enemy) {
    const from = enemy.position.clone().setY(1.2);
    const to = this.camera.position.clone();
    const d = new THREE.Vector3().subVectors(to, from);
    const dist = d.length();
    d.normalize();
    this.raycaster.set(from, d);
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.map.solids, false);
    return !(hits.length && hits[0].distance < dist - 0.5);
  }

  _onEnemyShoot(enemy, dmg, melee) {
    if (this._gameOver) return;
    let hit = melee;
    if (!melee) {
      // ranged: roll accuracy, degraded slightly by player movement
      const moveFactor = this.player.speedScalar > 0.4 ? 0.8 : 1.0;
      hit = Math.random() < enemy.accuracy * moveFactor;
    }
    if (hit) {
      const dead = this.player.takeDamage(dmg);
      this.hud.setHealth(this.player.hp, this.player.armor);
      this.hud.damageFlash();
      if (dead) this._gameEnd();
    }
  }

  _updateStatsHud() {
    const acc = this.shotsFired ? Math.round(this.shotsHit / this.shotsFired * 100) : 100;
    const hs = this.kills ? Math.round(this.headshots / this.kills * 100) : 0;
    this.hud.setStats({
      score: this.score, wave: this.director.wave || 1,
      enemiesLeft: this.director.aliveCount + this.director.pendingSpawns.length,
      accuracy: acc, hsPct: hs, kills: this.kills, streak: this.streak,
    });
  }

  // ---------------- main loop ----------------
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.running && !this.paused) {
      this.player.update(dt);
      const now = performance.now();

      // continuous fire for autos
      if (this.firing && this.weapons.def.auto) this._tryShoot(false);

      this._recoverRecoil(dt);
      this.weapons.update(dt, now, this.player.moveState());

      // enemies
      this.director.update(dt, this.player.position);
      for (const e of this.director.enemies) {
        if (e.dead) continue;
        const los = e.melee ? true : this._enemyLOS(e);
        e.update(dt, this.player.position, this.map, (en, dmg, melee) => this._onEnemyShoot(en, dmg, melee), los);
        e.faceBar(this.camera);
      }
      this.director.removeDead();

      this._updateTracers(dt);

      // fov smoothing (ADS)
      const tf = this._targetFov || this.baseFov;
      if (Math.abs(this.camera.fov - tf) > 0.1) {
        this.camera.fov += (tf - this.camera.fov) * Math.min(1, 14 * dt);
        this.camera.updateProjectionMatrix();
      }

      // HUD live updates
      this.hud.setSpread(this.weapons.currentSpread(this.player.moveState()));
      this.hud.setHealth(this.player.hp, this.player.armor);
      this._updateStatsHud();
    } else {
      // still animate tracers/impacts fade when paused? keep frozen.
    }

    this.renderer.render(this.scene, this.camera);
  }

  _renderIdle() {
    // slow idle camera orbit for the menu backdrop
    this.camera.position.set(20, 6, 30);
    this.camera.lookAt(0, 3, 0);
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Boot — module scripts are deferred, so DOMContentLoaded may have already
// fired by the time this runs; guard against that.
function boot() { window.__game = new Game(); }
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
