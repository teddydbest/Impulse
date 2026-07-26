// audio.js — all sound is synthesized with the Web Audio API (no audio files).
// Gunshots, reloads, hitmarkers, footsteps, deaths, boss roars and ambience.
import { MusicEngine } from './music.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.enabled = true;
    this.volume = 0.9;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    // gentle master limiter so layered shots never clip harshly
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.noiseBuf = this._makeNoise(1.0);
    this._startAmbience();
    // ambient Arabic-flute soundtrack, routed through master so volume applies
    this.music = new MusicEngine(this.ctx, this.master);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  startMusic() { if (this.music && !this.music.playing) this.music.start(); }
  stopMusic() { if (this.music) this.music.stop(); }
  toggleMusic() { return this.music ? this.music.toggleMute() : false; }
  setMusicVolume(v) { if (this.music) this.music.setLevel(v); }
  setMusicTrack(i) { if (this.music) this.music.setPreset(i); }
  setMusicVariation(v) { if (this.music) this.music.setVariation(v); }

  _makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noiseSrc() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }

  // Core gunshot builder — layered noise crack + low body thump + tail.
  _shot({ gain = 1, dur = 0.18, lowFreq = 120, hiCut = 4200, body = 1, snap = 1 }) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = gain;
    out.connect(this.master);

    // High-frequency crack (the "snap")
    const n = this._noiseSrc();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hiCut;
    bp.Q.value = 0.7;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(1.0 * snap, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    n.start(t); n.stop(t + dur);

    // Low body thump (osc)
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(lowFreq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(lowFreq * 0.5, t + dur * 0.6);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.9 * body, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp); lp.connect(og); og.connect(out);
    o.start(t); o.stop(t + dur);

    // Click transient
    const click = this.ctx.createOscillator();
    click.type = 'square';
    click.frequency.value = 1800;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.4 * snap, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    click.connect(cg); cg.connect(out);
    click.start(t); click.stop(t + 0.03);
  }

  // Per-weapon flavored shots
  shoot(weapon) {
    switch (weapon) {
      case 'ak':    this._shot({ gain: 0.85, dur: 0.20, lowFreq: 110, hiCut: 3600, body: 1.1, snap: 1.0 }); break;
      case 'm4':    this._shot({ gain: 0.7,  dur: 0.15, lowFreq: 140, hiCut: 4800, body: 0.8, snap: 1.1 }); break;
      case 'awp':   this._shot({ gain: 1.0,  dur: 0.5,  lowFreq: 70,  hiCut: 2600, body: 1.6, snap: 1.2 }); this._tail(0.5); break;
      case 'deagle':this._shot({ gain: 0.95, dur: 0.28, lowFreq: 95,  hiCut: 3200, body: 1.4, snap: 1.0 }); break;
      case 'smg':   this._shot({ gain: 0.55, dur: 0.10, lowFreq: 160, hiCut: 5200, body: 0.6, snap: 1.0 }); break;
      default:      this._shot({ gain: 0.8,  dur: 0.18 });
    }
  }

  // Reverb-ish tail for big guns.
  _tail(dur) {
    const t = this.ctx.currentTime;
    const n = this._noiseSrc();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + dur);
  }

  dryFire() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.05);
  }

  // Mechanical reload = a few clicks/clacks in sequence.
  reload(weapon = 'ak') {
    if (!this.enabled || !this.ctx) return;
    const clackTimes = weapon === 'awp' ? [0, 0.25, 0.6, 1.0, 1.4] : [0, 0.18, 0.42, 0.7];
    clackTimes.forEach((dt, i) => this._clack(dt, 0.5 + (i % 2) * 0.3));
  }

  _clack(delay, pitch = 0.6) {
    const t = this.ctx.currentTime + delay;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 500 + pitch * 2500; bp.Q.value = 3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.08);
  }

  hitmarker(head = false) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(head ? 1400 : 900, t);
    o.frequency.exponentialRampToValueAtTime(head ? 1900 : 1200, t + 0.03);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.09);
  }

  footstep() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700 + Math.random() * 300;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.14);
  }

  enemyDeath() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.42);
  }

  playerHurt() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
    o.connect(lp); lp.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.26);
  }

  bossRoar() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(70, t);
    o1.frequency.linearRampToValueAtTime(45, t + 1.2);
    const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.setValueAtTime(105, t);
    o2.frequency.linearRampToValueAtTime(60, t + 1.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.master);
    o1.start(t); o2.start(t); o1.stop(t + 1.5); o2.stop(t + 1.5);
  }

  waveStart() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.22, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.28);
      o.connect(g); g.connect(this.master);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3);
    });
  }

  waveClear() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.1);
      g.gain.linearRampToValueAtTime(0.25, t + i * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);
      o.connect(g); g.connect(this.master);
      o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.42);
    });
  }

  gameOver() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 329.63, 261.63, 196].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.linearRampToValueAtTime(0.2, t + i * 0.18 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.5);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
      o.connect(lp); lp.connect(g); g.connect(this.master);
      o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.55);
    });
  }

  // Low, dusty wind ambience loop.
  _startAmbience() {
    const n = this._noiseSrc();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    // slow wind swell via LFO
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.03;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(); lfo.start();
  }
}

export const audio = new AudioEngine();
