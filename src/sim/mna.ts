/**
 * Modified nodal analysis (MNA) solver for ideal components.
 *
 * Unknowns: the voltage of every non-ground node, plus the current through every
 * voltage source. Each component "stamps" its contribution into G x = rhs.
 *
 * Modelling choices (Phase 0, ideal parts):
 *  - Wires and closed switches are tiny resistors (R_WIRE), so every branch has a current
 *    and parallel wires don't make the matrix singular.
 *  - Diodes use an ideal constant-drop model: ON = vf in series with R_ON, OFF = open.
 *    States are found by iterating: solve, flip the worst-violating diode, repeat.
 *  - Capacitors are open in DC and use a backward-Euler companion model in transient.
 *  - A tiny GMIN conductance from every node to ground keeps unconnected nodes solvable;
 *    such nodes are reported as floating instead of breaking the solve.
 */

import { solveLinear, SingularMatrixError } from './linear';
import {
  GROUND_NAMES,
  type Circuit,
  type Component,
  type Diode,
  type DiodeState,
  type Fault,
  type NodeId,
  type SolveResult,
  type VoltageSource,
  type Waveform,
} from './types';

/**
 * Wires are 1 mΩ and every node has 10 pS to ground. The two are sized together: GMIN has to
 * stay well above the rounding error of a wire's conductance (ulp(1e3) ≈ 1e-13), or a section
 * joined only by wires and otherwise floating (two LEDs in series, both off) cancels to a
 * singular matrix. 1 mΩ changes nothing you can measure (20 µV at 20 mA), and 10 pS leaks
 * under 0.1 nA at 9 V.
 */
export const R_WIRE = 1e-3;
export const R_DIODE_ON = 1e-3;
export const GMIN = 1e-11;
const DIODE_TOL = 1e-9;

export interface SolveOptions {
  /** Transient step in seconds. Omit for a DC operating point (capacitors open). */
  dt?: number;
  /** Capacitor voltages (V(a) - V(b)) at the end of the previous step. */
  capVoltages?: Record<string, number>;
  /** Diode states to start from (warm start from the previous step). */
  diodeGuess?: Record<string, DiodeState>;
  time?: number;
  /** Superposition: these sources are switched off (V sources shorted, I sources opened). */
  zeroSources?: ReadonlySet<string>;
  /** Use exactly these diode states (no iteration), e.g. frozen from a full solve. */
  fixedDiodeStates?: Record<string, DiodeState>;
  /** Superposition: drop the diodes' forward-voltage offsets (keep their on-resistance). */
  zeroDiodeOffsets?: boolean;
}

const isGround = (n: NodeId) => GROUND_NAMES.has(n);

/** Value of a waveform at time t (seconds). Square waves start high at t = 0. */
export function waveValue(w: Waveform, t: number): number {
  const ph = (((t * w.freq) % 1) + 1) % 1;
  const half = w.vpp / 2;
  switch (w.shape) {
    case 'square': return w.offset + (ph < (w.duty ?? 0.5) ? half : -half);
    case 'sine': return w.offset + half * Math.sin(2 * Math.PI * ph);
    case 'triangle': return w.offset + half * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph);
  }
}

/** A voltage source's output at time t. */
export const sourceVolts = (c: VoltageSource, t: number) => (c.wave ? waveValue(c.wave, t) : c.volts);

/** Index map for non-ground nodes. */
function indexNodes(components: Component[]): { nodes: NodeId[]; index: Map<NodeId, number> } {
  const nodes: NodeId[] = [];
  const index = new Map<NodeId, number>();
  for (const c of components) {
    for (const n of [c.a, c.b]) {
      if (!isGround(n) && !index.has(n)) {
        index.set(n, nodes.length);
        nodes.push(n);
      }
    }
  }
  return { nodes, index };
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) { p = this.find(p); this.parent.set(x, p); }
    return p;
  }
  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
}

const canon = (n: NodeId) => (isGround(n) ? '0' : n);

/** Structural checks that don't need a solve: direct shorts and floating nodes. */
function structuralFaults(components: Component[]): Fault[] {
  const faults: Fault[] = [];

  // Shorts: a voltage source whose terminals are joined by zero-ohm parts only.
  const zero = new UnionFind();
  for (const c of components) {
    if (c.kind === 'wire' || (c.kind === 'switch' && c.closed)) zero.union(canon(c.a), canon(c.b));
  }
  for (const c of components) {
    if (c.kind === 'vsource' && zero.find(canon(c.a)) === zero.find(canon(c.b))) {
      faults.push({
        kind: 'short-circuit',
        severity: 'error',
        component: c.id,
        message: `${c.id} is shorted: its terminals are connected by wire only.`,
      });
    }
  }

  // Floating: no path to ground through any part (open switches and current sources don't count).
  const conn = new UnionFind();
  for (const c of components) {
    if (c.kind === 'isource' || (c.kind === 'switch' && !c.closed)) continue;
    conn.union(canon(c.a), canon(c.b));
  }
  const groundRoot = conn.find('0');
  const seen = new Set<string>();
  for (const c of components) {
    for (const n of [c.a, c.b]) {
      if (isGround(n) || seen.has(n)) continue;
      seen.add(n);
      if (conn.find(n) !== groundRoot) {
        faults.push({
          kind: 'floating-node',
          severity: 'warning',
          node: n,
          message: `Node "${n}" has no path to ground.`,
        });
      }
    }
  }
  return faults;
}

interface Built {
  A: Float64Array;
  rhs: Float64Array;
  size: number;
  /** Column of the branch-current unknown for each voltage source. */
  vsrcCol: Map<string, number>;
}

function build(
  components: Component[],
  index: Map<NodeId, number>,
  diodeStates: Record<string, DiodeState>,
  opts: SolveOptions,
): Built {
  const nNodes = index.size;
  const vsources = components.filter((c) => c.kind === 'vsource');
  const size = nNodes + vsources.length;
  const A = new Float64Array(size * size);
  const rhs = new Float64Array(size);
  const vsrcCol = new Map<string, number>();
  vsources.forEach((v, i) => vsrcCol.set(v.id, nNodes + i));

  const idx = (n: NodeId) => (isGround(n) ? -1 : index.get(n)!);
  const addA = (r: number, c: number, v: number) => {
    if (r >= 0 && c >= 0) A[r * size + c] = A[r * size + c]! + v;
  };
  const addRhs = (r: number, v: number) => {
    if (r >= 0) rhs[r] = rhs[r]! + v;
  };
  const conductance = (a: number, b: number, g: number) => {
    addA(a, a, g); addA(b, b, g); addA(a, b, -g); addA(b, a, -g);
  };
  /** Current `i` flowing through an element from a to b (leaves a, enters b). */
  const currentAB = (a: number, b: number, i: number) => {
    addRhs(a, -i); addRhs(b, i);
  };

  for (let i = 0; i < nNodes; i++) addA(i, i, GMIN);

  for (const c of components) {
    const a = idx(c.a);
    const b = idx(c.b);
    switch (c.kind) {
      case 'resistor':
        conductance(a, b, 1 / c.ohms);
        break;
      case 'wire':
        conductance(a, b, 1 / R_WIRE);
        break;
      case 'switch':
        if (c.closed) conductance(a, b, 1 / R_WIRE);
        break;
      case 'isource':
        if (!opts.zeroSources?.has(c.id)) currentAB(a, b, c.amps);
        break;
      case 'vsource': {
        const k = vsrcCol.get(c.id)!;
        addA(a, k, 1); addA(b, k, -1);
        addA(k, a, 1); addA(k, b, -1);
        rhs[k] = opts.zeroSources?.has(c.id) ? 0 : sourceVolts(c, opts.time ?? 0);
        break;
      }
      case 'diode':
        if (diodeStates[c.id] === 'on') {
          // i = (Vd - vf) / R_ON  ->  conductance G plus a current source -vf*G from a to b.
          const g = 1 / R_DIODE_ON;
          conductance(a, b, g);
          if (!opts.zeroDiodeOffsets) currentAB(a, b, -c.vf * g);
        }
        break;
      case 'capacitor':
        if (opts.dt !== undefined) {
          // Backward Euler: i = C/dt * (v - v_prev)
          const g = c.farads / opts.dt;
          const vPrev = opts.capVoltages?.[c.id] ?? c.initialVolts ?? 0;
          conductance(a, b, g);
          currentAB(a, b, -g * vPrev);
        }
        break;
    }
  }
  return { A, rhs, size, vsrcCol };
}

function componentCurrent(
  c: Component,
  v: (n: NodeId) => number,
  x: Float64Array,
  built: Built,
  diodeStates: Record<string, DiodeState>,
  opts: SolveOptions,
): number {
  const vd = v(c.a) - v(c.b);
  switch (c.kind) {
    case 'resistor': return vd / c.ohms;
    case 'wire': return vd / R_WIRE;
    case 'switch': return c.closed ? vd / R_WIRE : 0;
    case 'isource': return opts.zeroSources?.has(c.id) ? 0 : c.amps;
    case 'vsource': return x[built.vsrcCol.get(c.id)!]!;
    case 'diode': return diodeStates[c.id] === 'on' ? (vd - (opts.zeroDiodeOffsets ? 0 : c.vf)) / R_DIODE_ON : 0;
    case 'capacitor': {
      if (opts.dt === undefined) return 0;
      const vPrev = opts.capVoltages?.[c.id] ?? c.initialVolts ?? 0;
      return (c.farads / opts.dt) * (vd - vPrev);
    }
  }
}

/** Solves the circuit once: a DC operating point, or one transient step if `opts.dt` is set. */
export function solve(circuit: Circuit, opts: SolveOptions = {}): SolveResult {
  const { components } = circuit;
  const time = opts.time ?? 0;
  const faults = structuralFaults(components);
  const empty = (): SolveResult => ({
    ok: false, time, nodeVoltages: {}, currents: {}, power: {}, diodeStates: {}, faults,
  });
  if (faults.some((f) => f.kind === 'short-circuit')) return empty();

  const { nodes, index } = indexNodes(components);
  const diodes = components.filter((c): c is Diode => c.kind === 'diode');
  const states: Record<string, DiodeState> = {};
  for (const d of diodes) states[d.id] = opts.fixedDiodeStates?.[d.id] ?? opts.diodeGuess?.[d.id] ?? 'off';

  const maxIter = opts.fixedDiodeStates ? 1 : 4 * diodes.length + 10;
  let x: Float64Array | null = null;
  let built: Built | null = null;

  for (let iter = 0; iter < maxIter; iter++) {
    built = build(components, index, states, opts);
    try {
      x = solveLinear(built.A, built.rhs, built.size);
    } catch (e) {
      if (!(e instanceof SingularMatrixError)) throw e;
      faults.push({
        kind: 'source-conflict',
        severity: 'error',
        message: 'Voltage sources are connected in a loop (e.g. two sources in parallel).',
      });
      return empty();
    }

    const sol = x;
    const volt = (n: NodeId) => (isGround(n) ? 0 : sol[index.get(n)!]!);
    // Find the diode whose assumed state is most violated.
    let worst: Diode | null = null;
    let worstBy = DIODE_TOL;
    for (const d of diodes) {
      const vd = volt(d.a) - volt(d.b);
      const violation = states[d.id] === 'on' ? -(vd - d.vf) / R_DIODE_ON : vd - d.vf;
      if (violation > worstBy) { worstBy = violation; worst = d; }
    }
    if (!worst || opts.fixedDiodeStates) break;
    states[worst.id] = states[worst.id] === 'on' ? 'off' : 'on';
    if (iter === maxIter - 1) {
      faults.push({
        kind: 'no-convergence',
        severity: 'error',
        message: 'Diode states did not settle.',
      });
    }
  }

  const sol = x!;
  const volt = (n: NodeId) => (isGround(n) ? 0 : sol[index.get(n)!]!);
  const nodeVoltages: Record<NodeId, number> = { '0': 0 };
  for (const n of nodes) nodeVoltages[n] = volt(n);

  const currents: Record<string, number> = {};
  const power: Record<string, number> = {};
  for (const c of components) {
    const i = componentCurrent(c, volt, sol, built!, states, opts);
    currents[c.id] = i;
    power[c.id] = (volt(c.a) - volt(c.b)) * i;
  }

  for (const d of diodes) {
    const i = currents[d.id]!;
    const vr = volt(d.b) - volt(d.a);
    if (d.maxAmps !== undefined && i > d.maxAmps) {
      faults.push({
        kind: 'overcurrent',
        severity: 'error',
        component: d.id,
        message: `${d.id} carries ${(i * 1000).toFixed(1)} mA, above its ${(d.maxAmps * 1000).toFixed(0)} mA limit.`,
      });
    }
    if (d.maxReverseVolts !== undefined && vr > d.maxReverseVolts) {
      faults.push({
        kind: 'reverse-overvoltage',
        severity: 'error',
        component: d.id,
        message: `${d.id} sees ${vr.toFixed(2)} V in reverse, above its ${d.maxReverseVolts} V rating.`,
      });
    }
  }

  return { ok: true, time, nodeVoltages, currents, power, diodeStates: { ...states }, faults };
}

/** Capacitor voltages V(a) - V(b) from a result, for feeding the next transient step. */
export function capacitorVoltages(circuit: Circuit, r: SolveResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of circuit.components) {
    if (c.kind === 'capacitor') {
      out[c.id] = (r.nodeVoltages[canon(c.a)] ?? 0) - (r.nodeVoltages[canon(c.b)] ?? 0);
    }
  }
  return out;
}

