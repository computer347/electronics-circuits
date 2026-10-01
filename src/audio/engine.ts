/**
 * Background music: jazz, bossa nova and lo-fi generated live from the theory in jazz.ts and
 * played on real sampled instruments (FluidR3 GM: electric piano, acoustic bass, vibraphone,
 * nylon guitar, grand piano; CC BY 3.0, see docs/CREDITS.md). The drums are synthesised.
 *
 * Every track is a song, not a loop: an intro (chords and bass), two full choruses with the
 * track's melody motif, a quieter breakdown, then the next track. Timing and touch are
 * humanised, and a slow tape wobble bends the pitch a few cents. Until a track's samples have
 * loaded, simple synth voices stand in. Nothing plays before the first click or key press
 * (browsers require it), and the on/off choice and volume are remembered.
 */
import { BOSSA_BASS, BOSSA_CLAVE, BOSSA_COMP, COMP_PATTERNS, hz, LOFI_KICK, motif, parseChord, playMotif, rng, swing, TRACKS, voice, walk, type Chord, type Instrument, type Track } from './jazz';

const KEY = 'signal-path.music.v1';
/** Choruses per track: intro, two full, breakdown. */
const FORM = ['intro', 'full', 'full', 'breakdown'] as const;
const SAMPLES = '/music/samples';
/** Master level at full volume (the samples are recorded quietly). */
const MASTER = 1.5;

export interface MusicState { playing: boolean; on: boolean; volume: number; track: number; loading: boolean }

function readPrefs(): { on: boolean; volume: number } {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null') as { on?: boolean; volume?: number } | null;
    return { on: v?.on ?? true, volume: typeof v?.volume === 'number' ? v.volume : 0.5 };
  } catch { return { on: true, volume: 0.5 }; }
}

/** How each instrument sits in the mix: level, release, and a tone filter. */
const MIX: Record<Instrument, { gain: number; release: number; cutoff: number }> = {
  epiano: { gain: 0.7, release: 0.5, cutoff: 3800 },
  piano: { gain: 0.62, release: 0.6, cutoff: 4200 },
  guitar: { gain: 0.85, release: 0.4, cutoff: 4500 },
  vibes: { gain: 0.5, release: 1.2, cutoff: 6000 },
  bass: { gain: 1.2, release: 0.15, cutoff: 1400 },
};

class Music {
  private ctx: BaseAudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private tone!: BiquadFilterNode;
  private wobble!: GainNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private nextBar = 0;
  private bar = 0;
  private chorus = 0;
  private lastVoicing: number[] | undefined;
  private melodyNote = 72;
  private r = rng(Date.now() & 0xffff);
  private index: Record<string, number[]> | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loads = new Map<Instrument, Promise<void>>();
  private listeners = new Set<(s: MusicState) => void>();
  state: MusicState = { playing: false, ...readPrefs(), track: Math.floor(Math.random() * TRACKS.length), loading: false };

  subscribe(f: (s: MusicState) => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }
  private emit(patch: Partial<MusicState>) {
    this.state = { ...this.state, ...patch };
    try { globalThis.localStorage?.setItem(KEY, JSON.stringify({ on: this.state.on, volume: this.state.volume })); } catch { /* not saved */ }
    for (const f of this.listeners) f(this.state);
  }

  // ---------------------------------------------------------------- the room

  private setup(ctx: BaseAudioContext = new AudioContext()) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.state.volume * MASTER;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass'; this.tone.frequency.value = 6000; this.tone.Q.value = 0.4;
    this.bus = ctx.createGain();
    const room = ctx.createConvolver();
    room.buffer = this.impulse(2.2);
    const wet = ctx.createGain(); wet.gain.value = 0.2;
    this.bus.connect(this.tone); this.bus.connect(room); room.connect(wet); wet.connect(this.tone);
    this.tone.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
    // the tape wobble: a slow LFO, in cents, fed to every sampled note's detune
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    this.wobble = ctx.createGain(); this.wobble.gain.value = 5;
    lfo.connect(this.wobble); lfo.start();
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
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8;
    }
    return b;
  }

  // ---------------------------------------------------------------- samples

  /** Fetch and decode an instrument's notes (once); later calls share the same promise. */
  private load(inst: Instrument): Promise<void> {
    const have = this.loads.get(inst);
    if (have) return have;
    const p = (async () => {
      if (!this.index) this.index = await (await fetch(`${SAMPLES}/index.json`)).json() as Record<string, number[]>;
      const notes = this.index[inst] ?? [];
      await Promise.all(notes.map(async (n) => {
        try {
          const data = await (await fetch(`${SAMPLES}/${inst}/${n}.mp3`)).arrayBuffer();
          this.buffers.set(`${inst}:${n}`, await this.ctx!.decodeAudioData(data));
        } catch { /* a missing note falls back to its neighbour */ }
      }));
    })();
    this.loads.set(inst, p);
    return p;
  }

  private loadTrack(t: Track) { return Promise.all([this.load(t.comp), this.load(t.lead), this.load('bass')]); }

  /** The nearest recorded note to `note`, and how far to bend it (in semitones). */
  private sample(inst: Instrument, note: number): { buf: AudioBuffer; shift: number } | null {
    for (let d = 0; d <= 12; d++) for (const n of d ? [note - d, note + d] : [note]) {
      const buf = this.buffers.get(`${inst}:${n}`);
      if (buf) return { buf, shift: note - n };
    }
    return null;
  }

  /** One note on a sampled instrument; falls back to a synth voice if it isn't loaded yet. */
  private note(inst: Instrument, note: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const s = this.sample(inst, note);
    if (!s) { this.synth(inst, note, t, dur, vel); return; }
    const mix = MIX[inst];
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), amp = ctx.createGain();
    src.buffer = s.buf;
    src.playbackRate.value = 2 ** (s.shift / 12);
    this.wobble.connect(src.detune);
    lp.type = 'lowpass'; lp.frequency.value = mix.cutoff * (0.7 + 0.3 * vel);
    const g = mix.gain * vel;
    const end = t + Math.min(dur, s.buf.duration);
    amp.gain.setValueAtTime(g, t);
    amp.gain.setValueAtTime(g, end);
    amp.gain.exponentialRampToValueAtTime(0.0001, end + mix.release);
    src.connect(lp); lp.connect(amp); amp.connect(this.bus);
    src.start(t); src.stop(end + mix.release + 0.05);
  }

  /** Stand-in voices while samples load: a soft sine-and-triangle. */
  private synth(inst: Instrument, note: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), amp = ctx.createGain();
    o.type = inst === 'bass' ? 'triangle' : 'sine';
    o.frequency.value = hz(note);
    const peak = (inst === 'bass' ? 0.25 : 0.07) * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    o.connect(amp); amp.connect(this.bus); o.start(t); o.stop(t + dur + 0.35);
  }

  // ---------------------------------------------------------------- drums

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

  private thump(t: number, from: number, to: number, gain: number, decay: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), amp = ctx.createGain();
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.5);
    amp.gain.setValueAtTime(gain, t); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(amp); amp.connect(this.bus); o.start(t); o.stop(t + decay + 0.02);
  }

  private kick(t: number, g = 0.22) { this.thump(t, 95, 45, g, 0.32); }
  private snare(t: number, g = 0.1) { this.thump(t, 190, 150, g * 0.8, 0.12); this.hiss(t, { type: 'bandpass', freq: 1900, q: 0.8, attack: 0.002, decay: 0.16, gain: g }); }
  private rim(t: number) { this.thump(t, 1700, 1500, 0.05, 0.04); this.hiss(t, { type: 'bandpass', freq: 3200, q: 3, attack: 0.001, decay: 0.03, gain: 0.05 }); }

  // ---------------------------------------------------------------- the band, one bar at a time

  private scheduleBar(t0: number) {
    const track = TRACKS[this.state.track]!;
    const beat = 60 / track.bpm;
    const part = FORM[this.chorus]!;
    const style = track.style;
    const swingAmt = style === 'bossa' ? 0.5 : style === 'lofi' ? 0.56 : 0.62;
    const r = this.r;
    const human = () => (r() - 0.5) * 0.02;
    const at = (b: number) => t0 + swing(b, swingAmt) * beat + human();
    const vel = (base: number) => Math.min(1, base * (0.85 + r() * 0.25));
    const chord: Chord = parseChord(track.bars[this.bar]!);
    const next = parseChord(track.bars[(this.bar + 1) % track.bars.length]!);
    const v = voice(chord, this.lastVoicing);
    this.lastVoicing = v;
    // lo-fi tracks sit behind a darker filter and a wider wobble
    this.tone.frequency.setTargetAtTime(style === 'lofi' ? 2800 : 6000, t0, 0.5);
    this.wobble.gain.setTargetAtTime(style === 'lofi' ? 12 : 5, t0, 0.5);

    // ---- chords
    const strum = (b: number, len: number, level: number) => {
      const roll = track.comp === 'guitar' ? 0.018 : track.comp === 'piano' && style === 'ballad' ? 0.06 : 0.005;
      v.forEach((n, k) => this.note(track.comp, n, at(b) + k * roll, len * beat, vel(level)));
    };
    if (style === 'bossa') for (const b of BOSSA_COMP[this.bar % 2]!) strum(b, 1, 0.75);
    else if (style === 'lofi') { strum(0, 2.4, 0.8); if (r() < 0.5) strum(2.5, 1.4, 0.6); }
    else if (style === 'ballad') { strum(0, 3.8, 0.75); if (r() < 0.4) strum(2, 1.8, 0.5); }
    else {
      const pattern = COMP_PATTERNS[Math.floor(r() * COMP_PATTERNS.length)]!;
      pattern.forEach((b, i) => strum(b, Math.max(0.6, (pattern[i + 1] ?? 4) - b) * 0.9, 0.75));
    }

    // ---- bass
    const root = 36 + ((chord.root - 36) % 12 + 12) % 12;
    const low = root > 47 ? root - 12 : root;
    if (style === 'bossa') for (const n of BOSSA_BASS) this.note('bass', n.tone === 'root' ? low : low + chord.fifth, at(n.beat), n.len * beat, vel(0.8));
    else if (style === 'lofi') { this.note('bass', low, at(0), 2.2 * beat, vel(0.85)); this.note('bass', r() < 0.5 ? low : low + chord.fifth, at(2.5), 1.3 * beat, vel(0.7)); }
    else if (style === 'ballad' || part === 'intro') { this.note('bass', low, at(0), 1.9 * beat, vel(0.8)); this.note('bass', low + chord.fifth > 52 ? low + chord.fifth - 12 : low + chord.fifth, at(2), 1.9 * beat, vel(0.7)); }
    else walk(chord, next, r).forEach((n, i) => this.note('bass', n, at(i), 0.95 * beat, vel(0.8)));

    // ---- drums
    const quiet = part === 'intro' ? 0.5 : part === 'breakdown' ? 0.55 : 1;
    if (style === 'bossa') {
      for (let b = 0; b < 4; b += 0.5) this.hiss(at(b), { type: 'highpass', freq: 7500, attack: 0.004, decay: 0.06, gain: (b % 1 ? 0.018 : 0.026) * quiet });
      if (part !== 'intro') for (const b of BOSSA_CLAVE[this.bar % 2]!) this.rim(at(b));
      if (part === 'full') { this.kick(at(0), 0.14); this.kick(at(2), 0.12); }
    } else if (style === 'lofi') {
      for (let b = 0; b < 4; b += 0.5) this.hiss(at(b), { type: 'highpass', freq: 8000, attack: 0.002, decay: b % 1 ? 0.04 : 0.07, gain: (b % 1 ? 0.016 : 0.028) * quiet });
      if (part !== 'intro') {
        for (const b of LOFI_KICK[this.bar % 2]!) this.kick(at(b), 0.24 * quiet);
        this.snare(at(1), 0.09 * quiet); this.snare(at(3), 0.09 * quiet);
      }
    } else {
      // swing and ballad: ride (swung), brushes on 2 and 4, a soft kick now and then
      const ride = style === 'ballad' ? [0, 1, 2, 3] : [0, 1, 1.5, 2, 3, 3.5];
      for (const b of ride) this.hiss(at(b), { type: 'highpass', freq: 7000, attack: 0.003, decay: b % 1 ? 0.08 : 0.18, gain: (b % 1 ? 0.022 : 0.036) * quiet });
      for (const b of [1, 3]) this.hiss(at(b) - 0.04, { type: 'bandpass', freq: 2400, q: 0.5, attack: 0.05, decay: style === 'ballad' ? 0.4 : 0.22, gain: 0.045 * quiet });
      if (part === 'full' && this.bar % 2 === 0 && r() < 0.6) this.kick(at(0), 0.16);
    }

    // ---- melody: the track's motif, call and answer over two bars, in the full choruses
    if (part === 'full' || (part === 'breakdown' && this.bar < 4)) {
      const m = motif(track.id);
      if (this.bar % 2 === 0) this.melodyNote = this.bar % 4 === 0 ? 72 : this.melodyNote;
      const phrase = playMotif(m, (this.bar % 2) as 0 | 1, chord, track.key, this.melodyNote, this.chorus === 2 ? 0.35 : 0.1, r);
      for (const p of phrase) this.note(track.lead, p.note, at(p.beat), p.len * beat * 0.95, vel(part === 'breakdown' ? 0.55 : 0.75));
      if (phrase.length) this.melodyNote = phrase[phrase.length - 1]!.note;
    }

    // ---- vinyl crackle, more of it on lo-fi
    const crackles = style === 'lofi' ? 6 : 2;
    for (let k = 0; k < crackles; k++) if (r() < 0.6) this.hiss(t0 + r() * 4 * beat, { type: 'highpass', freq: 3000, attack: 0.001, decay: 0.012, gain: 0.015 + r() * 0.03 });

    this.nextBar = t0 + 4 * beat;
    this.bar++;
    if (this.bar >= track.bars.length) {
      this.bar = 0;
      this.chorus++;
      if (this.chorus >= FORM.length) { this.chorus = 0; this.nextBar += beat * 2; this.lastVoicing = undefined; this.emit({ track: (this.state.track + 1) % TRACKS.length }); this.prefetch(); }
    }
  }

  private prefetch() {
    const t = TRACKS[this.state.track]!;
    if (!this.ctx) return;
    const now = this.loadTrack(t);
    this.emit({ loading: true });
    void now.then(() => this.emit({ loading: false }));
    void this.loadTrack(TRACKS[(this.state.track + 1) % TRACKS.length]!);
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
    this.prefetch();
    if (this.timer === null) {
      this.nextBar = this.ctx!.currentTime + 0.15;
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

  next() {
    this.bar = 0; this.chorus = 0; this.lastVoicing = undefined;
    this.emit({ track: (this.state.track + 1) % TRACKS.length });
    this.prefetch();
    if (this.ctx && this.state.playing) this.nextBar = this.ctx.currentTime + 0.4;
  }

  setVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    if (this.ctx) this.master.gain.setTargetAtTime(vol * MASTER, this.ctx.currentTime, 0.05);
    this.emit({ volume: vol });
  }

  /**
   * Render a track offline with its samples, and report how loud it is (peak and RMS, 1 = full
   * scale). For checking the mix without speakers (dev), and for exporting a preview.
   */
  async renderOffline(seconds: number, trackIndex = this.state.track): Promise<{ peak: number; rms: number; buffer: AudioBuffer }> {
    const saved = { ctx: this.ctx, master: this.master, bus: this.bus, tone: this.tone, wobble: this.wobble, noise: this.noise, nextBar: this.nextBar, bar: this.bar, chorus: this.chorus, last: this.lastVoicing, track: this.state.track, buffers: this.buffers, loads: this.loads };
    const off = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
    this.buffers = new Map(); this.loads = new Map();
    this.setup(off);
    this.state = { ...this.state, track: trackIndex };
    await this.loadTrack(TRACKS[trackIndex]!);
    this.nextBar = 0.05; this.bar = 0; this.chorus = 1; this.lastVoicing = undefined;
    while (this.nextBar < seconds) this.scheduleBar(this.nextBar);
    const buffer = await off.startRendering();
    Object.assign(this, { ctx: saved.ctx, master: saved.master, bus: saved.bus, tone: saved.tone, wobble: saved.wobble, noise: saved.noise, nextBar: saved.nextBar, bar: saved.bar, chorus: saved.chorus, lastVoicing: saved.last, buffers: saved.buffers, loads: saved.loads });
    this.state = { ...this.state, track: saved.track };
    let peak = 0, sum = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) for (const x of buffer.getChannelData(ch)) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
    return { peak, rms: Math.sqrt(sum / (buffer.length * buffer.numberOfChannels)), buffer };
  }
}

export const music = new Music();
