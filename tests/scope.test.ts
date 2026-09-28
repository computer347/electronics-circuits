import { describe, expect, it } from 'vitest';
import {
  measure, ScopeAcquisition, simRate, simStep, stepValue, sweepSeconds,
  SAMPLES_PER_SCREEN, TDIV_STEPS, VDIV_STEPS, type BeamPoint, type Sample, type TriggerSettings,
} from '../src/instruments/scope';
import { Simulator, waveValue, type Circuit } from '../src/sim';

const trig = (p: Partial<TriggerSettings> = {}): TriggerSettings => ({ source: 'ch1', level: 0, edge: 'rise', mode: 'normal', ...p });

/** Feed a function of time into an acquisition at the scope's own sample rate. */
function feed(acq: ScopeAcquisition, f: (t: number) => number, duration: number, g: (t: number) => number = () => 0) {
  const dt = simStep(acq.tdiv);
  const pts: BeamPoint[] = [];
  for (let t = dt; t <= duration + 1e-12; t += dt) {
    acq.push({ t, v1: f(t), v2: g(t) });
    pts.push(...acq.take());
  }
  return pts;
}

describe('waveforms', () => {
  const sq = { shape: 'square' as const, freq: 1000, vpp: 5, offset: 2.5 };
  it('square wave swings between offset ± vpp/2 with the given duty', () => {
    expect(waveValue(sq, 0)).toBe(5);
    expect(waveValue(sq, 0.4e-3)).toBe(5);
    expect(waveValue(sq, 0.6e-3)).toBe(0);
    expect(waveValue({ ...sq, duty: 0.25 }, 0.3e-3)).toBe(0);
  });
  it('sine and triangle hit their peaks at the right phase', () => {
    const s = { shape: 'sine' as const, freq: 50, vpp: 2, offset: 1 };
    expect(waveValue(s, 0.005)).toBeCloseTo(2, 9);
    expect(waveValue(s, 0.015)).toBeCloseTo(0, 9);
    const tri = { shape: 'triangle' as const, freq: 1, vpp: 4, offset: 0 };
    expect(waveValue(tri, 0)).toBeCloseTo(-2);
    expect(waveValue(tri, 0.5)).toBeCloseTo(2);
    expect(waveValue(tri, 0.25)).toBeCloseTo(0);
  });
  it('drives a voltage source in transient', () => {
    const c: Circuit = { components: [
      { kind: 'vsource', id: 'FG', a: 'in', b: '0', volts: 0, wave: sq },
      { kind: 'resistor', id: 'R', a: 'in', b: '0', ohms: 1000 },
    ] };
    const sim = new Simulator(c);
    const s = sim.run(2e-3, 1e-5);
    expect(s.find((x) => Math.abs(x.t - 0.3e-3) < 1e-9)!.nodeVoltages.in).toBeCloseTo(5);
    expect(s.find((x) => Math.abs(x.t - 0.7e-3) < 1e-9)!.nodeVoltages.in).toBeCloseTo(0);
  });
});

describe('RC low-pass on a square wave', () => {
  // 1 kHz, 0–5 V into 1 kΩ / 100 nF (τ = 0.1 ms). In steady state the capacitor swings
  // between 5/(1+k) and 5k/(1+k), where k = exp(-T/2 / τ).
  it('settles to the textbook ripple', () => {
    const c: Circuit = { components: [
      { kind: 'vsource', id: 'FG', a: 'in', b: '0', volts: 2.5, wave: { shape: 'square', freq: 1000, vpp: 5, offset: 2.5 } },
      { kind: 'resistor', id: 'R', a: 'in', b: 'out', ohms: 1000 },
      { kind: 'capacitor', id: 'C', a: 'out', b: '0', farads: 100e-9 },
    ] };
    const sim = new Simulator(c);
    const tau = 1e-4, k = Math.exp(-0.5e-3 / tau);
    const s = sim.run(10e-3, 1e-6).filter((x) => x.t > 8e-3);
    const v = s.map((x) => x.nodeVoltages.out!);
    // backward Euler at dt = τ/100 is within about 1 %
    expect(Math.max(...v)).toBeCloseTo(5 / (1 + k), 1);
    expect(Math.min(...v)).toBeCloseTo((5 * k) / (1 + k), 1);
  });
});

describe('scope timebase', () => {
  it('uses 1-2-5 steps and clamps at the ends', () => {
    expect(stepValue(VDIV_STEPS, 1, 1)).toBe(2);
    expect(stepValue(VDIV_STEPS, 2, 1)).toBe(5);
    expect(stepValue(VDIV_STEPS, 0.01, -1)).toBe(0.01);
    expect(stepValue(TDIV_STEPS, 1e-3, -1)).toBe(500e-6);
    expect(stepValue(TDIV_STEPS, 0.5, 1)).toBe(0.5);
  });
  it('runs slow timebases in real time and slows fast ones down', () => {
    expect(simRate(0.1)).toBe(1);
    expect(sweepSeconds(0.1)).toBe(1);
    expect(simRate(1e-3)).toBeCloseTo(0.02);
    expect(simStep(1e-3) * SAMPLES_PER_SCREEN).toBeCloseTo(10e-3);
  });
});

describe('scope trigger and sweep', () => {
  const sine = (t: number) => Math.sin(2 * Math.PI * 200 * t + 1);

  it('starts every sweep at the same phase (a stable picture)', () => {
    const acq = new ScopeAcquisition(1e-3, trig({ level: 0.5 }));
    const pts = feed(acq, sine, 0.1);
    const starts = pts.map((p, i) => ({ p, i })).filter(({ p }) => p.jump);
    expect(starts.length).toBeGreaterThan(5);
    // one division in (pre-trigger), the trace crosses 0.5 going up
    for (const { i } of starts.slice(1)) {
      const sweep = pts.slice(i, i + 200);
      const at = sweep.find((p) => p.x >= 0.1)!;
      expect(at.v1).toBeGreaterThan(0.45);
      expect(at.v1).toBeLessThan(0.6);
    }
  });

  it('never sweeps in Normal mode without a trigger, but free-runs in Auto', () => {
    const flat = () => 1;
    const normal = new ScopeAcquisition(1e-3, trig({ level: 3 }));
    expect(feed(normal, flat, 0.1)).toHaveLength(0);
    const auto = new ScopeAcquisition(1e-3, trig({ level: 3, mode: 'auto' }));
    const pts = feed(auto, flat, 0.1);
    expect(pts.length).toBeGreaterThan(SAMPLES_PER_SCREEN);
    expect(auto.triggered).toBe(false);
    expect(pts.every((p) => p.v1 === 1 && p.x >= 0 && p.x <= 1)).toBe(true);
  });

  it('keeps refreshing a flat line in Auto without long gaps', () => {
    const auto = new ScopeAcquisition(1e-3, trig({ level: 3, mode: 'auto' }));
    const pts = feed(auto, () => 1, 0.1); // ten screen widths
    expect(pts.filter((p) => p.jump).length).toBeGreaterThanOrEqual(7);
  });

  it('falls on the falling edge when asked', () => {
    const acq = new ScopeAcquisition(1e-3, trig({ level: 0, edge: 'fall' }));
    const pts = feed(acq, sine, 0.05);
    const i = pts.findIndex((p) => p.jump);
    const after = pts.slice(i).filter((p) => p.x > 0.1 && p.x < 0.12);
    expect(after[after.length - 1]!.v1).toBeLessThan(after[0]!.v1);
  });

  it('single mode stops after one triggered sweep', () => {
    const acq = new ScopeAcquisition(1e-3, trig({ level: 0.5, mode: 'single' }));
    feed(acq, sine, 0.1);
    expect(acq.state).toBe('stopped');
    expect(acq.lastSweep.length).toBeGreaterThan(SAMPLES_PER_SCREEN * 0.9);
  });

  it('can trigger on channel 2 while showing both', () => {
    const acq = new ScopeAcquisition(1e-3, trig({ source: 'ch2', level: 0.5 }));
    const pts = feed(acq, () => 7, 0.05, sine);
    expect(pts.some((p) => p.jump)).toBe(true);
    expect(pts.every((p) => p.v1 === 7)).toBe(true);
  });
});

describe('scope measurements', () => {
  const samples = (f: (t: number) => number, T: number, n = 2000): Sample[] =>
    Array.from({ length: n + 1 }, (_, i) => { const t = (i / n) * T; return { t, v1: f(t), v2: 0 }; });

  it('reads Vpp, mean and frequency of a sine', () => {
    const m = measure(samples((t) => 1 + 2 * Math.sin(2 * Math.PI * 250 * t), 0.01), 'ch1')!;
    expect(m.vpp).toBeCloseTo(4, 2);
    expect(m.mean).toBeCloseTo(1, 2);
    expect(m.freq).toBeCloseTo(250, 0);
  });

  it('reads a square wave frequency and ignores a flat line', () => {
    const sq = samples((t) => waveValue({ shape: 'square', freq: 1000, vpp: 5, offset: 2.5 }, t), 0.01);
    expect(measure(sq, 'ch1')!.freq).toBeCloseTo(1000, -1);
    const flat = measure(samples(() => 3.3, 0.01), 'ch1')!;
    expect(flat.vpp).toBe(0);
    expect(flat.mean).toBeCloseTo(3.3);
    expect(flat.freq).toBeUndefined();
  });
});
