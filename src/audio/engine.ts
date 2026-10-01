/**
 * Background music: soft jazz generated live with Web Audio, from the theory in jazz.ts. No
 * audio files: an FM electric piano comps rootless voicings, a bass walks, brushes and a ride
 * keep a swung time, a vibraphone plays the odd phrase, with a little room and vinyl crackle.
 * Each track's progression loops four times, then the next track starts. Nothing plays until
 * the first click or key press (browsers require it), and the choice is remembered.
 */
import { COMP_PATTERNS, hz, parseChord, phrase, rng, swing, TRACKS, voice, walk, type Chord } from './jazz';

const KEY = 'signal-path.music.v1';
const LOOPS = 4;

export interface MusicState { playing: boolean; on: boolean; volume: number; track: number }

function readPrefs(): { on: boolean; volume: number } {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null') as { on?: boolean; volume?: number } | null;
    return { on: v?.on ?? true, volume: typeof v?.volume === 'number' ? v.volume : 0.45 };
  } catch { return { on: true, volume: 0.45 }; }
}

class Music {
  private ctx: BaseAudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private nextBar = 0;
  private bar = 0;
  private loop = 0;
  private lastVoicing: number[] | undefined;
  private r = rng(Date.now() & 0xffff);
  private listeners = new Set<(s: MusicState) => void>();
  state: MusicState = { playing: false, ...readPrefs(), track: Math.floor(Math.random() * TRACKS.length) };

  subscribe(f: (s: MusicState) => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }
  private emit(patch: Partial<MusicState>) {
    this.state = { ...this.state, ...patch };
    try { globalThis.localStorage?.setItem(KEY, JSON.stringify({ on: this.state.on, volume: this.state.volume })); } catch { /* not saved */ }
    for (const f of this.listeners) f(this.state);
  }

  /** Build the signal chain: everything → bus → (dry + a little room) → soft lowpass → compressor → out. */
  private setup(ctx: BaseAudioContext = new AudioContext()) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.state.volume * 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.4;
    this.bus = ctx.createGain();
    const room = ctx.createConvolver();
    room.buffer = this.impulse(1.8);
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    this.bus.connect(tone); this.bus.connect(room); room.connect(wet); wet.connect(tone);
    tone.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
    // a second of white noise, for the drums and the crackle
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
    }
    return b;
  }

  // ---------------------------------------------------------------- voices

  /** Electric piano: a sine carrier with a sine modulator whose depth dies away (the tine's bark), and a slow tremolo. */
  private epiano(note: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx!, f = hz(note);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = ctx.createGain(), amp = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    modGain.gain.setValueAtTime(f * 1.4, t); modGain.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.35);
    mod.connect(modGain); modGain.connect(car.frequency);
    const peak = 0.11 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(peak * 0.35, t + Math.min(1.2, dur));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    const trem = ctx.createOscillator(), tremGain = ctx.createGain();
    trem.frequency.value = 4.2; tremGain.gain.value = peak * 0.18;
    trem.connect(tremGain); tremGain.connect(amp.gain);
    car.connect(amp); amp.connect(this.bus);
    for (const o of [car, mod, trem]) { o.start(t); o.stop(t + dur + 0.6); }
  }

  /** Upright-ish bass: a triangle and a sine an octave down, darkened, plucked. */
  private bass(note: number, t: number, dur: number) {
    const ctx = this.ctx!, f = hz(note);
    const a = ctx.createOscillator(), b = ctx.createOscillator(), lp = ctx.createBiquadFilter(), amp = ctx.createGain();
    a.type = 'triangle'; a.frequency.value = f; b.frequency.value = f / 2;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.25);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.32, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.14, t + 0.3);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    a.connect(lp); b.connect(lp); lp.connect(amp); amp.connect(this.bus);
    for (const o of [a, b]) { o.start(t); o.stop(t + dur); }
  }

  /** Vibraphone: a sine with its bright fourth harmonic dying fast, and the motor's tremolo. */
  private vibes(note: number, t: number, dur: number) {
    const ctx = this.ctx!, f = hz(note);
    const a = ctx.createOscillator(), b = ctx.createOscillator(), bg = ctx.createGain(), amp = ctx.createGain();
    a.frequency.value = f; b.frequency.value = f * 4;
    bg.gain.setValueAtTime(0.35, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.06, t + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4);
    const trem = ctx.createOscillator(), tg = ctx.createGain();
    trem.frequency.value = 5.5; tg.gain.value = 0.02;
    trem.connect(tg); tg.connect(amp.gain);
    b.connect(bg); bg.connect(amp); a.connect(amp); amp.connect(this.bus);
    for (const o of [a, b, trem]) { o.start(t); o.stop(t + dur + 1.5); }
  }

  /** Noise through a filter with a short envelope: brushes, ride, crackle. */
  private hiss(t: number, o: { type: BiquadFilterType; freq: number; q?: number; attack: number; decay: number; gain: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), amp = ctx.createGain();
    src.buffer = this.noise; src.loop = true;
    f.type = o.type; f.frequency.value = o.freq; f.Q.value = o.q ?? 0.7;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(o.gain, t + o.attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + o.attack + o.decay);
    src.connect(f); f.connect(amp); amp.connect(this.bus);
    src.start(t, Math.random() * 0.9); src.stop(t + o.attack + o.decay + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), amp = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    amp.gain.setValueAtTime(0.18, t); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(amp); amp.connect(this.bus); o.start(t); o.stop(t + 0.32);
  }

  // ---------------------------------------------------------------- the band

  private scheduleBar(t0: number) {
    const track = TRACKS[this.state.track]!;
    const beat = 60 / track.bpm;
    const at = (b: number) => t0 + swing(b) * beat;
    const chord: Chord = parseChord(track.bars[this.bar]!);
    const next = parseChord(track.bars[(this.bar + 1) % track.bars.length]!);
    const r = this.r;

    // piano: a relaxed comping pattern, the voicing gliding from the last one
    const v = voice(chord, this.lastVoicing);
    this.lastVoicing = v;
    const pattern = COMP_PATTERNS[Math.floor(r() * COMP_PATTERNS.length)]!;
    pattern.forEach((b, i) => {
      const len = (pattern[i + 1] ?? 4) - b;
      v.forEach((n, k) => this.epiano(n, at(b) + k * 0.006, Math.max(0.4, len * beat * 0.9), 0.7 + r() * 0.25));
    });
    // bass: walking quarters
    walk(chord, next, r).forEach((n, i) => this.bass(n, at(i), beat * 0.95));
    // drums: ride on 1, 2, 2&, 3, 4, 4&; brushes swish on 2 and 4; a soft kick now and then
    for (const b of [0, 1, 1.5, 2, 3, 3.5]) this.hiss(at(b), { type: 'highpass', freq: 7000, attack: 0.003, decay: b % 1 ? 0.08 : 0.16, gain: b % 1 ? 0.025 : 0.04 });
    for (const b of [1, 3]) this.hiss(at(b) - 0.04, { type: 'bandpass', freq: 2400, q: 0.5, attack: 0.05, decay: 0.22, gain: 0.05 });
    if (this.bar % 2 === 0 && r() < 0.6) this.kick(at(0));
    // vibes: now and then, a short phrase
    if (this.loop > 0) for (const p of phrase(chord, track.key, r)) this.vibes(p.note, at(p.beat), p.len * beat);
    // vinyl crackle
    for (let k = 0; k < 3; k++) if (r() < 0.6) this.hiss(t0 + r() * 4 * beat, { type: 'highpass', freq: 3000, attack: 0.001, decay: 0.012, gain: 0.02 + r() * 0.03 });

    this.nextBar = t0 + 4 * beat;
    this.bar++;
    if (this.bar >= track.bars.length) {
      this.bar = 0;
      this.loop++;
      if (this.loop >= LOOPS) { this.loop = 0; this.nextBar += beat * 2; this.emit({ track: (this.state.track + 1) % TRACKS.length }); }
    }
  }

  private tick = () => {
    if (!this.ctx) return;
    while (this.nextBar < this.ctx.currentTime + 0.6) this.scheduleBar(Math.max(this.nextBar, this.ctx.currentTime + 0.05));
  };

  // ---------------------------------------------------------------- controls

  play() {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) this.setup();
    void (this.ctx as AudioContext).resume();
    if (this.timer === null) {
      this.nextBar = this.ctx!.currentTime + 0.1;
      this.timer = window.setInterval(this.tick, 120);
      this.tick();
    }
    this.emit({ playing: true, on: true });
  }

  pause() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    void (this.ctx as AudioContext | null)?.suspend();
    this.emit({ playing: false, on: false });
  }

  toggle() { if (this.state.playing) this.pause(); else this.play(); }

  /**
   * Render a few seconds of the current track into a buffer, offline, and report how loud it
   * is (peak and RMS, 1 = full scale). For checking the mix without speakers (dev and tests).
   */
  async renderOffline(seconds: number): Promise<{ peak: number; rms: number }> {
    const saved = { ctx: this.ctx, master: this.master, bus: this.bus, noise: this.noise, nextBar: this.nextBar, bar: this.bar, loop: this.loop, last: this.lastVoicing };
    const off = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
    this.setup(off);
    this.nextBar = 0.05; this.bar = 0; this.loop = 1; this.lastVoicing = undefined;
    while (this.nextBar < seconds) this.scheduleBar(this.nextBar);
    const buf = await off.startRendering();
    Object.assign(this, { ctx: saved.ctx, master: saved.master, bus: saved.bus, noise: saved.noise, nextBar: saved.nextBar, bar: saved.bar, loop: saved.loop, lastVoicing: saved.last });
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0;
    for (const x of d) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
    return { peak, rms: Math.sqrt(sum / d.length) };
  }

  next() {
    this.bar = 0; this.loop = 0; this.lastVoicing = undefined;
    this.emit({ track: (this.state.track + 1) % TRACKS.length });
    if (this.ctx && this.state.playing) this.nextBar = this.ctx.currentTime + 0.4;
  }

  setVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    if (this.ctx) this.master.gain.setTargetAtTime(vol * 0.5, this.ctx.currentTime, 0.05);
    this.emit({ volume: vol });
  }
}

export const music = new Music();
