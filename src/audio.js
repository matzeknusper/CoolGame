// Fully synthesized audio (WebAudio): sound effects and a small step sequencer for music.
// No audio files are shipped.
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.last = {};
    this.gateStep = 0;
    this.gateT = 0;
    this.music = null;
    this.timer = null;
    this.pending = null;
  }

  // must be called from a user gesture
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxOn ? 1 : 0; this.sfxBus.connect(this.master);
      this.musBus = ctx.createGain(); this.musBus.gain.value = this.musicOn ? 0.5 : 0; this.musBus.connect(this.master);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.pending) { const p = this.pending; this.pending = null; this.playMusic(p.cfg, p.mode); }
    } catch (e) { this.ctx = null; }
  }

  setSfx(on) { this.sfxOn = on; if (this.sfxBus) this.sfxBus.gain.value = on ? 1 : 0; }
  setMusic(on) { this.musicOn = on; if (this.musBus) this.musBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  // ---- primitives --------------------------------------------------------------------
  tone(type, f0, f1, dur, vol, when = 0, bus = this.sfxBus, attack = 0.004) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  hiss(dur, vol, type, f0, f1, when = 0, bus = this.sfxBus, q = 1) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---- sound effects -----------------------------------------------------------------
  play(name, p = 0) {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const gap = GAPS[name] || 0;
    if (gap && now - (this.last[name] || -9) < gap) return;
    this.last[name] = now;
    const r = Math.random();
    switch (name) {
      case 'shot': this.tone('sine', 420 + r * 120, 860 + r * 160, 0.07, 0.1); break;
      case 'pop': this.hiss(0.05, 0.1, 'bandpass', 1100 + r * 700, 500, 0, this.sfxBus, 1.5); break;
      case 'popE': { const k = 1 + Math.min(1, p / 60) * 0.9; this.tone('sine', (300 + r * 80) * k, 110 * k, 0.08, 0.12); break; }
      case 'bigPop': this.tone('sine', 220, 50, 0.3, 0.3); this.hiss(0.25, 0.2, 'lowpass', 1800, 200); break;
      case 'gate': {
        // rising pentatonic run – the more units pour through, the higher it climbs
        if (now - this.gateT > 0.4) this.gateStep = 0;
        this.gateT = now;
        const n = 72 + PENTA[this.gateStep % PENTA.length];
        this.gateStep++;
        this.tone('triangle', midi(n), midi(n), 0.11, 0.075);
        break;
      }
      case 'fortHit': this.tone('sine', 130 + r * 30, 55, 0.09, 0.16); break;
      case 'blockHit': this.tone('square', 190 + r * 60, 120, 0.05, 0.05); break;
      case 'fortDown':
        this.hiss(1.3, 0.55, 'lowpass', 2600, 90);
        this.tone('sine', 110, 28, 1.0, 0.5);
        [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', midi(60 + s), midi(60 + s), 0.5, 0.12, 0.08 * i + 0.15));
        break;
      case 'explo': this.hiss(0.55, 0.4, 'lowpass', 2200, 120); this.tone('sine', 150, 36, 0.45, 0.35); break;
      case 'shield': this.tone('sawtooth', 200, 70, 0.28, 0.22); this.hiss(0.2, 0.2, 'highpass', 900, 3000); break;
      case 'coin': this.tone('sine', 1318, 1318, 0.07, 0.07); this.tone('sine', 1760, 1760, 0.12, 0.07, 0.06); break;
      case 'pickup': [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', midi(72 + s), midi(72 + s), 0.14, 0.12, i * 0.055)); break;
      case 'mega': this.hiss(0.5, 0.3, 'bandpass', 300, 2600, 0, this.sfxBus, 2); this.tone('sawtooth', 80, 240, 0.4, 0.2); break;
      case 'megaReady': this.tone('triangle', 880, 880, 0.12, 0.1); this.tone('triangle', 1318, 1318, 0.22, 0.1, 0.1); break;
      case 'cage': [0, 4, 7, 12, 16].forEach((s, i) => this.tone('square', midi(67 + s), midi(67 + s), 0.13, 0.06, i * 0.05)); break;
      case 'gateDone': this.hiss(0.3, 0.2, 'highpass', 2000, 7000); this.tone('triangle', 1400, 500, 0.25, 0.1); break;
      case 'saw': this.hiss(0.07, 0.1, 'bandpass', 3200, 1800, 0, this.sfxBus, 4); break;
      case 'fall': this.tone('sine', 700, 180, 0.3, 0.07); break;
      case 'warn': this.tone('square', 440, 440, 0.12, 0.12); this.tone('square', 440, 440, 0.12, 0.12, 0.2); this.tone('square', 587, 587, 0.2, 0.12, 0.4); break;
      case 'stomp': this.tone('sine', 90, 24, 0.6, 0.6); this.hiss(0.4, 0.4, 'lowpass', 900, 80); break;
      case 'freeze': [0, 7, 12, 19].forEach((s, i) => this.tone('sine', midi(84 + s), midi(84 + s), 0.5, 0.06, i * 0.03)); this.hiss(0.5, 0.12, 'highpass', 5000, 9000); break;
      case 'shell': this.tone('sine', 900, 300, 0.5, 0.08); break;
      case 'click': this.tone('triangle', 660, 880, 0.05, 0.12); break;
      case 'buy': this.tone('square', 988, 988, 0.07, 0.08); this.tone('square', 1318, 1318, 0.2, 0.08, 0.07); this.hiss(0.1, 0.06, 'highpass', 6000, 9000, 0.07); break;
      case 'deny': this.tone('square', 160, 120, 0.15, 0.1); break;
      case 'star': this.tone('triangle', midi(76 + p * 4), midi(76 + p * 4), 0.4, 0.2); this.tone('sine', midi(88 + p * 4), midi(88 + p * 4), 0.5, 0.1, 0.03); this.hiss(0.2, 0.06, 'highpass', 7000, 9000); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone('square', midi(64 + s), midi(64 + s), i === 6 ? 0.6 : 0.16, 0.1, i * 0.13)); break;
      case 'lose': [0, -1, -3, -5, -8].forEach((s, i) => this.tone('sawtooth', midi(57 + s), midi(57 + s), i === 4 ? 0.7 : 0.22, 0.1, i * 0.2)); break;
      case 'frenzy':
        this.hiss(0.7, 0.25, 'bandpass', 400, 6000, 0, this.sfxBus, 1.5);
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('sawtooth', midi(60 + s), midi(60 + s), 0.12, 0.07, i * 0.05));
        this.tone('square', midi(84), midi(84), 0.5, 0.09, 0.36);
        break;
      case 'frenzyEnd': this.tone('triangle', 880, 330, 0.3, 0.08); break;
      case 'milestone': [7, 12, 16].forEach((s, i) => this.tone('square', midi(72 + s + p), midi(72 + s + p), i === 2 ? 0.35 : 0.1, 0.1, i * 0.08)); this.hiss(0.25, 0.08, 'highpass', 6000, 9000, 0.16); break;
      case 'stage': [0, 7, 12].forEach((s, i) => this.tone('triangle', midi(69 + s), midi(69 + s), 0.2, 0.12, i * 0.09)); break;
    }
  }

  // ---- music ---------------------------------------------------------------------------
  playMusic(cfg, mode = 'game') {
    if (!this.ctx) { this.pending = { cfg, mode }; return; }
    if (this.music && this.music.cfg === cfg && this.music.mode === mode) return;
    this.stopMusic();
    const scale = SCALES[cfg.scale] || SCALES.major;
    const bpm = cfg.bpm + (mode === 'boss' ? 14 : mode === 'menu' ? -14 : 0);
    // a tiny seeded melody so every world has its own tune
    let seed = cfg.root * 131 + cfg.bpm;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const melody = [];
    let deg = 4;
    for (let i = 0; i < 32; i++) {
      deg += [-2, -1, -1, 0, 1, 1, 2][(rnd() * 7) | 0];
      deg = Math.max(0, Math.min(9, deg));
      melody.push(rnd() < 0.22 ? -1 : deg);
    }
    this.music = { cfg, mode, scale, step: 0, next: this.ctx.currentTime + 0.1, spb: 60 / bpm / 4, melody, prog: mode === 'boss' ? [0, 5, 3, 6] : [0, 4, 5, 3] };
    this.timer = setInterval(() => this._schedule(), 90);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.music = null;
  }

  _note(deg, oct) {
    const m = this.music, sc = m.scale;
    const o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return midi(m.cfg.root + sc[d] + 12 * (o + oct));
  }

  _schedule() {
    const m = this.music, ctx = this.ctx;
    if (!m || !ctx || ctx.state !== 'running') return;
    if (m.next < ctx.currentTime - 0.5) m.next = ctx.currentTime + 0.05; // resumed after a pause
    while (m.next < ctx.currentTime + 0.25) {
      this._step(m.step, m.next - ctx.currentTime);
      m.next += m.spb;
      m.step = (m.step + 1) % 128;
    }
  }

  _step(step, when) {
    const m = this.music, bus = this.musBus;
    const s16 = step % 16, bar = (step >> 4) % 4;
    const root = m.prog[bar];
    const full = m.mode !== 'menu';
    if (full) {
      if (s16 % 4 === 0) { this.tone('sine', 150, 42, 0.16, 0.5, when, bus); }
      if (s16 === 4 || s16 === 12) this.hiss(0.12, 0.2, 'bandpass', 1900, 1200, when, bus, 0.8);
      if (s16 % 2 === 1 || (m.mode === 'boss' && s16 % 4 === 2)) this.hiss(0.035, 0.07, 'highpass', 7500, 7500, when, bus);
      if ([0, 3, 6, 8, 11, 14].includes(s16)) {
        const f = this._note(root + (s16 === 11 ? 4 : 0), -2);
        this.tone(m.mode === 'boss' ? 'sawtooth' : 'triangle', f, f, 0.16, m.mode === 'boss' ? 0.13 : 0.24, when, bus);
      }
    } else if (s16 === 0 || s16 === 8) {
      const f = this._note(root, -2);
      this.tone('triangle', f, f, 0.5, 0.2, when, bus);
    }
    // pad chord once per bar
    if (s16 === 0) {
      for (const d of [0, 2, 4]) {
        const f = this._note(root + d, -1);
        this.tone('sine', f, f, m.spb * 15, 0.055, when, bus, 0.25);
        this.tone('triangle', f * 1.004, f * 1.004, m.spb * 15, 0.03, when, bus, 0.3);
      }
    }
    // arpeggio
    if (s16 % 2 === 0) {
      const pat = [0, 2, 4, 2, 7, 4, 2, 4];
      const f = this._note(root + pat[(s16 >> 1) % 8], 0);
      this.tone('square', f, f, 0.09, full ? 0.028 : 0.02, when, bus);
    }
    // lead melody (two-bar phrases)
    if (s16 % 4 === 0 || (s16 % 4 === 2 && step % 32 > 20)) {
      const idx = ((step >> 1) % 32);
      const d = m.melody[idx];
      if (d >= 0 && (full || s16 % 8 === 0)) {
        const f = this._note(root + d, 1);
        this.tone(m.cfg.lead, f, f, m.spb * 3.2, m.cfg.lead === 'sine' ? 0.085 : 0.05, when, bus, 0.012);
      }
    }
  }
}

// minimum time between two plays of the same effect (keeps crowds from clipping the mix)
const GAPS = {
  shot: 0.055, pop: 0.045, popE: 0.04, gate: 0.035, fortHit: 0.06, blockHit: 0.06, coin: 0.09, saw: 0.06, fall: 0.15,
  explo: 0.08, shield: 0.12, bigPop: 0.1, shell: 0.2,
};
