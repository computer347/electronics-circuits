/**
 * Exam-style drill generators for World 0. Each generator builds a schematic with
 * random standard values, asks one question, and provides a worked solution.
 *
 * Answers to circuit questions come from the SOLVER (not the formula), and the tests
 * check that the solver and the hand formula in the worked solution always agree.
 */

import { formatSI } from '../lib/units';
import { LED_VF, solve, type LedColor, type SolveResult } from '../sim';
import { toCircuit, type Pt, type Schematic, type SchPart } from '../schematic/model';
import type { Highlight } from '../schematic/SchematicView';
import { e12, mulberry32, pick, type Rng } from './rng';

export type AnswerUnit = 'V' | 'A' | 'Ω' | 's';

export interface Drill {
  generator: string;
  seed: number;
  topic: string;
  title: string;
  prompt: string;
  schematic: Schematic;
  highlight?: Highlight;
  answer: { value: number; unit: AnswerUnit; tolerancePct: number };
  /** Worked solution, one step per line. */
  solution: string[];
  /** The hand-formula answer (tests compare it with `answer.value`). */
  expected: number;
}

export interface Generator {
  id: string;
  topic: string;
  title: string;
  make: (rng: Rng, seed: number) => Drill;
}

const SUPPLIES = [3.3, 5, 6, 9, 12] as const;
const f = formatSI;

// ---- helpers ------------------------------------------------------------------

let wireCount = 0;
const W = (p1: Pt, p2: Pt): SchPart => ({ kind: 'wire', id: `W${++wireCount}`, p1, p2 });
const R = (id: string, p1: Pt, p2: Pt, ohms: number): SchPart => ({ kind: 'resistor', id, p1, p2, ohms });
const V = (id: string, p1: Pt, p2: Pt, volts: number): SchPart => ({ kind: 'vsource', id, p1, p2, volts });

function solveSchematic(s: Schematic) {
  const conv = toCircuit(s);
  const r = solve(conv.circuit);
  if (!r.ok) throw new Error(`Drill circuit failed to solve: ${r.faults.map((x) => x.message).join('; ')}`);
  const volt = (p: Pt) => r.nodeVoltages[conv.nodeAt(p)!] ?? 0;
  return { r, volt };
}
const currentMag = (r: SolveResult, id: string) => Math.abs(r.currents[id] ?? 0);
const par = (...rs: number[]) => 1 / rs.reduce((s, x) => s + 1 / x, 0);

function base(gen: Omit<Generator, 'make'>, seed: number) {
  wireCount = 0;
  return { generator: gen.id, seed, topic: gen.topic, title: gen.title };
}

// ---- generators ---------------------------------------------------------------

const ohm: Generator = {
  id: 'ohm', topic: "Ohm's law", title: 'Current through a resistor',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, SUPPLIES);
    const r1 = e12(rng, 100, 10_000);
    const schematic: Schematic = {
      parts: [V('V1', [0, 0], [0, 3], v), W([0, 0], [3, 0]), R('R1', [3, 0], [3, 3], r1), W([3, 3], [0, 3])],
      grounds: [[0, 3]],
    };
    const { r } = solveSchematic(schematic);
    const expected = v / r1;
    return {
      ...b, schematic, expected,
      prompt: 'What current flows through R1?',
      highlight: { parts: ['R1'] },
      answer: { value: currentMag(r, 'R1'), unit: 'A', tolerancePct: 1 },
      solution: ["Ohm's law: I = V / R", `I = ${f(v, 'V')} / ${f(r1, 'Ω')} = ${f(expected, 'A')}`],
    };
  },
};

const seriesVoltage: Generator = {
  id: 'series-voltage', topic: 'Series & parallel', title: 'Voltage across a series resistor',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, SUPPLIES);
    const [r1, r2, r3] = [e12(rng, 100, 4700), e12(rng, 100, 4700), e12(rng, 100, 4700)];
    const schematic: Schematic = {
      parts: [
        V('V1', [0, 0], [0, 4], v), R('R1', [0, 0], [4, 0], r1),
        R('R2', [4, 0], [4, 4], r2), R('R3', [4, 4], [0, 4], r3),
      ],
      grounds: [[0, 4]],
    };
    const { volt } = solveSchematic(schematic);
    const total = r1 + r2 + r3;
    const i = v / total;
    const expected = i * r2;
    return {
      ...b, schematic, expected,
      prompt: 'What is the voltage across R2?',
      highlight: { parts: ['R2'] },
      answer: { value: Math.abs(volt([4, 0]) - volt([4, 4])), unit: 'V', tolerancePct: 1 },
      solution: [
        `Series resistances add: R_total = ${f(r1, 'Ω')} + ${f(r2, 'Ω')} + ${f(r3, 'Ω')} = ${f(total, 'Ω')}`,
        `The same current flows through all of them: I = ${f(v, 'V')} / ${f(total, 'Ω')} = ${f(i, 'A')}`,
        `V_R2 = I × R2 = ${f(i, 'A')} × ${f(r2, 'Ω')} = ${f(expected, 'V')}`,
      ],
    };
  },
};

const divider: Generator = {
  id: 'divider', topic: 'Dividers', title: 'Voltage divider output',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, SUPPLIES);
    const r1 = e12(rng, 1000, 47_000);
    const r2 = e12(rng, 1000, 47_000);
    const schematic: Schematic = {
      parts: [
        V('V1', [0, 0], [0, 4], v), W([0, 0], [3, 0]),
        R('R1', [3, 0], [3, 2], r1), R('R2', [3, 2], [3, 4], r2),
        W([3, 4], [0, 4]), W([3, 2], [5, 2]),
      ],
      grounds: [[0, 4]],
      labels: [{ at: [5, 2], name: 'Vout' }],
    };
    const { volt } = solveSchematic(schematic);
    const expected = (v * r2) / (r1 + r2);
    return {
      ...b, schematic, expected,
      prompt: 'What is Vout (measured to ground)?',
      highlight: { nodes: [{ at: [5, 2], label: 'Vout = ?' }] },
      answer: { value: volt([5, 2]), unit: 'V', tolerancePct: 1 },
      solution: [
        'Divider rule: Vout = V × R2 / (R1 + R2)',
        `Vout = ${f(v, 'V')} × ${f(r2, 'Ω')} / (${f(r1, 'Ω')} + ${f(r2, 'Ω')}) = ${f(expected, 'V')}`,
      ],
    };
  },
};

const parallelTotal: Generator = {
  id: 'parallel-total', topic: 'Series & parallel', title: 'Total current into parallel resistors',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, SUPPLIES);
    const n = pick(rng, [2, 3]);
    const rs = Array.from({ length: n }, () => e12(rng, 100, 10_000));
    const parts: SchPart[] = [V('V1', [0, 0], [0, 3], v)];
    let prev = 0;
    rs.forEach((ohms, k) => {
      const x = 2 + k * 2;
      parts.push(W([prev, 0], [x, 0]), R(`R${k + 1}`, [x, 0], [x, 3], ohms), W([x, 3], [prev, 3]));
      prev = x;
    });
    const schematic: Schematic = { parts, grounds: [[0, 3]] };
    const { r } = solveSchematic(schematic);
    const req = par(...rs);
    const expected = v / req;
    const names = rs.map((_, k) => `R${k + 1}`);
    return {
      ...b, schematic, expected,
      prompt: 'What total current does the battery supply?',
      highlight: { parts: ['V1'] },
      answer: { value: currentMag(r, 'V1'), unit: 'A', tolerancePct: 1 },
      solution: [
        `Parallel: 1 / R_eq = ${names.map((x) => `1/${x}`).join(' + ')}`,
        `R_eq = ${f(req, 'Ω')}`,
        `I = V / R_eq = ${f(v, 'V')} / ${f(req, 'Ω')} = ${f(expected, 'A')}`,
        `(Check: add the branch currents, ${rs.map((x) => f(v / x, 'A')).join(' + ')})`,
      ],
    };
  },
};

const seriesParallel: Generator = {
  id: 'series-parallel', topic: 'Series & parallel', title: 'Current in a parallel branch',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, SUPPLIES);
    const [r1, r2, r3] = [e12(rng, 100, 4700), e12(rng, 100, 10_000), e12(rng, 100, 10_000)];
    const schematic: Schematic = {
      parts: [
        V('V1', [0, 0], [0, 3], v), R('R1', [0, 0], [3, 0], r1),
        R('R2', [3, 0], [3, 3], r2), W([3, 0], [6, 0]), R('R3', [6, 0], [6, 3], r3),
        W([6, 3], [3, 3]), W([3, 3], [0, 3]),
      ],
      grounds: [[0, 3]],
    };
    const { r } = solveSchematic(schematic);
    const r23 = par(r2, r3);
    const total = r1 + r23;
    const i = v / total;
    const v23 = i * r23;
    const expected = v23 / r3;
    return {
      ...b, schematic, expected,
      prompt: 'What current flows through R3?',
      highlight: { parts: ['R3'] },
      answer: { value: currentMag(r, 'R3'), unit: 'A', tolerancePct: 1 },
      solution: [
        `R2 ∥ R3 = ${f(r2, 'Ω')} × ${f(r3, 'Ω')} / (${f(r2, 'Ω')} + ${f(r3, 'Ω')}) = ${f(r23, 'Ω')}`,
        `R_total = R1 + (R2 ∥ R3) = ${f(total, 'Ω')}`,
        `I = ${f(v, 'V')} / ${f(total, 'Ω')} = ${f(i, 'A')}`,
        `Voltage across the parallel pair: ${f(i, 'A')} × ${f(r23, 'Ω')} = ${f(v23, 'V')}`,
        `I_R3 = ${f(v23, 'V')} / ${f(r3, 'Ω')} = ${f(expected, 'A')}`,
      ],
    };
  },
};

const ledResistor: Generator = {
  id: 'led-resistor', topic: 'LEDs', title: 'Size the LED resistor',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, [5, 9, 12] as const);
    const color = pick(rng, ['red', 'yellow', 'green', 'blue'] as LedColor[]);
    const vf = LED_VF[color];
    const target = pick(rng, [0.01, 0.015, 0.02]);
    const expected = (v - vf) / target;
    const schematic: Schematic = {
      parts: [
        V('V1', [0, 0], [0, 3], v),
        { ...R('R1', [0, 0], [4, 0], expected), label: 'R = ?' },
        { kind: 'diode', id: 'LED1', p1: [4, 0], p2: [4, 3], vf, led: { color } },
        W([4, 3], [0, 3]),
      ],
      grounds: [[0, 3]],
    };
    return {
      ...b, schematic, expected,
      prompt: `The ${color} LED has a forward voltage of ${vf} V. What resistance gives an LED current of ${f(target, 'A')}?`,
      highlight: { parts: ['R1'] },
      answer: { value: expected, unit: 'Ω', tolerancePct: 1 },
      solution: [
        `The resistor drops whatever the LED doesn't: V_R = ${f(v, 'V')} − ${vf} V = ${f(v - vf, 'V')}`,
        `R = V_R / I = ${f(v - vf, 'V')} / ${f(target, 'A')} = ${f(expected, 'Ω')}`,
        `In practice you'd pick the next standard value up, so the LED runs slightly below ${f(target, 'A')}.`,
      ],
    };
  },
};

const rcCharge: Generator = {
  id: 'rc-charge', topic: 'RC circuits', title: 'Capacitor voltage while charging',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, SUPPLIES);
    const r1 = e12(rng, 1000, 100_000);
    const c1 = pick(rng, [1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6, 47e-6, 100e-6]);
    const k = pick(rng, [0.5, 1, 2, 3]);
    const tau = r1 * c1;
    const t = k * tau;
    const expected = v * (1 - Math.exp(-k));
    const schematic: Schematic = {
      parts: [
        V('V1', [0, 0], [0, 3], v), { kind: 'switch', id: 'S1', p1: [0, 0], p2: [2, 0], closed: true },
        R('R1', [2, 0], [5, 0], r1), { kind: 'capacitor', id: 'C1', p1: [5, 0], p2: [5, 3], farads: c1 },
        W([5, 3], [0, 3]),
      ],
      grounds: [[0, 3]],
    };
    return {
      ...b, schematic, expected,
      prompt: `C1 starts uncharged. S1 closes at t = 0. What is the voltage across C1 at t = ${f(t, 's')}?`,
      highlight: { parts: ['C1'] },
      answer: { value: expected, unit: 'V', tolerancePct: 1 },
      solution: [
        `Time constant: τ = R × C = ${f(r1, 'Ω')} × ${f(c1, 'F')} = ${f(tau, 's')}`,
        `t / τ = ${k}`,
        `Charging: V_C = V × (1 − e^(−t/τ)) = ${f(v, 'V')} × (1 − e^(−${k})) = ${f(expected, 'V')}`,
      ],
    };
  },
};

const bridge: Generator = {
  id: 'bridge', topic: 'Bridges', title: 'Wheatstone bridge voltage',
  make(rng, seed) {
    const b = base(this, seed);
    const v = pick(rng, SUPPLIES);
    const [r1, r2, r3, r4] = [e12(rng, 1000, 10_000), e12(rng, 1000, 10_000), e12(rng, 1000, 10_000), e12(rng, 1000, 10_000)];
    const schematic: Schematic = {
      parts: [
        V('V1', [0, 0], [0, 4], v), W([0, 0], [2, 0]), W([2, 0], [6, 0]),
        R('R1', [2, 0], [2, 2], r1), R('R3', [2, 2], [2, 4], r3),
        R('R2', [6, 0], [6, 2], r2), R('R4', [6, 2], [6, 4], r4),
        W([6, 4], [2, 4]), W([2, 4], [0, 4]),
      ],
      grounds: [[0, 4]],
      labels: [{ at: [2, 2], name: 'A' }, { at: [6, 2], name: 'B' }],
    };
    const { volt } = solveSchematic(schematic);
    const va = (v * r3) / (r1 + r3);
    const vb = (v * r4) / (r2 + r4);
    const expected = va - vb;
    return {
      ...b, schematic, expected,
      prompt: 'What is V_AB = V_A − V_B? Include the sign.',
      highlight: { nodes: [{ at: [2, 2], label: 'A' }, { at: [6, 2], label: 'B' }] },
      answer: { value: volt([2, 2]) - volt([6, 2]), unit: 'V', tolerancePct: 1 },
      solution: [
        'Each side is a divider (nothing connects A to B, so no current flows between them).',
        `V_A = ${f(v, 'V')} × R3 / (R1 + R3) = ${f(va, 'V')}`,
        `V_B = ${f(v, 'V')} × R4 / (R2 + R4) = ${f(vb, 'V')}`,
        `V_AB = ${f(va, 'V')} − ${f(vb, 'V')} = ${f(expected, 'V')}`,
      ],
    };
  },
};

const currentSource: Generator = {
  id: 'current-source', topic: 'Sources', title: 'Current source into parallel resistors',
  make(rng, seed) {
    const b = base(this, seed);
    const amps = pick(rng, [0.5e-3, 1e-3, 2e-3, 5e-3, 10e-3]);
    const r1 = e12(rng, 100, 10_000);
    const r2 = e12(rng, 100, 10_000);
    const schematic: Schematic = {
      parts: [
        // current flows up through the source, from p1 (bottom) to p2 (top)
        { kind: 'isource', id: 'I1', p1: [0, 3], p2: [0, 0], amps },
        W([0, 0], [3, 0]), R('R1', [3, 0], [3, 3], r1), W([3, 0], [6, 0]), R('R2', [6, 0], [6, 3], r2),
        W([6, 3], [3, 3]), W([3, 3], [0, 3]),
      ],
      grounds: [[0, 3]],
      labels: [{ at: [3, 0], name: 'top' }],
    };
    const { volt } = solveSchematic(schematic);
    const req = par(r1, r2);
    const expected = amps * req;
    return {
      ...b, schematic, expected,
      prompt: 'What is the voltage at node "top" (measured to ground)?',
      highlight: { nodes: [{ at: [3, 0], label: 'top = ?' }] },
      answer: { value: volt([3, 0]), unit: 'V', tolerancePct: 1 },
      solution: [
        'All of the source current has to flow through the parallel pair.',
        `R1 ∥ R2 = ${f(req, 'Ω')}`,
        `V = I × R = ${f(amps, 'A')} × ${f(req, 'Ω')} = ${f(expected, 'V')}`,
      ],
    };
  },
};

export const GENERATORS: Generator[] = [
  ohm, seriesVoltage, divider, parallelTotal, seriesParallel, ledResistor, rcCharge, bridge, currentSource,
];

export const TOPICS = [...new Set(GENERATORS.map((g) => g.topic))];


export function makeDrill(generatorId: string, seed: number): Drill {
  const gen = GENERATORS.find((g) => g.id === generatorId);
  if (!gen) throw new Error(`Unknown drill generator ${generatorId}`);
  return gen.make(mulberry32(seed), seed);
}

export function randomDrill(topic?: string, seed = Math.floor(Math.random() * 2 ** 31)): Drill {
  const pool = topic ? GENERATORS.filter((g) => g.topic === topic) : GENERATORS;
  const gen = pool[seed % pool.length]!;
  return makeDrill(gen.id, seed);
}
