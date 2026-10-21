/**
 * All of Beaver Banff's audio, synthesised live with the Web Audio API (no sound files to load):
 * a gentle generative acoustic soundtrack, footsteps, splashes, coin chimes, a town bell,
 * sled whoosh and positional ambience (crackling fires, rushing water, birds by day and
 * crickets by night).
 *
 * Browsers only allow audio after the player interacts, so the context starts on the first
 * tap or key press.
 */

export type Sfx =
  | "coin" | "pop" | "splash" | "strum" | "bell" | "whoosh" | "quest" | "click" | "shutter" | "chime"
  | "step-grass" | "step-stone" | "step-wood" | "step-snow" | "paddle" | "countdown" | "go";

export interface SoundSettings { music: number; sfx: number; ambience: number }

const KEY = "bb-sound";
const DEFAULTS: SoundSettings = { music: 0.55, sfx: 0.8, ambience: 0.7 };

function loadSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** G major-ish chord loop for the daytime village; softer voicings at night. */
const CHORDS: number[][] = [
  [55, 59, 62, 67], // G
  [50, 57, 62, 66], // D/F#… (D)
  [52, 59, 64, 67], // Em
  [48, 55, 60, 64], // C
  [55, 59, 62, 67], // G
  [52, 59, 64, 67], // Em
  [48, 55, 60, 64], // C
  [50, 57, 62, 66], // D
];
const PENTA = [67, 69, 71, 74, 76, 79, 81];

export class Sound {
  settings = loadSettings();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private nextBeat = 0;
  private beat = 0;
  private timer: number | null = null;
  private amb: Record<"fire" | "water" | "birds" | "crickets" | "wind", { gain: GainNode; target: number }> | null = null;
  private night = 0;
  private mode: "village" | "race" | "cabin" | "title" = "title";
  private whooshGain: GainNode | null = null;
  private lastBird = 0;
  private rainGain: GainNode | null = null;

  constructor() {
    const start = () => {
      this.unlock();
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get ready() {
    return !!this.ctx;
  }

  private unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(this.master);
    // A soft room reverb for the music (feedback delay network-lite).
    const rev = ctx.createConvolver();
    rev.buffer = this.impulse(2.2);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.35;
    this.musicBus.connect(rev).connect(revGain).connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.startAmbience();
    this.nextBeat = ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** Apply the volume settings (and save them). */
  apply() {
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.settings.music * 0.5, t, 0.2);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.settings.ambience * 0.6, t, 0.2);
  }

  setMode(mode: "village" | "race" | "cabin" | "title") {
    this.mode = mode;
    if (mode === "title") this.setRain(0);
    if (mode !== "village" && this.amb) for (const k of Object.keys(this.amb) as (keyof NonNullable<typeof this.amb>)[]) this.amb[k].target = 0;
    if (mode !== "race") this.setWhoosh(0);
  }

  /** 0 = day, 1 = deep night: changes the music's mood and swaps birds for crickets. */
  setNight(n: number) {
    this.night = n;
  }

  // ------------------------------------------------------------------ Music

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.settings.music <= 0.001) {
      if (ctx) this.nextBeat = ctx.currentTime + 0.1;
      return;
    }
    const bpm = this.mode === "race" ? 132 : this.night > 0.6 ? 70 : 84;
    const step = 60 / bpm / 2; // eighth notes
    while (this.nextBeat < ctx.currentTime + 0.25) {
      this.playStep(this.beat, this.nextBeat, step);
      this.nextBeat += step;
      this.beat++;
    }
  }

  private playStep(i: number, t: number, step: number) {
    const bar = Math.floor(i / 8) % CHORDS.length;
    const pos = i % 8;
    const chord = CHORDS[bar];
    const soft = this.night > 0.6 ? 0.6 : 1;
    if (this.mode === "race") {
      // Driving chiptune-ish bass and arps for the races.
      if (pos % 2 === 0) this.pluck(midi(chord[0] - 12), t, 0.22, 0.32, "square", 900);
      this.pluck(midi(chord[(pos * 3) % 4] + 12), t, 0.12, 0.09, "triangle", 2600);
      if (pos === 0 || pos === 4) this.kick(t);
      if (pos === 2 || pos === 6) this.hat(t, 0.08);
      return;
    }
    // Fingerpicked guitar: bass on the beat, then rolling chord tones.
    const pattern = [0, 2, 1, 3, 0, 2, 1, 3];
    if (pos === 0 || pos === 4) this.pluck(midi(chord[0] - 12), t, 1.4, 0.26 * soft, "triangle", 1200);
    this.pluck(midi(chord[pattern[pos]]), t, 1.1, 0.13 * soft, "triangle", 2400);
    // Occasional melody from the pentatonic scale (more sparse at night).
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const r = seed - Math.floor(seed);
    if ((pos === 0 || pos === 3 || pos === 6) && r < (this.night > 0.6 ? 0.25 : 0.45)) {
      const n = PENTA[Math.floor(r * 1000) % PENTA.length];
      this.pluck(midi(n), t + 0.01, 1.6, 0.11 * soft, "sine", 3200);
    }
    // A warm pad under every bar.
    if (pos === 0) for (const n of chord.slice(1)) this.pad(midi(n), t, step * 8, 0.025 * soft);
  }

  private pluck(freq: number, t: number, dur: number, vol: number, type: OscillatorType, cutoff: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.25), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = det;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.25);
  }

  private hat(t: number, vol: number) {
    this.noiseBurst(t, 0.05, vol, 7000, "highpass", this.musicBus);
  }

  // ------------------------------------------------------------------ Sound effects

  private noiseBurst(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType, bus: AudioNode, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  private tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType = "sine", slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name: Sfx, vol = 1) {
    const ctx = this.ctx;
    if (!ctx || this.settings.sfx <= 0.001) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case "coin":
        this.tone(1318, t, 0.12, 0.25 * vol, "square");
        this.tone(1976, t + 0.07, 0.3, 0.22 * vol, "square");
        break;
      case "chime":
        [988, 1319, 1568].forEach((f, i) => this.tone(f, t + i * 0.06, 0.6, 0.15 * vol, "sine"));
        break;
      case "quest":
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.09, 0.5, 0.18 * vol, "triangle"));
        break;
      case "pop":
        this.tone(520, t, 0.12, 0.25 * vol, "sine", 900);
        break;
      case "click":
        this.tone(1200, t, 0.04, 0.1 * vol, "square");
        break;
      case "splash":
        this.noiseBurst(t, 0.6, 0.5 * vol, 1400, "bandpass", this.sfxBus, 0.7);
        this.noiseBurst(t + 0.05, 0.9, 0.25 * vol, 600, "lowpass", this.sfxBus);
        break;
      case "paddle":
        this.noiseBurst(t, 0.25, 0.22 * vol, 900, "bandpass", this.sfxBus, 1.2);
        break;
      case "strum":
        [55, 59, 62, 67, 71].forEach((n, i) => {
          const o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.value = midi(n);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t + i * 0.02);
          g.gain.exponentialRampToValueAtTime(0.12 * vol, t + i * 0.02 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.02 + 1.4);
          o.connect(g).connect(this.sfxBus);
          o.start(t + i * 0.02);
          o.stop(t + 1.6);
        });
        break;
      case "bell":
        for (const [f, v] of [[392, 0.3], [784, 0.14], [1180, 0.08], [523, 0.1]] as [number, number][]) this.tone(f, t, 3.2, v * vol, "sine");
        for (const [f, v] of [[392, 0.24], [784, 0.1]] as [number, number][]) this.tone(f, t + 1.1, 2.8, v * vol, "sine");
        break;
      case "shutter":
        this.noiseBurst(t, 0.05, 0.4 * vol, 3000, "highpass", this.sfxBus);
        this.noiseBurst(t + 0.09, 0.06, 0.3 * vol, 2500, "highpass", this.sfxBus);
        break;
      case "whoosh":
        this.noiseBurst(t, 0.5, 0.3 * vol, 1200, "bandpass", this.sfxBus, 0.6);
        break;
      case "countdown":
        this.tone(660, t, 0.18, 0.25 * vol, "square");
        break;
      case "go":
        this.tone(990, t, 0.4, 0.28 * vol, "square");
        break;
      case "step-grass":
        this.noiseBurst(t, 0.08, 0.06 * vol, 2500, "bandpass", this.sfxBus, 0.8);
        break;
      case "step-stone":
        this.noiseBurst(t, 0.05, 0.09 * vol, 1800, "bandpass", this.sfxBus, 2.5);
        this.tone(160 + Math.random() * 40, t, 0.05, 0.05 * vol, "sine");
        break;
      case "step-wood":
        this.tone(140 + Math.random() * 30, t, 0.09, 0.12 * vol, "triangle");
        this.noiseBurst(t, 0.04, 0.05 * vol, 900, "bandpass", this.sfxBus, 2);
        break;
      case "step-snow":
        this.noiseBurst(t, 0.12, 0.08 * vol, 1200, "lowpass", this.sfxBus);
        break;
    }
  }

  /** Continuous sled/canoe rush, 0..1. */
  setWhoosh(level: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.whooshGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 800;
      f.Q.value = 0.5;
      this.whooshGain = ctx.createGain();
      this.whooshGain.gain.value = 0;
      src.connect(f).connect(this.whooshGain).connect(this.sfxBus);
      src.start();
    }
    this.whooshGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, ctx.currentTime, 0.1);
  }

  // ------------------------------------------------------------------ Ambience

  private startAmbience() {
    const ctx = this.ctx!;
    const loop = (freq: number, type: BiquadFilterType, q: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.ambBus);
      src.start();
      return { gain: g, target: 0 };
    };
    this.amb = {
      water: loop(700, "lowpass", 0.5),
      wind: loop(350, "lowpass", 0.3),
      fire: { gain: ctx.createGain(), target: 0 },
      birds: { gain: ctx.createGain(), target: 0 },
      crickets: { gain: ctx.createGain(), target: 0 },
    };
    for (const k of ["fire", "birds", "crickets"] as const) this.amb[k].gain.connect(this.ambBus);
  }

  /**
   * Called every frame by the village with how close the player is to water and fire (0..1).
   * Birds sing by day and crickets chirp at night.
   */
  updateAmbience(water: number, fire: number, dt: number) {
    const ctx = this.ctx;
    if (!ctx || !this.amb || this.mode !== "village") return;
    const t = ctx.currentTime;
    this.amb.water.gain.gain.setTargetAtTime(water * 0.5, t, 0.3);
    this.amb.wind.gain.gain.setTargetAtTime(0.06 + this.night * 0.04, t, 0.5);
    // Fire crackles: random little pops.
    if (fire > 0.05 && Math.random() < dt * 14 * fire) this.noiseBurst(t, 0.03 + Math.random() * 0.05, 0.25 * fire, 1500 + Math.random() * 2500, "bandpass", this.amb.fire.gain, 3);
    this.amb.fire.gain.gain.value = 1;
    // Birdsong by day.
    this.lastBird -= dt;
    if (this.night < 0.5 && this.lastBird <= 0) {
      this.lastBird = 1.5 + Math.random() * 4;
      const base = 2200 + Math.random() * 1600;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator();
        o.type = "sine";
        const st = t + i * 0.11;
        o.frequency.setValueAtTime(base, st);
        o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), st + 0.07);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.05 * (1 - this.night), st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.09);
        o.connect(g).connect(this.amb.birds.gain);
        o.start(st);
        o.stop(st + 0.12);
      }
      this.amb.birds.gain.gain.value = 1;
    }
    // Crickets at night.
    if (this.night > 0.4 && Math.random() < dt * 6) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = 4200 + Math.random() * 400;
      const g = ctx.createGain();
      for (let k = 0; k < 3; k++) {
        g.gain.setValueAtTime(0.012 * this.night, t + k * 0.05);
        g.gain.setValueAtTime(0, t + k * 0.05 + 0.025);
      }
      o.connect(g).connect(this.amb.crickets.gain);
      o.start(t);
      o.stop(t + 0.16);
      this.amb.crickets.gain.gain.value = 1;
    }
  }

  /** Steady rain on the roofs (0..1). */
  setRain(level: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2600;
      f.Q.value = 0.4;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.ambBus);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.35, ctx.currentTime, 0.8);
  }

  dispose() {
    if (this.timer !== null) clearInterval(this.timer);
  }
}
