// main.js — engine bootstrap, game loop, shooting, scoring, menus.
import * as THREE from 'three';
import { tex } from './textures.js';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { WeaponManager, LOADOUT, WEAPON_DEFS } from './weapons.js';
import { WaveDirector } from './enemies.js';
import { HUD } from './hud.js';
import { audio } from './audio.js';
import { cheats, settings, CHEAT_CONTROLS, loadCheatState, saveCheatState, anyCheatOn } from './cheats.js';
import { MUSIC_PRESETS, MUSIC_VARIATIONS } from './music.js';

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

    loadCheatState();

    this._setupRenderer();
    this._setupScene();
    this._setupHelpers();
    this._buildWorld();
    this._buildSettingsUI();
    this._bindUI();
    this._bindInput();
    this._applyCheats();

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

    // Hint shown only when the mouse isn't captured (free-look fallback active).
    this._lookHint = document.createElement('div');
    this._lookHint.id = 'look-hint';
    this._lookHint.textContent = 'Move your mouse to look · click for precise (captured) aim';
    Object.assign(this._lookHint.style, {
      position: 'fixed', bottom: '84px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '23', pointerEvents: 'none', display: 'none', font: '13px monospace',
      color: '#e8d3a0', background: 'rgba(12,10,7,0.6)', padding: '5px 12px', borderRadius: '4px',
      letterSpacing: '0.5px', textShadow: '0 1px 3px #000',
    });
    document.body.appendChild(this._lookHint);

    // ESP / radar overlay canvas (drawn on top of the 3D view when cheats on)
    this._esp = document.createElement('canvas');
    this._esp.id = 'esp-canvas';
    Object.assign(this._esp.style, { position: 'fixed', inset: '0', zIndex: '21', pointerEvents: 'none' });
    document.body.appendChild(this._esp);
    this._espCtx = this._esp.getContext('2d');
    this._esp.width = window.innerWidth; this._esp.height = window.innerHeight;

    // Active-cheats readout
    this._cheatHud = document.createElement('div');
    this._cheatHud.id = 'cheat-hud';
    Object.assign(this._cheatHud.style, {
      position: 'fixed', top: '120px', left: '22px', zIndex: '24', pointerEvents: 'none',
      font: '12px monospace', color: '#ff4d4d', textShadow: '0 1px 3px #000', lineHeight: '1.5',
      letterSpacing: '0.5px',
    });
    document.body.appendChild(this._cheatHud);
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
    document.getElementById('resume-btn').addEventListener('click', () => this._resume());
    document.getElementById('quit-btn').addEventListener('click', () => this.toMenu());
    document.getElementById('retry-btn').addEventListener('click', () => this.start());
    document.getElementById('menu-btn').addEventListener('click', () => this.toMenu());
    document.getElementById('ig-resume').addEventListener('click', () => this._closeIngamePanel());
    document.getElementById('ig-quit').addEventListener('click', () => this.toMenu());

    this._wireTabs('menu-tabs');
    this._wireTabs('ig-tabs');
    this._showBest();

    // pointer lock transitions -> pause/resume
    this.player.controls.addEventListener('lock', () => {
      audio.init(); audio.resume();
      if (this.running) { this.paused = false; document.getElementById('pause').classList.add('hidden'); }
    });
    this.player.controls.addEventListener('unlock', () => {
      // don't pop the pause overlay when we intentionally opened the cheats panel
      if (this.running && !this._gameOver && !this._panelOpen) this._pause();
    });
  }

  _showBest() {
    const key = `duststrike_best_${this.mode}`;
    const best = localStorage.getItem(key);
    const el = document.getElementById('best-score');
    el.innerHTML = best ? `BEST (${this.mode}): <b>${best}</b>` : '';
  }

  // ---------------- settings / cheats / sound UI ----------------
  _buildSettingsUI() {
    this._uiSyncers = [];
    this._buildCheatPanel(document.getElementById('cheats-menu'));
    this._buildCheatPanel(document.getElementById('cheats-ingame'));
    this._buildSoundPanel(document.getElementById('sound-menu'));
    this._buildSoundPanel(document.getElementById('sound-ingame'));
    this._buildSensRow(document.getElementById('sens-menu'));
    this._syncUI();
  }

  _syncUI() { for (const fn of this._uiSyncers) fn(); }

  _buildCheatPanel(container) {
    container.innerHTML = '';
    for (const c of CHEAT_CONTROLS) {
      const row = document.createElement('div');
      row.className = 'cheat-row' + (c.sub ? ' sub' : '');
      const lbl = document.createElement('div'); lbl.className = 'lbl';
      const name = document.createElement('span');
      name.innerHTML = c.label + (c.hotkey ? ` <span class="hk">${c.hotkey.replace('Key', '')}</span>` : '');
      lbl.appendChild(name);
      if (c.desc) { const d = document.createElement('span'); d.className = 'desc'; d.textContent = c.desc; lbl.appendChild(d); }
      row.appendChild(lbl);

      if (c.type === 'toggle') {
        const sw = document.createElement('label'); sw.className = 'switch';
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = cheats[c.k];
        const track = document.createElement('span'); track.className = 'track';
        const knob = document.createElement('span'); knob.className = 'knob';
        sw.append(input, track, knob);
        input.addEventListener('change', () => { cheats[c.k] = input.checked; this._applyCheats(); this._syncUI(); });
        row.appendChild(sw);
        this._uiSyncers.push(() => { input.checked = cheats[c.k]; });
      } else if (c.type === 'range') {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:8px';
        const input = document.createElement('input');
        input.type = 'range'; input.min = c.min; input.max = c.max; input.step = c.step; input.value = cheats[c.k];
        input.style.width = '104px';
        const val = document.createElement('span');
        val.style.cssText = 'font-size:12px;color:#fff;width:38px;text-align:right;font-variant-numeric:tabular-nums';
        const fmt = () => c.k === 'aimbotSmooth' ? Math.round(cheats[c.k] * 100) + '%' : cheats[c.k] + (c.unit || '');
        val.textContent = fmt();
        input.addEventListener('input', () => { cheats[c.k] = parseFloat(input.value); val.textContent = fmt(); saveCheatState(); });
        wrap.append(input, val); row.appendChild(wrap);
        this._uiSyncers.push(() => { input.value = cheats[c.k]; val.textContent = fmt(); });
      }
      container.appendChild(row);
    }
  }

  _slider(container, label, min, max, step, get, set, fmt) {
    const row = document.createElement('div'); row.className = 'snd-row';
    const cap = document.createElement('div'); cap.className = 'cap';
    const n = document.createElement('span'); n.textContent = label;
    const v = document.createElement('span'); v.className = 'val';
    cap.append(n, v);
    const input = document.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = get();
    const upd = () => { v.textContent = fmt(get()); };
    upd();
    input.addEventListener('input', () => { set(parseFloat(input.value)); upd(); saveCheatState(); });
    row.append(cap, input); container.appendChild(row);
    this._uiSyncers.push(() => { input.value = get(); upd(); });
  }

  _chips(container, items, getIndex, onPick) {
    const row = document.createElement('div'); row.className = 'chip-row';
    const btns = items.map((label, i) => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = label;
      b.addEventListener('click', () => { onPick(i); this._syncUI(); });
      row.appendChild(b); return b;
    });
    container.appendChild(row);
    this._uiSyncers.push(() => btns.forEach((b, i) => b.classList.toggle('active', i === getIndex())));
  }

  _buildSensRow(container) {
    container.innerHTML = '';
    this._slider(container, 'Sensitivity', 0.2, 3, 0.05,
      () => settings.sensitivity,
      (v) => { settings.sensitivity = v; this.player.controls.pointerSpeed = v; },
      (v) => v.toFixed(2) + '×');
  }

  _buildSoundPanel(container) {
    container.innerHTML = '';
    const h1 = document.createElement('h3'); h1.textContent = 'Soundtrack'; container.appendChild(h1);
    this._chips(container, MUSIC_PRESETS.map(p => p.name), () => settings.soundtrack,
      (i) => { settings.soundtrack = i; audio.setMusicTrack(i); saveCheatState(); });
    const h2 = document.createElement('h3'); h2.textContent = 'Variation'; container.appendChild(h2);
    this._chips(container, MUSIC_VARIATIONS.map(v => v.name), () => settings.variation,
      (i) => { settings.variation = i; audio.setMusicVariation(i); saveCheatState(); });
    const h3 = document.createElement('h3'); h3.textContent = 'Levels'; container.appendChild(h3);
    this._slider(container, 'Music volume', 0, 1, 0.02,
      () => settings.musicVolume, (v) => { settings.musicVolume = v; audio.setMusicVolume(v); }, (v) => Math.round(v * 100) + '%');
    this._slider(container, 'SFX volume', 0, 1, 0.02,
      () => settings.sfxVolume, (v) => { settings.sfxVolume = v; audio.setVolume(v); }, (v) => Math.round(v * 100) + '%');
    this._slider(container, 'Mouse sensitivity', 0.2, 3, 0.05,
      () => settings.sensitivity, (v) => { settings.sensitivity = v; this.player.controls.pointerSpeed = v; }, (v) => v.toFixed(2) + '×');
  }

  _wireTabs(barId) {
    const bar = document.getElementById(barId);
    const overlay = bar.closest('.overlay');
    bar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        overlay.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== btn.dataset.tab));
      });
    });
  }

  _applyAudioSettings() {
    audio.setMusicVolume(settings.musicVolume);
    audio.setVolume(settings.sfxVolume);
    audio.setMusicTrack(settings.soundtrack);
    audio.setMusicVariation(settings.variation);
  }

  _openIngamePanel() {
    if (!this.running || this._gameOver) return;
    this._panelOpen = true;
    this.paused = true;
    this.firing = false;
    document.body.classList.remove('playing');
    this._setAim(false);
    if (this.player.isLocked) this.player.controls.unlock();
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('ingame-panel').classList.remove('hidden');
    this._syncUI();
  }
  _closeIngamePanel() {
    this._panelOpen = false;
    document.getElementById('ingame-panel').classList.add('hidden');
    this.paused = false;
    document.body.classList.add('playing');
    this._requestLock();
  }

  _bindInput() {
    const dom = this.renderer.domElement;
    // Look control. When the pointer is locked, PointerLockControls consumes
    // movement. When it ISN'T (e.g. a sandboxed iframe blocks Pointer Lock),
    // we apply the raw relative mouse delta directly — so the view tracks your
    // actual hand movement 1:1 instead of drifting. Trackpad-friendly.
    document.addEventListener('mousemove', (e) => {
      this._mouseClient = { x: e.clientX, y: e.clientY };
      if (!this.running || this.paused || this.player.isLocked) return;
      const mx = e.movementX || 0, my = e.movementY || 0;
      if (mx === 0 && my === 0) return;
      const s = 0.0022 * settings.sensitivity;
      const eu = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      eu.y -= mx * s;
      eu.x -= my * s;
      eu.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, eu.x));
      this.camera.quaternion.setFromEuler(eu);
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.running || this.paused) return;
      // A click is a user gesture — (re)try to capture the mouse for precise aim.
      if (!this.player.isLocked) { try { this.player.controls.lock(); } catch (_) {} }
      if (e.button === 0) { this.firing = true; this._tryShoot(true); }
      if (e.button === 2) this._setAim(true);
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this._setAim(false);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        const on = audio.toggleMusic();
        if (this.running) this.hud.banner(on ? '♪ MUSIC ON' : '♪ MUSIC OFF', '', false, 1000);
        return;
      }
      if (e.code === 'Backslash') {
        if (this.running) { this._panelOpen ? this._closeIngamePanel() : this._openIngamePanel(); }
        return;
      }
      // cheat quick-toggle hotkeys (work anytime)
      for (const c of CHEAT_CONTROLS) {
        if (c.hotkey && c.hotkey === e.code) {
          cheats[c.k] = !cheats[c.k];
          this._applyCheats(); this._syncUI();
          if (this.running) this.hud.banner((cheats[c.k] ? '✓ ' : '✕ ') + c.label.toUpperCase(), '', false, 900);
          return;
        }
      }
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

    // The play-button click is a user gesture — safe to spin up audio + music.
    audio.init(); audio.resume(); audio.startMusic();
    this._applyAudioSettings();

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
    this._panelOpen = false;
    document.body.classList.add('playing');   // hide the cursor
    this.player.controls.pointerSpeed = settings.sensitivity;
    this._applyCheats();
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
    document.body.classList.remove('playing');
    this._setAim(false);
    const acc = this.shotsFired ? Math.round(this.shotsHit / this.shotsFired * 100) : 100;
    document.getElementById('pause-stats').innerHTML = this._statRows({
      Wave: this.director.wave, Score: this.score, Kills: this.kills,
      Accuracy: acc + '%', 'Best streak': this.bestStreak,
    });
    document.getElementById('pause').classList.remove('hidden');
  }

  _resume() {
    // Unpause immediately (works with or without Pointer Lock), then try to
    // re-capture the mouse for precise aim where the API is allowed.
    this.paused = false;
    document.body.classList.add('playing');
    document.getElementById('pause').classList.add('hidden');
    this._requestLock();
  }

  toMenu() {
    this.running = false;
    this.paused = false;
    this._gameOver = false;
    this._panelOpen = false;
    document.body.classList.remove('playing');
    this.director.reset();
    this.hud.hide();
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('ingame-panel').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    if (this._espCtx) this._espCtx.clearRect(0, 0, this._esp.width, this._esp.height);
    this._showBest();
  }

  _gameEnd() {
    this._gameOver = true;
    this.running = false;
    this.firing = false;
    document.body.classList.remove('playing');
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
    // pointer-lock look speed = user sensitivity, tightened while aiming
    this.player.controls.pointerSpeed = settings.sensitivity * (on ? (scoped ? 0.35 : 0.7) : 1.0);
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
    if (!cheats.noRecoil) this._applyRecoil(def);
    if (this.weapons.ammo.mag === 0 && !cheats.infiniteAmmo) this.weapons.startReload();
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

  // ==================== CHEATS ====================
  // Sync cheat state into subsystems + refresh the on-screen readout.
  _applyCheats() {
    this.weapons.fireRateMult = cheats.rapidFire ? 3.2 : 1;
    this.weapons.infiniteAmmo = cheats.infiniteAmmo;
    this.player.godMode = cheats.godMode;
    this.player.superSpeed = cheats.superSpeed;
    this.player.superJump = cheats.superJump;
    if (cheats.infiniteAmmo) { const a = this.weapons.ammo; if (a) { a.mag = this.weapons.def.mag; this._refreshAmmo(); } }
    this._applyChams(cheats.wallhack);
    // readout
    const active = CHEAT_CONTROLS.filter(c => c.type === 'toggle' && cheats[c.k]).map(c => c.label.toUpperCase());
    this._cheatHud.innerHTML = active.length ? '⚠ CHEATS<br>' + active.join('<br>') : '';
    if (!cheats.wallhack && !cheats.radar && this._espCtx) this._espCtx.clearRect(0, 0, this._esp.width, this._esp.height);
    saveCheatState();
  }

  _applyChams(on) {
    for (const e of this.director.enemies) this._champEnemy(e, on);
    this._chamsOn = on;
  }
  _champEnemy(e, on) {
    for (const m of e.hitMeshes) {
      const col = e.def && e.def.camo === 'ct' ? 0x1a5a8a : 0x8a1a1a;
      m.material.depthTest = !on;
      m.material.depthWrite = !on;
      m.material.emissive && m.material.emissive.setHex(on ? col : 0x000000);
      m.renderOrder = on ? 997 : 0;
    }
    e._chammed = on;
  }

  // Pick the enemy closest to the crosshair within the aimbot FOV cone.
  _bestAimTarget(fovDeg) {
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    const cos = Math.cos(fovDeg * Math.PI / 180);
    let best = null, bestDot = cos;
    const tmp = new THREE.Vector3();
    for (const e of this.director.enemies) {
      if (e.dead) continue;
      (cheats.aimbotHead ? e.head : e.torso).getWorldPosition(tmp);
      const to = tmp.sub(this.camera.position).normalize();
      const dot = to.dot(fwd);          // 1 = dead-centre on the crosshair
      if (dot > bestDot) { bestDot = dot; best = e; }
    }
    return best;
  }

  _aimbot(dt) {
    if (!cheats.aimbot) return;
    const target = this._bestAimTarget(cheats.aimbotFov);
    if (!target) return;
    const aim = new THREE.Vector3();
    (cheats.aimbotHead ? target.head : target.torso).getWorldPosition(aim);
    const dir = aim.sub(this.camera.position).normalize();
    // desired orientation whose forward (-Z) points along dir
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), dir, new THREE.Vector3(0, 1, 0));
    const targetQ = new THREE.Quaternion().setFromRotationMatrix(m);
    // Frame-rate-independent exponential easing — always glides, never snaps.
    const rate = 2.5 + cheats.aimbotSmooth * 11;   // ~3..13.5 (was up to 22)
    const s = 1 - Math.exp(-rate * dt);
    this.camera.quaternion.slerp(targetQ, s);      // slerp already takes the shortest arc
    this._recoilAccum = 0; // keep it glued
  }

  _crosshairOnEnemy() {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    this.raycaster.set(origin, dir); this.raycaster.far = 400;
    const em = [];
    for (const e of this.director.enemies) if (!e.dead) em.push(...e.hitMeshes);
    const eh = this.raycaster.intersectObjects(em, false);
    if (!eh.length) return false;
    if (cheats.wallbang) return true;              // shoot through walls
    const wh = this.raycaster.intersectObjects(this.map.solids, false);
    return !(wh.length && wh[0].distance < eh[0].distance);
  }

  _triggerbot() {
    if (!cheats.triggerbot) return;
    if (this._crosshairOnEnemy()) this._tryShoot(true);
  }

  // ESP boxes + snaplines + optional radar, drawn on the overlay canvas.
  _drawESP() {
    const ctx = this._espCtx; if (!ctx) return;
    const W = this._esp.width, H = this._esp.height;
    ctx.clearRect(0, 0, W, H);
    if (!this.running || this.paused) return;

    if (cheats.wallhack) {
      const head = new THREE.Vector3(), feet = new THREE.Vector3();
      for (const e of this.director.enemies) {
        if (e.dead) continue;
        e.group.getWorldPosition(feet);
        head.copy(feet); head.y += (e.isBoss ? 4.6 : 2.0);
        const pf = feet.clone().project(this.camera);
        const ph = head.clone().project(this.camera);
        if (pf.z > 1 || ph.z > 1) continue; // behind camera
        const sxF = (pf.x * 0.5 + 0.5) * W, syF = (-pf.y * 0.5 + 0.5) * H;
        const sxH = (ph.x * 0.5 + 0.5) * W, syH = (-ph.y * 0.5 + 0.5) * H;
        const h = Math.max(10, syF - syH);
        const w = h * 0.45;
        const x = (sxF + sxH) / 2 - w / 2, y = syH;
        const col = e.def && e.def.camo === 'ct' ? '#33aaff' : '#ff4d4d';
        ctx.lineWidth = e.isBoss ? 2.5 : 1.5;
        ctx.strokeStyle = col;
        ctx.strokeRect(x, y, w, h);
        // health bar (left side)
        const hpFrac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = '#000'; ctx.fillRect(x - 5, y, 3, h);
        ctx.fillStyle = hpFrac > 0.5 ? '#5fdd5f' : hpFrac > 0.25 ? '#e8c33d' : '#e2453c';
        ctx.fillRect(x - 5, y + h * (1 - hpFrac), 3, h * hpFrac);
        // snapline from bottom-center
        ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W / 2, H); ctx.lineTo((sxF + sxH) / 2, syF); ctx.stroke();
        ctx.globalAlpha = 1;
        // label
        const dist = this.camera.position.distanceTo(feet) | 0;
        ctx.font = '11px monospace'; ctx.fillStyle = col; ctx.textAlign = 'center';
        const name = e.isBoss ? (e.def.name || 'BOSS') : (e.type || 'BOT').toUpperCase();
        ctx.fillText(`${name} ${dist}m`, (sxF + sxH) / 2, syH - 4);
      }
    }

    if (cheats.radar) this._drawRadar(ctx, W, H);
  }

  _drawRadar(ctx, W, H) {
    const R = 90, cx = W - R - 24, cy = R + 24, range = 70;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(10,14,10,0.7)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2f5f2f'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    // player heading
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    const yaw = Math.atan2(fwd.x, fwd.z);
    ctx.fillStyle = '#7fe07f';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
    const pp = this.player.position;
    for (const e of this.director.enemies) {
      if (e.dead) continue;
      const dx = e.position.x - pp.x, dz = e.position.z - pp.z;
      // rotate into view space so "up" is where you look
      const rx = dx * Math.cos(-yaw) - dz * Math.sin(-yaw);
      const rz = dx * Math.sin(-yaw) + dz * Math.cos(-yaw);
      let px = cx + (rx / range) * R;
      let py = cy - (rz / range) * R;  // forward = up
      const d = Math.hypot(px - cx, py - cy);
      if (d > R) { px = cx + (px - cx) / d * R; py = cy + (py - cy) / d * R; }
      ctx.fillStyle = e.isBoss ? '#ffaa00' : (e.def && e.def.camo === 'ct' ? '#33aaff' : '#ff4d4d');
      ctx.beginPath(); ctx.arc(px, py, e.isBoss ? 4 : 2.5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  _doRaycastShot(def) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    // apply spread (cheat: no spread = perfect laser accuracy)
    const spread = cheats.noSpread ? 0
                 : this.aiming ? this.weapons.currentSpread(this.player.moveState()) * 0.35
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

    // Wallbang: bullets penetrate solids and still hit the enemy behind them.
    if (enemyHits.length && (cheats.wallbang || enemyHits[0].distance < wallDist)) {
      const hit = enemyHits[0];
      hitPoint = hit.point.clone();
      const ud = hit.object.userData;
      const enemy = ud.enemy;
      const head = ud.part === 'head';
      const mult = head ? def.headshotMult : (ud.mult || 1);
      const dmg = cheats.oneHitKill ? enemy.maxHp * 10 : def.damage * mult;
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

  _spawnTracer(a, b, { color = 0xffe08a, ttl = 0.06, opacity = 0.9 } = {}) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0, ttl });
  }

  // Visible incoming round from an enemy toward the player (hits go at you,
  // misses whiz past) so damage never feels like it comes from nowhere.
  _enemyTracer(enemy, hit) {
    const from = enemy.gunMesh
      ? enemy.gunMesh.getWorldPosition(new THREE.Vector3())
      : enemy.position.clone().setY(1.1);
    const to = this.camera.position.clone();
    if (!hit) {
      // push the endpoint off to the side/up so the round streaks past you
      const side = new THREE.Vector3().subVectors(to, from).cross(new THREE.Vector3(0, 1, 0)).normalize();
      to.addScaledVector(side, (Math.random() - 0.5) * 3.0);
      to.y += (Math.random() - 0.2) * 1.8;
    }
    // stop the streak just short of the camera so it reads as a passing round
    to.addScaledVector(new THREE.Vector3().subVectors(from, to).normalize(), 1.2);
    this._spawnTracer(from, to, { color: 0xff6a2a, ttl: 0.11, opacity: 1.0 });
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
      this._enemyTracer(enemy, hit); // always show the incoming round
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

      // cheats: aimbot steer + triggerbot + keep infinite mag topped
      this._aimbot(dt);
      this._triggerbot();
      if (cheats.infiniteAmmo) { const a = this.weapons.ammo; if (a && a.mag < this.weapons.def.mag) { a.mag = this.weapons.def.mag; this._refreshAmmo(); } }

      // continuous fire for autos
      if (this.firing && this.weapons.def.auto) this._tryShoot(false);

      this._recoverRecoil(dt);
      this.weapons.update(dt, now, this.player.moveState());

      // enemies
      this.director.update(dt, this.player.position);
      for (const e of this.director.enemies) {
        if (e.dead) continue;
        if (cheats.wallhack && !e._chammed) this._champEnemy(e, true);
        const los = e.melee ? true : this._enemyLOS(e);
        e.update(dt, this.player.position, this.map, (en, dmg, melee) => this._onEnemyShoot(en, dmg, melee), los);
        e.faceBar(this.camera);
      }
      this.director.removeDead();

      this._updateTracers(dt);
      this._drawESP();

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
      this._lookHint.style.display = this.player.isLocked ? 'none' : 'block';
    } else {
      if (this._lookHint) this._lookHint.style.display = 'none';
      if (this._espCtx) this._espCtx.clearRect(0, 0, this._esp.width, this._esp.height);
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
    if (this._esp) { this._esp.width = window.innerWidth; this._esp.height = window.innerHeight; }
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
