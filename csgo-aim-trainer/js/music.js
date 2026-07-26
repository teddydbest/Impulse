// music.js — generative ambient Arabic-flute (ney) soundtrack, fully synthesized.
// A slow, rubato melody wanders through the Hijaz maqam (the classic
// Middle-Eastern scale with the augmented-2nd between b2 and 3) over a soft
// tonic/fifth drone, lush reverb, and a sparse deep frame-drum. No audio files.

const TONIC = 146.8324; // D3 — everything is derived from this by equal temperament
const semi = (n) => TONIC * Math.pow(2, n / 12);

// Hijaz maqam degrees (semitone offsets from tonic): 1 b2 3 4 5 b6 b7
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];

export class MusicEngine {
  constructor(ctx, destination) {
    this.ctx = ctx;

    // ---- output bus (fades in) ----
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(destination);
    this.target = 0.6;      // overall music level (sits under SFX)
    this.muted = false;

    // ---- reverb (generated impulse response) ----
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.4, 2.8);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.85;
    this.reverb.connect(this.wet); this.wet.connect(this.out);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.75;
    this.dry.connect(this.out);

    // reusable noise for breath + drum
    this.noise = this._noise(2);

    // ---- build the melodic ladder (a few octaves of the maqam, sorted) ----
    this.ladder = [];
    for (let oct = -1; oct <= 1; oct++) {
      for (const d of HIJAZ) {
        const s = d + 12 * oct + 12; // center melody around D4..D5
        if (s >= 5 && s <= 26) this.ladder.push(s);
      }
    }
    this.ladder.sort((a, b) => a - b);
    this.tonicIdx = this.ladder.reduce((best, s, i) =>
      (Math.abs((s - 12) % 12) < Math.abs((this.ladder[best] - 12) % 12) ? i : best), 0);
    this.idx = this.tonicIdx;

    // ---- timing / generative state ----
    this.tempo = 74;
    this.beat = 60 / this.tempo;
    this.nextNoteTime = 0;
    this.beatPos = 0;           // running beat counter for percussion
    this.phraseLeft = 3 + (Math.random() * 3 | 0);
    this.prevFreq = semi(12);
    this.playing = false;
    this._timer = null;

    this.drone = null;
  }

  // ---------- start / stop / mute ----------
  start() {
    if (this.playing) return;
    this.playing = true;
    this.notesPlayed = 0;
    const t = this.ctx.currentTime;
    // linear fade-in reaches an audible level quickly (exponential lingers near 0)
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
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    this._stopDrone(t + 1.6);
  }

  toggleMute() {
    this.muted = !this.muted;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.exponentialRampToValueAtTime(this.muted ? 0.0001 : this.target, t + 0.6);
    return !this.muted;
  }

  setLevel(v) {
    this.target = v;
    if (!this.muted && this.playing) {
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
      this.out.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t + 0.4);
    }
  }

  // ---------- lookahead scheduler ----------
  _scheduler() {
    if (!this.playing) return;
    const ahead = this.ctx.currentTime + 0.7;
    let guard = 0;
    while (this.nextNoteTime < ahead && guard++ < 32) {
      this._scheduleStep(this.nextNoteTime);
    }
  }

  _scheduleStep(time) {
    // Sparse deep frame-drum on the downbeat of every other bar (4/4 bars).
    if (Math.floor(this.beatPos) % 8 === 0 && Math.abs(this.beatPos - Math.round(this.beatPos)) < 0.01) {
      this._drum(time, 0.09);
    }

    if (this.phraseLeft <= 0) {
      // breath between phrases — resolve toward the tonic, then rest
      if (Math.random() < 0.7) {
        this.idx = this._towardTonic(this.idx);
        const f = semi(this.ladder[this.idx]);
        const dur = (1.5 + Math.random()) * this.beat;
        this._ney(f, time, dur, { vibrato: true, vel: 0.9, glideFrom: this.prevFreq });
        this.prevFreq = f;
        this._advance(dur);
      }
      const rest = (1 + Math.random() * 1.5) * this.beat;
      this._advance(rest);
      this.phraseLeft = 3 + (Math.random() * 4 | 0);
      return;
    }

    // pick next degree with a gentle random walk that favors stepwise motion
    this._nextDegree();
    const f = semi(this.ladder[this.idx]);

    // note length in beats (weighted toward flowing eighths/quarters)
    const choices = [0.5, 0.5, 0.75, 1, 1, 1.5, 2];
    const beats = choices[Math.random() * choices.length | 0];
    const dur = beats * this.beat;
    const long = beats >= 1.5;

    this._ney(f, time, dur, {
      vibrato: long || Math.random() < 0.4,
      vel: long ? 1.0 : 0.8 + Math.random() * 0.15,
      glideFrom: Math.random() < 0.5 ? this.prevFreq : null,
      pan: (Math.random() - 0.5) * 0.5,
    });
    this.prevFreq = f;
    this.phraseLeft--;
    this._advance(dur);
  }

  _advance(sec) {
    this.nextNoteTime += sec;
    this.beatPos += sec / this.beat;
  }

  _nextDegree() {
    const n = this.ladder.length;
    const r = Math.random();
    if (r < 0.52) this.idx += (Math.random() < 0.5 ? -1 : 1);       // step
    else if (r < 0.70) this.idx += (Math.random() < 0.5 ? -2 : 2);  // small leap
    else if (r < 0.80) { /* repeat note */ }
    else this.idx = this._towardTonic(this.idx);                    // gravity to tonic
    this.idx = Math.max(0, Math.min(n - 1, this.idx));
  }

  _towardTonic(i) {
    // step one index toward the nearest scale-tonic (any octave)
    let best = this.tonicIdx, bd = 1e9;
    for (let k = 0; k < this.ladder.length; k++) {
      if (Math.abs((this.ladder[k] - 12) % 12) < 0.01) {
        const d = Math.abs(k - i);
        if (d < bd) { bd = d; best = k; }
      }
    }
    return i + Math.sign(best - i);
  }

  // ---------- the ney (flute) voice ----------
  _ney(freq, time, dur, { vibrato = false, vel = 1, glideFrom = null, pan = 0 } = {}) {
    const ctx = this.ctx;
    this.notesPlayed = (this.notesPlayed || 0) + 1;
    const pk = 0.16 * vel;                 // peak amplitude
    const atk = 0.09, rel = Math.min(0.5, dur * 0.5);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(pk, time + atk);
    amp.gain.setValueAtTime(pk, time + Math.max(atk, dur - rel));
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    // soften the tone
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 4 + 600, time);
    lp.Q.value = 0.6;

    // panning for a little width
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    // fundamental (triangle = warm, hollow like a flute)
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    if (glideFrom) {
      osc.frequency.setValueAtTime(glideFrom, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + 0.09);
    } else {
      osc.frequency.setValueAtTime(freq, time);
    }
    // breathy overtone
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01;
    const o2g = ctx.createGain(); o2g.gain.value = 0.18;

    // vibrato that eases in
    let lfo, lfoGain;
    if (vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = 5 + Math.random();
      lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.0001, time);
      lfoGain.gain.linearRampToValueAtTime(freq * 0.012, time + Math.min(0.5, dur * 0.5));
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    }

    // breath noise (airy attack transient)
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = freq * 3; bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, time);
    ng.gain.exponentialRampToValueAtTime(0.05 * vel, time + 0.04);
    ng.gain.exponentialRampToValueAtTime(0.008 * vel, time + Math.min(0.35, dur));
    ng.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    // wire graph
    osc.connect(amp);
    osc2.connect(o2g); o2g.connect(amp);
    nz.connect(bp); bp.connect(ng); ng.connect(amp);
    let node = amp;
    node.connect(lp); node = lp;
    if (panner) { node.connect(panner); node = panner; }
    node.connect(this.dry);
    node.connect(this.reverb);

    const stop = time + dur + 0.05;
    osc.start(time); osc.stop(stop);
    osc2.start(time); osc2.stop(stop);
    nz.start(time); nz.stop(stop);
    if (lfo) { lfo.start(time); lfo.stop(stop); }
  }

  // ---------- sustained tonic + fifth drone ----------
  _startDrone() {
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 3);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;

    // slow filter movement for life
    const flfo = ctx.createOscillator(); flfo.frequency.value = 0.05;
    const flfoG = ctx.createGain(); flfoG.gain.value = 160;
    flfo.connect(flfoG); flfoG.connect(lp.frequency);
    flfo.start(t);

    const oscs = [];
    // tonic (two detuned) + fifth
    const voices = [
      { f: TONIC, detune: -6, gain: 1.0, type: 'sawtooth' },
      { f: TONIC, detune: +6, gain: 1.0, type: 'sawtooth' },
      { f: semi(7), detune: 0, gain: 0.6, type: 'triangle' },       // fifth (A)
      { f: TONIC / 2, detune: 0, gain: 0.5, type: 'sine' },         // sub octave
    ];
    for (const v of voices) {
      const o = ctx.createOscillator();
      o.type = v.type; o.frequency.value = v.f; o.detune.value = v.detune;
      const vg = ctx.createGain(); vg.gain.value = v.gain;
      o.connect(vg); vg.connect(lp);
      o.start(t);
      oscs.push(o);
    }
    lp.connect(g);
    g.connect(this.dry);
    g.connect(this.reverb);
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

  // ---------- soft deep frame-drum ----------
  _drum(time, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, time);
    o.frequency.exponentialRampToValueAtTime(52, time + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
    // a touch of skin noise
    const nz = ctx.createBufferSource(); nz.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.4, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    o.connect(g); g.connect(this.dry); g.connect(this.reverb);
    nz.connect(bp); bp.connect(ng); ng.connect(this.dry);
    o.start(time); o.stop(time + 0.55);
    nz.start(time); nz.stop(time + 0.15);
  }

  // ---------- helpers ----------
  _noise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _impulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // exponentially-decaying, slightly diffuse noise tail
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }
}
