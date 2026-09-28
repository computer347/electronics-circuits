/**
 * Oscilloscope acquisition: turns a stream of simulator samples into beam sweeps.
 *
 * The simulator pushes (t, ch1, ch2) samples. The acquisition waits for a trigger (the
 * trigger channel crossing the level on the chosen edge), then sweeps the beam across
 * ten divisions, starting one division before the trigger point so the edge itself is on
 * screen. In Auto mode it free-runs if no trigger arrives, so flat DC lines still show.
 *
 * Pure logic, no rendering: the phosphor screen drains the beam points with `take()`.
 */

export type ScopeCh = 'ch1' | 'ch2';
export type TriggerEdge = 'rise' | 'fall';
export type TriggerMode = 'auto' | 'normal' | 'single';

export const DIVS_X = 10;
export const DIVS_Y = 8;
/** Beam points per screen width. The simulator steps at tdiv * DIVS_X / SAMPLES_PER_SCREEN. */
export const SAMPLES_PER_SCREEN = 500;
/** Divisions of pre-trigger shown left of the trigger point. */
export const PRE_TRIGGER_DIVS = 1;

/** 1-2-5 steps, like the knobs on a real scope. */
export const VDIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
export const TDIV_STEPS = [
  10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6,
  1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3, 100e-3, 200e-3, 500e-3,
];

export interface TriggerSettings {
  source: ScopeCh;
  level: number;
  edge: TriggerEdge;
  mode: TriggerMode;
}

export interface Sample { t: number; v1: number; v2: number }

/** One beam position: x in screen widths (0..1). `jump` starts a new stroke (beam blanked in between). */
export interface BeamPoint { x: number; v1: number; v2: number; jump: boolean }

export type AcqState = 'waiting' | 'sweeping' | 'stopped';

/** Simulation step for a timebase. */
export const simStep = (tdiv: number) => (tdiv * DIVS_X) / SAMPLES_PER_SCREEN;

/**
 * Real seconds one sweep takes on screen. Slow timebases run in real time; fast ones are
 * slowed down so the sweep is still visible (the bench runs in slow motion to match).
 */
export const sweepSeconds = (tdiv: number) => Math.max(0.5, tdiv * DIVS_X);

/** Simulated seconds per real second for a timebase (1 = real time). */
export const simRate = (tdiv: number) => (tdiv * DIVS_X) / sweepSeconds(tdiv);

export class ScopeAcquisition {
  state: AcqState = 'waiting';
  /** Whether the sweep on screen was started by a real trigger (false = auto free-run). */
  triggered = false;
  /** Samples of the last finished sweep, for measurements. */
  lastSweep: Sample[] = [];
  /** Sim time at the left edge of the last finished sweep. */
  lastStart = 0;

  private history: Sample[] = [];
  /** The last few screen widths of samples, so the frequency counter works even with under two periods on screen. */
  private recentBuf: Sample[] = [];
  private sweep: Sample[] = [];
  private sweepStart = 0;
  private waitingSince: number | null = null;
  private prev: Sample | null = null;
  private out: BeamPoint[] = [];

  constructor(public tdiv: number, public trigger: TriggerSettings) {}

  get span() { return this.tdiv * DIVS_X; }

  /** Clear everything (e.g. the timebase changed). */
  reset() {
    this.state = 'waiting';
    this.triggered = false;
    this.history = [];
    this.recentBuf = [];
    this.sweep = [];
    this.lastSweep = [];
    this.waitingSince = null;
    this.prev = null;
    this.out = [];
  }

  /** What to measure: the last full sweep, or the one in progress before the first finishes. */
  get measured(): Sample[] { return this.lastSweep.length ? this.lastSweep : this.sweep; }

  /** Forget the frequency counter's history (the circuit or the probes changed). */
  resetRecent() { this.recentBuf = []; }

  /** Recent samples (about four screen widths), for the frequency counter. */
  get recent(): readonly Sample[] { return this.recentBuf; }

  stop() { this.state = 'stopped'; }
  run() { if (this.state === 'stopped') { this.state = 'waiting'; this.waitingSince = null; this.prev = null; } }

  /** Beam points produced since the last call. */
  take(): BeamPoint[] {
    const o = this.out;
    this.out = [];
    return o;
  }

  push(s: Sample) {
    if (this.state === 'stopped') return;
    this.history.push(s);
    // keep a little more than the pre-trigger window
    const keepFrom = s.t - this.tdiv * (PRE_TRIGGER_DIVS + 0.5);
    let drop = 0;
    while (drop < this.history.length - 2 && this.history[drop]!.t < keepFrom) drop++;
    if (drop > 64) this.history.splice(0, drop);
    this.recentBuf.push(s);
    if (this.recentBuf.length > SAMPLES_PER_SCREEN * 5) this.recentBuf.splice(0, SAMPLES_PER_SCREEN);

    const prev = this.prev;
    this.prev = s;

    if (this.state === 'waiting') {
      this.waitingSince ??= s.t;
      const tt = prev ? this.crossing(prev, s) : null;
      if (tt !== null) return this.begin(tt - this.tdiv * PRE_TRIGGER_DIVS, true);
      // Auto: free-run if no trigger comes. Wait longer after a triggered sweep, so a slow
      // periodic signal keeps its trigger; while already free-running, refresh quickly.
      const timeout = this.span * (this.triggered ? 2 : 0.25);
      if (this.trigger.mode === 'auto' && s.t - this.waitingSince >= timeout) return this.begin(s.t, false);
      return;
    }

    this.emit(s, false);
  }

  /** Trigger time between two samples, or null if the trigger channel doesn't cross there. */
  private crossing(a: Sample, b: Sample): number | null {
    const va = this.trigger.source === 'ch1' ? a.v1 : a.v2;
    const vb = this.trigger.source === 'ch1' ? b.v1 : b.v2;
    const L = this.trigger.level;
    const hit = this.trigger.edge === 'rise' ? va < L && vb >= L : va > L && vb <= L;
    if (!hit) return null;
    const f = vb === va ? 1 : (L - va) / (vb - va);
    return a.t + f * (b.t - a.t);
  }

  private begin(start: number, triggered: boolean) {
    this.state = 'sweeping';
    this.triggered = triggered;
    this.sweepStart = start;
    this.sweep = [];
    this.waitingSince = null;
    let first = true;
    for (const h of this.history) {
      if (h.t < start) continue;
      if (this.emit(h, first)) return;
      first = false;
    }
    if (first) this.out.push({ x: 0, v1: this.prev?.v1 ?? 0, v2: this.prev?.v2 ?? 0, jump: true });
  }

  /** Adds a sample to the sweep; returns true if that finished the sweep. */
  private emit(s: Sample, jump: boolean): boolean {
    const x = (s.t - this.sweepStart) / this.span;
    if (x > 1) {
      this.finish();
      return true;
    }
    this.sweep.push(s);
    this.out.push({ x: Math.max(0, x), v1: s.v1, v2: s.v2, jump });
    return false;
  }

  private finish() {
    this.lastSweep = this.sweep;
    this.lastStart = this.sweepStart;
    this.sweep = [];
    this.state = this.trigger.mode === 'single' && this.triggered ? 'stopped' : 'waiting';
    this.waitingSince = null;
  }
}

export interface ChannelStats {
  vmax: number;
  vmin: number;
  vpp: number;
  mean: number;
  /** Hz, if at least one full period is on screen. */
  freq?: number;
}

/** Scope-style measurements over a set of samples. */
export function measure(samples: readonly Sample[], ch: ScopeCh): ChannelStats | null {
  if (samples.length < 2) return null;
  const v = (s: Sample) => (ch === 'ch1' ? s.v1 : s.v2);
  let vmax = -Infinity, vmin = Infinity;
  for (const s of samples) { vmax = Math.max(vmax, v(s)); vmin = Math.min(vmin, v(s)); }
  const vpp = vmax - vmin;

  // Frequency: rising crossings of the midpoint, with 10 % hysteresis so noise can't double-count.
  let freq: number | undefined;
  const rises: number[] = [];
  if (vpp > 1e-6) {
    const mid = (vmax + vmin) / 2, hyst = vpp * 0.1;
    let armed = v(samples[0]!) < mid - hyst;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!, b = samples[i]!;
      if (v(b) < mid - hyst) armed = true;
      if (armed && v(a) < mid && v(b) >= mid) {
        const f = (mid - v(a)) / (v(b) - v(a));
        rises.push(a.t + f * (b.t - a.t));
        armed = false;
      }
    }
    if (rises.length >= 2) freq = (rises.length - 1) / (rises[rises.length - 1]! - rises[0]!);
  }

  // Mean over whole periods when there are any (a "cycle mean"), else over the whole screen.
  const [t0, t1] = freq ? [rises[0]!, rises[rises.length - 1]!] : [samples[0]!.t, samples[samples.length - 1]!.t];
  let area = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!, b = samples[i]!;
    const lo = Math.max(a.t, t0), hi = Math.min(b.t, t1);
    if (hi <= lo) continue;
    const va = v(a) + ((v(b) - v(a)) * (lo - a.t)) / (b.t - a.t || 1);
    const vb = v(a) + ((v(b) - v(a)) * (hi - a.t)) / (b.t - a.t || 1);
    area += ((va + vb) / 2) * (hi - lo);
  }
  const mean = t1 > t0 ? area / (t1 - t0) : v(samples[0]!);
  return { vmax, vmin, vpp, mean, freq };
}

/** Step a 1-2-5 value up or down, staying in range. */
export function stepValue(steps: readonly number[], value: number, dir: 1 | -1): number {
  let i = steps.findIndex((s) => Math.abs(s - value) < s * 1e-6);
  if (i < 0) i = steps.findIndex((s) => s > value);
  if (i < 0) i = steps.length - 1;
  return steps[Math.max(0, Math.min(steps.length - 1, i + dir))]!;
}
