// hud.js — thin wrapper around the DOM HUD elements + aim-trainer stats.
import { WEAPON_DEFS, LOADOUT } from './weapons.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      score: document.getElementById('score'),
      wave: document.getElementById('wave'),
      enemiesLeft: document.getElementById('enemies-left'),
      accuracy: document.getElementById('accuracy'),
      hsPct: document.getElementById('hs-pct'),
      kills: document.getElementById('kills'),
      streak: document.getElementById('streak'),
      health: document.getElementById('health'),
      armor: document.getElementById('armor'),
      bottomleft: document.getElementById('bottomleft'),
      ammoMag: document.getElementById('ammo-mag'),
      ammoReserve: document.getElementById('ammo-reserve'),
      weaponName: document.getElementById('weapon-name'),
      crosshair: document.getElementById('crosshair'),
      hitmarker: document.getElementById('hitmarker'),
      waveBanner: document.getElementById('wave-banner'),
      killfeed: document.getElementById('killfeed'),
      vignette: document.getElementById('damage-vignette'),
      strip: document.getElementById('weapon-strip'),
    };
    this._buildStrip();
  }

  _buildStrip() {
    this.el.strip.innerHTML = '';
    this.slots = {};
    for (const id of LOADOUT) {
      const def = WEAPON_DEFS[id];
      const div = document.createElement('div');
      div.className = 'wslot';
      div.innerHTML = `<span class="num">${def.key}</span> ${def.name}`;
      this.el.strip.appendChild(div);
      this.slots[id] = div;
    }
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setActiveWeapon(id) {
    for (const k in this.slots) this.slots[k].classList.toggle('active', k === id);
    this.el.weaponName.textContent = WEAPON_DEFS[id].name;
  }

  setAmmo(mag, reserve) {
    this.el.ammoMag.textContent = mag;
    this.el.ammoReserve.textContent = reserve;
    this.el.ammoMag.classList.toggle('empty', mag === 0);
  }

  setHealth(hp, armor) {
    this.el.health.textContent = Math.ceil(hp);
    this.el.armor.textContent = Math.ceil(armor);
    const low = hp <= 30;
    this.el.bottomleft.classList.toggle('low', low);
    document.body.classList.toggle('lowhp', low && hp > 0);
  }

  setStats({ score, wave, enemiesLeft, accuracy, hsPct, kills, streak }) {
    if (score !== undefined) this.el.score.textContent = score;
    if (wave !== undefined) this.el.wave.textContent = wave;
    if (enemiesLeft !== undefined) this.el.enemiesLeft.textContent = enemiesLeft;
    if (accuracy !== undefined) this.el.accuracy.textContent = accuracy + '%';
    if (hsPct !== undefined) this.el.hsPct.textContent = hsPct + '%';
    if (kills !== undefined) this.el.kills.textContent = kills;
    if (streak !== undefined) this.el.streak.textContent = streak;
  }

  // Dynamic crosshair gap based on spread (radians -> px feel)
  setSpread(spread) {
    const gap = Math.min(40, 4 + spread * 900);
    this.el.crosshair.style.setProperty('--ch-gap', gap.toFixed(1) + 'px');
  }

  hitmarker(kill = false, head = false) {
    const h = this.el.hitmarker;
    h.classList.remove('show', 'kill');
    void h.offsetWidth; // restart animation
    if (kill) h.classList.add('kill');
    h.classList.add('show');
  }

  banner(text, sub = '', boss = false, ms = 1800) {
    const b = this.el.waveBanner;
    b.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
    b.classList.toggle('boss', boss);
    b.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.remove('show'), ms);
  }

  killfeed(text, headshot = false) {
    const item = document.createElement('div');
    item.className = 'kf-item';
    item.innerHTML = `YOU ▸ ${text}` + (headshot ? ' <span class="hs">HS</span>' : '');
    this.el.killfeed.appendChild(item);
    setTimeout(() => item.classList.add('fade'), 3500);
    setTimeout(() => item.remove(), 4100);
    // cap
    while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild.remove();
  }

  damageFlash() {
    const v = this.el.vignette;
    v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
  }
}
