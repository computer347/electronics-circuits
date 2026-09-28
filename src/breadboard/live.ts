/**
 * The live bench: a transient simulation of the breadboard that runs every frame, so
 * capacitors charge, function generators swing, and the oscilloscope has something to show.
 *
 * The bench runs on the scope's timebase: `simStep(tdiv)` per step and `simRate(tdiv)`
 * simulated seconds per real second. Slow timebases are real time; fast ones put the whole
 * bench in slow motion so you can watch a 1 kHz square wave charge a capacitor.
 *
 * Views that need per-frame data (the scope screen) read `bench.scope` directly. React
 * views get a throttled snapshot through `useLive`.
 */
import { create } from 'zustand';
import { Simulator, type Circuit, type SolveResult } from '../sim';
import { ScopeAcquisition, simRate, simStep, type Sample } from '../instruments/scope';
import { useScope } from '../instruments/scopeStore';
import type { HoleId } from './layout';
import { boardToCircuit, type BoardState } from './model';
import { useBench } from './store';

/** Most solver steps per animation frame; beyond this the bench slows down instead of stalling. */
export const MAX_STEPS_PER_FRAME = 600;
/** CPU budget per frame for solving, in ms (a step on a small board is ~15 µs). */
const FRAME_BUDGET_MS = 5;
const PUBLISH_EVERY = 0.05;

export interface LiveSnapshot {
  result: SolveResult | null;
  /** Mean current through each part over the last publish window (what an LED's brightness follows). */
  avgCurrents: Record<string, number>;
  /** Largest current each part saw in the window (what burns an LED out). */
  peakCurrents: Record<string, number>;
  /** Simulated seconds per real second. */
  rate: number;
  time: number;
}

export const useLive = create<LiveSnapshot>(() => ({ result: null, avgCurrents: {}, peakCurrents: {}, rate: 1, time: 0 }));

export class LiveBench {
  sim: Simulator = new Simulator({ components: [] });
  scope: ScopeAcquisition;
  private supplyRef: unknown = null;
  private partsRef: unknown = null;
  private nodeOf: (h: HoleId) => string = () => '0';
  private tdiv: number;
  private debt = 0;
  private sinceUpdate = 0;
  private sum: Record<string, number> = {};
  private peak: Record<string, number> = {};
  private steps = 0;
  private probeKey: [HoleId | null, HoleId | null] = [null, null];

  constructor(tdiv: number) {
    this.tdiv = tdiv;
    const t = useScope.getState().trigger;
    this.scope = new ScopeAcquisition(tdiv, { ...t });
  }

  /** Point the simulator at a (possibly changed) board. Capacitors keep their charge by id. */
  setBoard(board: BoardState) {
    if (board.supply === this.supplyRef && board.parts === this.partsRef) return;
    this.supplyRef = board.supply;
    this.partsRef = board.parts;
    const { circuit, nodeOf } = boardToCircuit(board);
    this.nodeOf = nodeOf;
    this.sim.setCircuit(circuit);
    this.scope.resetRecent();
  }

  get circuit(): Circuit { return this.sim.circuit; }

  setTimebase(tdiv: number) {
    if (tdiv === this.tdiv) return;
    this.tdiv = tdiv;
    this.scope.tdiv = tdiv;
    this.scope.reset();
    this.debt = 0;
  }

  /** Voltage at a hole in a result (undefined if nothing is plugged into that strip). */
  voltageAt(r: SolveResult | null, h: HoleId | null): number | undefined {
    if (!r?.ok || !h) return undefined;
    return r.nodeVoltages[this.nodeOf(h)];
  }

  /**
   * Advance by `realDt` seconds of wall-clock time. Returns the number of solver steps taken.
   * `probes` are the scope tips; unconnected tips read 0 V.
   */
  advance(realDt: number, probes: { ch1: HoleId | null; ch2: HoleId | null }): number {
    if (probes.ch1 !== this.probeKey[0] || probes.ch2 !== this.probeKey[1]) {
      this.probeKey = [probes.ch1, probes.ch2];
      this.scope.resetRecent();
    }
    const dt = simStep(this.tdiv);
    this.debt += Math.min(realDt, 0.1) * simRate(this.tdiv);
    let n = Math.floor(this.debt / dt);
    if (n > MAX_STEPS_PER_FRAME) { n = MAX_STEPS_PER_FRAME; this.debt = 0; } else this.debt -= n * dt;

    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      if ((i & 15) === 15 && performance.now() - t0 > FRAME_BUDGET_MS) { this.debt = 0; n = i; break; }
      const r = this.sim.step(dt);
      if (!r.ok) break;
      for (const [id, a] of Object.entries(r.currents)) {
        this.sum[id] = (this.sum[id] ?? 0) + a;
        this.peak[id] = Math.max(this.peak[id] ?? 0, a);
      }
      this.steps++;
      const s: Sample = { t: r.time, v1: this.voltageAt(r, probes.ch1) ?? 0, v2: this.voltageAt(r, probes.ch2) ?? 0 };
      this.scope.push(s);
    }
    this.sinceUpdate += realDt;
    return n;
  }

  /** Snapshot for React views, at most every PUBLISH_EVERY seconds. */
  publish(force = false): LiveSnapshot | null {
    if (!force && this.sinceUpdate < PUBLISH_EVERY) return null;
    this.sinceUpdate = 0;
    const k = Math.max(1, this.steps);
    const avg = Object.fromEntries(Object.entries(this.sum).map(([id, a]) => [id, a / k]));
    const snap: LiveSnapshot = {
      result: this.sim.last,
      avgCurrents: this.steps ? avg : this.sim.last?.currents ?? {},
      peakCurrents: this.steps ? { ...this.peak } : this.sim.last?.currents ?? {},
      rate: simRate(this.tdiv),
      time: this.sim.time,
    };
    this.sum = {};
    this.peak = {};
    this.steps = 0;
    return snap;
  }
}

/** The one live bench, shared by the 3D scene, the readouts and the scope screen. */
export const bench = new LiveBench(useScope.getState().tdiv);

/** Drive the live bench from requestAnimationFrame. Returns a stop function. */
export function startLiveBench(): () => void {
  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const realDt = (now - last) / 1000;
    last = now;
    const b = useBench.getState();
    const sc = useScope.getState();
    bench.setBoard({ supply: b.supply, parts: b.parts });
    bench.setTimebase(sc.tdiv);
    bench.scope.trigger = { ...sc.trigger };
    if (sc.running) bench.scope.run(); else bench.scope.stop();
    bench.advance(realDt, b.scopeProbes);
    const snap = bench.publish();
    if (snap) useLive.setState(snap);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
