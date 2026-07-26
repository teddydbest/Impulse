// music.js — generative ambient Middle-Eastern soundtrack engine, fully
// synthesized (no audio files). Preset-driven: several "soundtracks" built on
// different maqamat and instrument voices (ney flute, plucked oud, bowed
// strings pad, struck santur), each with tempo/density/register variations.

// ---- Soundtracks. scale = semitone degrees of the maqam from the tonic. ----
export const MUSIC_PRESETS = [
  { name: 'Desert Ney',    scale: [0, 1, 4, 5, 7, 8, 10], tonic: 146.83, tempo: 74,  voice: 'ney',     drum: 'slow',    reverb: 0.9, register: 12 }, // Hijaz
  { name: 'Bazaar Oud',    scale: [0, 2, 3, 5, 7, 8, 10], tonic: 130.81, tempo: 96,  voice: 'oud',     drum: 'darbuka', reverb: 0.6, register: 12 }, // Nahawand
  { name: 'Mirage Pads',   scale: [0, 2, 3, 5, 6, 8, 10], tonic: 110.00, tempo: 58,  voice: 'strings', drum: 'off',     reverb: 1.0, register: 12 }, // Saba-ish
  { name: 'Caravan',       scale: [0, 1, 4, 5, 7, 8, 10], tonic: 146.83, tempo: 104, voice: 'ney',     drum: 'darbuka', reverb: 0.7, register: 12 }, // Hijaz, driving
  { name: 'Santur Nights', scale: [0, 2, 3, 5, 7, 8, 10], tonic: 123.47, tempo: 84,  voice: 'santur',  drum: 'slow',    reverb: 0.8, register: 12 }, // Nahawand
  { name: 'Rast Sunrise',  scale: [0, 2, 4, 5, 7, 9, 10], tonic: 130.81, tempo: 88,  voice: 'oud',     drum: 'slow',    reverb: 0.7, register: 12 }, // Rast-ish
];

// ---- Variations layered on top of the chosen soundtrack. ----
export const MUSIC_VARIATIONS = [
  { name: 'Calm',    tempoMul: 0.85, density: 0.65, octave: 0,  drumMul: 0.5 },
  { name: 'Flowing', tempoMul: 1.0,  density: 1.0,  octave: 0,  drumMul: 1.0 },
  { name: 'Driving', tempoMul: 1.22, density: 1.3,  octave: 0,  drumMul: 1.5 },
  { name: 'Ascend',  tempoMul: 1.05, density: 1.0,  octave: 12, drumMul: 1.0 },
];

export class MusicEngine {
  constructor(ctx, destination) {
    this.ctx = ctx;

    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(destination);
    this.target = 0.6;
    this.muted = false;

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.4, 2.8);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.85;
    this.reverb.connect(this.wet); this.wet.connect(this.out);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.75;
    this.dry.connect(this.out);

    this.noise = this._noise(2);

    this.presetIndex = 0;
    this.variationIndex = 1;
    this.nextNoteTime = 0;
    this.beatPos = 0;
    this.phraseLeft = 3 + (Math.random() * 3 | 0);
    this.prevFreq = 300;
    this.playing = false;
    this.notesPlayed = 0;
    this._timer = null;
    this.drone = null;

    this._configure();
  }

  // ---- build the active config (scale ladder, tempo, drone freqs) ----
  _configure() {
    const p = MUSIC_PRESETS[this.presetIndex] || MUSIC_PRESETS[0];
    const v = MUSIC_VARIATIONS[this.variationIndex] || MUSIC_VARIATIONS[1];
    this.cfg = {
      scale: p.scale, tonic: p.tonic, voice: p.voice, drum: p.drum,
      register: p.register + v.octave, density: v.density, drumMul: v.drumMul,
      tempo: p.tempo * v.tempoMul, reverbWet: p.reverb,
    };
    this.beat = 60 / this.cfg.tempo;
    this.wet.gain.setTargetAtTime(0.55 + this.cfg.reverbWet * 0.5, this.ctx.currentTime, 0.2);

    // melodic ladder: the maqam spread over a few octaves, centered on register
    this.ladder = [];
    for (let oct = -1; oct <= 1; oct++) {
      for (const d of this.cfg.scale) {
        const s = d + 12 * oct + this.cfg.register;
        if (s >= 5 && s <= 28) this.ladder.push(s);
      }
    }
    this.ladder.sort((a, b) => a - b);
    // nearest tonic index (any octave)
    this.tonicIdx = 0; let bd = 1e9;
    for (let i = 0; i < this.ladder.length; i++) {
      const off = ((this.ladder[i] - this.cfg.register) % 12 + 12) % 12;
      const d = Math.min(off, 12 - off);
      if (d < bd) { bd = d; this.tonicIdx = i; }
    }
    this.idx = Math.min(this.idx || this.tonicIdx, this.ladder.length - 1);
  }

  freqOf(semitone) { return this.cfg.tonic * Math.pow(2, semitone / 12); }

  setPreset(i) {
    i = ((i % MUSIC_PRESETS.length) + MUSIC_PRESETS.length) % MUSIC_PRESETS.length;
    if (i === this.presetIndex) return;
    this.presetIndex = i; this.idx = null; this._configure();
    if (this.playing) this._restartDrone();
  }
  setVariation(v) {
    v = ((v % MUSIC_VARIATIONS.length) + MUSIC_VARIATIONS.length) % MUSIC_VARIATIONS.length;
    if (v === this.variationIndex) return;
    this.variationIndex = v; this._configure();
    if (this.playing) this._restartDrone();
  }
  get presetName() { return MUSIC_PRESETS[this.presetIndex].name; }
  get variationName() { return MUSIC_VARIATIONS[this.variationIndex].name; }

  // ---- start / stop / mute / level ----
  start() {
    if (this.playing) return;
    this.playing = true;
    this.notesPlayed = 0;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(this.muted ? 0.0001 : this.target, t + 2.5);
    this._startDrone();
    this.nextNoteTime = t + 0.5;
    this._timer = setInterval(() => this._scheduler(), 60);
  }
  stop() {
    this.playing = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    this._stopDrone(t + 1.3);
  }
  toggleMute() {
    this.muted = !this.muted;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.exponentialRampToValueAtTime(this.muted ? 0.0001 : this.target, t + 0.5);
    return !this.muted;
  }
  setLevel(v) {
    this.target = Math.max(0.0001, v);
    if (!this.muted && this.playing) {
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
      this.out.gain.linearRampToValueAtTime(this.target, t + 0.3);
    }
  }

  // ---- generative scheduler ----
  _scheduler() {
    if (!this.playing) return;
    const ahead = this.ctx.currentTime + 0.7;
    let guard = 0;
    while (this.nextNoteTime < ahead && guard++ < 32) this._scheduleStep(this.nextNoteTime);
  }

  _scheduleStep(time) {
    this._maybeDrum(time);

    const pluck = this.cfg.voice === 'oud' || this.cfg.voice === 'santur';
    const pad = this.cfg.voice === 'strings';

    if (this.phraseLeft <= 0) {
      if (Math.random() < 0.7) {
        this.idx = this._towardTonic(this.idx);
        const f = this.freqOf(this.ladder[this.idx]);
        const dur = (pad ? 2.5 : 1.5 + Math.random()) * this.beat;
        this._voice(f, time, dur, { vibrato: true, vel: 0.9, glideFrom: this.prevFreq });
        this.prevFreq = f; this._advance(dur);
      }
      const rest = (pad ? 1.5 : (1 + Math.random() * 1.5)) * this.beat / this.cfg.density;
      this._advance(rest);
      this.phraseLeft = (pluck ? 4 : 3) + (Math.random() * 4 | 0);
      return;
    }

    this._nextDegree();
    const f = this.freqOf(this.ladder[this.idx]);

    let choices;
    if (pad) choices = [2, 2, 3, 4];
    else if (pluck) choices = [0.5, 0.5, 0.5, 0.75, 1, 1];
    else choices = [0.5, 0.5, 0.75, 1, 1, 1.5, 2];
    let beats = choices[Math.random() * choices.length | 0];
    beats /= this.cfg.density;
    const dur = beats * this.beat;
    const long = beats >= 1.4;

    this._voice(f, time, dur, {
      vibrato: long || Math.random() < 0.4,
      vel: long ? 1.0 : 0.8 + Math.random() * 0.15,
      glideFrom: !pluck && Math.random() < 0.5 ? this.prevFreq : null,
      pan: (Math.random() - 0.5) * 0.5,
    });
    this.prevFreq = f;
    this.phraseLeft--;
    this._advance(dur);
  }

  _advance(sec) { this.nextNoteTime += sec; this.beatPos += sec / this.beat; }

  _nextDegree() {
    const n = this.ladder.length;
    const r = Math.random();
    if (r < 0.52) this.idx += (Math.random() < 0.5 ? -1 : 1);
    else if (r < 0.70) this.idx += (Math.random() < 0.5 ? -2 : 2);
    else if (r < 0.80) { /* repeat */ }
    else this.idx = this._towardTonic(this.idx);
    this.idx = Math.max(0, Math.min(n - 1, this.idx));
  }
  _towardTonic(i) {
    let best = this.tonicIdx, bd = 1e9;
    for (let k = 0; k < this.ladder.length; k++) {
      const off = ((this.ladder[k] - this.cfg.register) % 12 + 12) % 12;
      if (Math.min(off, 12 - off) < 0.01) { const d = Math.abs(k - i); if (d < bd) { bd = d; best = k; } }
    }
    return i + Math.sign(best - i);
  }

  // ---- voice dispatch ----
  _voice(freq, time, dur, opts) {
    this.notesPlayed++;
    switch (this.cfg.voice) {
      case 'oud': return this._oud(freq, time, dur, opts);
      case 'strings': return this._strings(freq, time, dur, opts);
      case 'santur': return this._santur(freq, time, dur, opts);
      default: return this._ney(freq, time, dur, opts);
    }
  }

  _sink(node, time, dur) {
    node.connect(this.dry);
    node.connect(this.reverb);
  }

  // Breathy ney flute.
  _ney(freq, time, dur, { vibrato = false, vel = 1, glideFrom = null, pan = 0 } = {}) {
    const ctx = this.ctx;
    const pk = 0.16 * vel, atk = 0.09, rel = Math.min(0.5, dur * 0.5);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(pk, time + atk);
    amp.gain.setValueAtTime(pk, time + Math.max(atk, dur - rel));
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq * 4 + 600; lp.Q.value = 0.6;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (panner) panner.pan.value = pan;
    const osc = ctx.createOscillator(); osc.type = 'triangle';
    if (glideFrom) { osc.frequency.setValueAtTime(glideFrom, time); osc.frequency.exponentialRampToValueAtTime(freq, time + 0.09); }
    else osc.frequency.setValueAtTime(freq, time);
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2.01;
    const o2g = ctx.createGain(); o2g.gain.value = 0.18;
    let lfo, lfoGain;
    if (vibrato) {
      lfo = ctx.createOscillator(); lfo.frequency.value = 5 + Math.random();
      lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.0001, time);
      lfoGain.gain.linearRampToValueAtTime(freq * 0.012, time + Math.min(0.5, dur * 0.5));
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    }
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 3; bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, time);
    ng.gain.exponentialRampToValueAtTime(0.05 * vel, time + 0.04);
    ng.gain.exponentialRampToValueAtTime(0.008 * vel, time + Math.min(0.35, dur));
    ng.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(amp); osc2.connect(o2g); o2g.connect(amp);
    nz.connect(bp); bp.connect(ng); ng.connect(amp);
    let node = amp; node.connect(lp); node = lp;
    if (panner) { node.connect(panner); node = panner; }
    this._sink(node, time, dur);
    const stop = time + dur + 0.05;
    osc.start(time); osc.stop(stop); osc2.start(time); osc2.stop(stop);
    nz.start(time); nz.stop(stop); if (lfo) { lfo.start(time); lfo.stop(stop); }
  }

  // Plucked oud — quick attack, exponential decay, warm.
  _oud(freq, time, dur, { vel = 1, pan = 0 } = {}) {
    const ctx = this.ctx;
    const len = Math.min(1.4, Math.max(0.5, dur * 1.4));
    const pk = 0.22 * vel;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (panner) panner.pan.value = pan;
    const mk = (mult, g, type) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq * mult * 1.01, time);
      o.frequency.exponentialRampToValueAtTime(freq * mult, time + 0.05); // tiny pitch settle
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(pk * g, time);
      gg.gain.exponentialRampToValueAtTime(0.0001, time + len);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(freq * 6, time); lp.frequency.exponentialRampToValueAtTime(freq * 2, time + len * 0.6);
      o.connect(gg); gg.connect(lp);
      let node = lp; if (panner) { node.connect(panner); node = panner; }
      this._sink(node, time, len);
      o.start(time); o.stop(time + len + 0.05);
    };
    mk(1, 1.0, 'sawtooth');
    mk(2, 0.35, 'triangle');
    mk(1.5, 0.12, 'sine');
    // pluck click
    const nz = ctx.createBufferSource(); nz.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 3; bp.Q.value = 2;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.12 * vel, time); ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    nz.connect(bp); bp.connect(ng); this._sink(ng, time, 0.06); nz.start(time); nz.stop(time + 0.08);
  }

  // Bowed strings pad — slow attack, sustained, ensemble detune.
  _strings(freq, time, dur, { vibrato = true, vel = 1, pan = 0 } = {}) {
    const ctx = this.ctx;
    const pk = 0.10 * vel, atk = 0.4, rel = Math.min(1.2, dur * 0.6);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(pk, time + atk);
    amp.gain.setValueAtTime(pk, time + Math.max(atk, dur - rel));
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.5;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (panner) panner.pan.value = pan;
    for (const det of [-7, 0, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.5;
      o.connect(g); g.connect(amp);
      o.start(time); o.stop(time + dur + 0.05);
    }
    if (vibrato) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 4.5;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0.0001, time); lg.gain.linearRampToValueAtTime(freq * 0.008, time + atk);
      lfo.connect(lg); // (subtle amplitude shimmer via filter)
      lg.connect(lp.frequency);
      lfo.start(time); lfo.stop(time + dur + 0.05);
    }
    amp.connect(lp);
    let node = lp; if (panner) { node.connect(panner); node = panner; }
    this._sink(node, time, dur);
  }

  // Struck santur — bright metallic partials, fast decay, quick double-strike.
  _santur(freq, time, dur, { vel = 1, pan = 0 } = {}) {
    const ctx = this.ctx;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (panner) panner.pan.value = pan;
    const strike = (t0, amp) => {
      for (const [mult, g] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.15], [5.4, 0.08]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mult;
        const gg = ctx.createGain();
        gg.gain.setValueAtTime(0.09 * amp * g * vel, t0);
        gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5 / (1 + mult * 0.3));
        o.connect(gg);
        let node = gg; if (panner) { node.connect(panner); node = panner; }
        this._sink(node, t0, 0.6);
        o.start(t0); o.stop(t0 + 0.7);
      }
    };
    strike(time, 1.0);
    strike(time + 0.06, 0.5); // santur's characteristic double tap
  }

  // ---- drone ----
  _startDrone() {
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 3);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const flfo = ctx.createOscillator(); flfo.frequency.value = 0.05;
    const flfoG = ctx.createGain(); flfoG.gain.value = 160;
    flfo.connect(flfoG); flfoG.connect(lp.frequency); flfo.start(t);
    const tonic = this.cfg.tonic;
    const voices = [
      { f: tonic, detune: -6, gain: 1.0, type: 'sawtooth' },
      { f: tonic, detune: +6, gain: 1.0, type: 'sawtooth' },
      { f: this.freqOf(7), detune: 0, gain: 0.6, type: 'triangle' },
      { f: tonic / 2, detune: 0, gain: 0.5, type: 'sine' },
    ];
    const oscs = [];
    for (const v of voices) {
      const o = ctx.createOscillator(); o.type = v.type; o.frequency.value = v.f; o.detune.value = v.detune;
      const vg = ctx.createGain(); vg.gain.value = v.gain; o.connect(vg); vg.connect(lp); o.start(t); oscs.push(o);
    }
    lp.connect(g); g.connect(this.dry); g.connect(this.reverb);
    this.drone = { g, oscs, flfo };
  }
  _stopDrone(when) {
    if (!this.drone) return;
    const d = this.drone;
    d.g.gain.cancelScheduledValues(this.ctx.currentTime);
    d.g.gain.setValueAtTime(d.g.gain.value, this.ctx.currentTime);
    d.g.gain.exponentialRampToValueAtTime(0.0001, when);
    for (const o of d.oscs) o.stop(when + 0.1);
    d.flfo.stop(when + 0.1);
    this.drone = null;
  }
  _restartDrone() {
    const t = this.ctx.currentTime;
    this._stopDrone(t + 0.4);
    setTimeout(() => { if (this.playing) this._startDrone(); }, 260);
  }

  // ---- percussion ----
  _maybeDrum(time) {
    if (this.cfg.drum === 'off') return;
    const b = this.beatPos, near = (x) => Math.abs(((b % x) + x) % x) < 0.06;
    if (this.cfg.drum === 'slow') {
      if (near(8)) this._doom(time, 0.09 * this.cfg.drumMul);
    } else if (this.cfg.drum === 'darbuka') {
      const inBar = ((b % 4) + 4) % 4;
      if (Math.abs(inBar - 0) < 0.06) this._doom(time, 0.10 * this.cfg.drumMul);
      else if (Math.abs(inBar - 1.5) < 0.06) this._tek(time, 0.06 * this.cfg.drumMul);
      else if (Math.abs(inBar - 2) < 0.06) this._doom(time, 0.07 * this.cfg.drumMul);
      else if (Math.abs(inBar - 3.5) < 0.06) this._tek(time, 0.05 * this.cfg.drumMul);
    }
  }
  _doom(time, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, time); o.frequency.exponentialRampToValueAtTime(52, time + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
    o.connect(g); g.connect(this.dry); g.connect(this.reverb);
    o.start(time); o.stop(time + 0.55);
  }
  _tek(time, gain) {
    const ctx = this.ctx;
    const nz = ctx.createBufferSource(); nz.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    nz.connect(bp); bp.connect(g); g.connect(this.dry); g.connect(this.reverb);
    nz.start(time); nz.stop(time + 0.1);
  }

  // ---- helpers ----
  _noise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _impulse(duration, decay) {
    const rate = this.ctx.sampleRate, len = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
}
