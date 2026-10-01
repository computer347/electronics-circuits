/**
 * The circuits behind the Learn labs. Each lab builds a schematic, solves it with the same
 * MNA solver the bench uses, and returns the drawing plus the readings to show, so a class
 * can never teach a number the game itself would disagree with.
 */
import { LED_VF, parseNetlist, Simulator, solve } from '../sim';
import type { Gate } from './types';
import { toCircuit, type Pt, type Schematic, type SchPart } from '../schematic/model';

/** The parts bin used in World 0 (E12-ish values the levels offer). */
export const BIN_OHMS = [100, 150, 220, 270, 330, 390, 470, 560, 680, 820, 1000, 1500, 2200, 3300, 4700, 6800, 10000, 15000, 22000, 33000, 47000, 68000, 100000];

export const RED_VF = LED_VF.red;
export const LED_BURN_AMPS = 0.03;

let wires = 0;
const W = (p1: Pt, p2: Pt): SchPart => ({ kind: 'wire', id: `W${++wires}`, p1, p2 });
const V = (id: string, p1: Pt, p2: Pt, volts: number): SchPart => ({ kind: 'vsource', id, p1, p2, volts });
const R = (id: string, p1: Pt, p2: Pt, ohms: number): SchPart => ({ kind: 'resistor', id, p1, p2, ohms });
const LED = (id: string, p1: Pt, p2: Pt): SchPart =>
  ({ kind: 'diode', id, p1, p2, vf: RED_VF, led: { color: 'red' }, maxAmps: LED_BURN_AMPS });

function run(s: Schematic) {
  const conv = toCircuit(s);
  const r = solve(conv.circuit);
  if (!r.ok) throw new Error(`Lab circuit failed to solve: ${r.faults.map((f) => f.message).join('; ')}`);
  const volt = (p: Pt) => r.nodeVoltages[conv.nodeAt(p)!] ?? 0;
  const amps = (id: string) => Math.abs(r.currents[id] ?? 0);
  return { r, volt, amps };
}

// ── Class 1: one resistor ──────────────────────────────────────────────────────────

export interface OhmReading { schematic: Schematic; amps: number; watts: number }

export function ohmLab(volts: number, ohms: number): OhmReading {
  wires = 0;
  const schematic: Schematic = {
    parts: [V('V1', [0, 0], [0, 3], volts), W([0, 0], [3, 0]), R('R1', [3, 0], [3, 3], ohms), W([3, 3], [0, 3])],
    grounds: [[0, 3]],
  };
  const { amps } = run(schematic);
  const i = amps('R1');
  return { schematic, amps: i, watts: i * i * ohms };
}

// ── Classes 1 and 2: an LED with its resistor, either way round ────────────────────

export type LedState = 'off' | 'dim' | 'lit' | 'bright' | 'burnt';

export interface LedReading {
  schematic: Schematic;
  amps: number;
  /** Voltage across the resistor and across the LED (anode − cathode, as a meter reads it). */
  vResistor: number;
  vLed: number;
  /** Voltages a meter with black on ground reads at each LED leg. */
  vAnodeSide: number;
  vGroundSide: number;
  state: LedState;
}

export function ledState(amps: number): LedState {
  if (amps > LED_BURN_AMPS) return 'burnt';
  if (amps > 0.025) return 'bright';
  if (amps >= 0.01) return 'lit';
  if (amps > 0.0005) return 'dim';
  return 'off';
}

/** Supply → R1 → LED1 → ground. `reversed` puts the LED in backwards (level 0–2). */
export function ledLab(volts: number, ohms: number, reversed = false): LedReading {
  wires = 0;
  const top: Pt = [4, 0], bottom: Pt = [4, 3];
  const led = reversed ? LED('LED1', bottom, top) : LED('LED1', top, bottom);
  const schematic: Schematic = {
    parts: [V('V1', [0, 0], [0, 3], volts), R('R1', [0, 0], top, ohms), led, W(bottom, [0, 3])],
    grounds: [[0, 3]],
  };
  const { volt, amps } = run(schematic);
  const i = amps('LED1');
  const vTop = volt(top), vBottom = volt(bottom);
  return {
    schematic, amps: i,
    vResistor: volts - vTop,
    vLed: reversed ? vBottom - vTop : vTop - vBottom,
    vAnodeSide: vTop, vGroundSide: vBottom,
    state: ledState(i),
  };
}

/** The resistor that sets `amps` through one red LED: R = (V − Vf) / I. */
export const ledResistor = (volts: number, amps: number, leds = 1) => (volts - leds * RED_VF) / amps;

// ── Class 3: two LEDs, series or parallel ─────────────────────────────────────────

export interface PairReading { schematic: Schematic; led1: number; led2: number; supply: number; vResistor: number }

/**
 * Series: supply → R1 → LED1 → LED2 → ground. Parallel: each LED gets its own resistor
 * (sharing one resistor between parallel LEDs is a classic mistake the class mentions).
 */
export function pairLab(volts: number, ohms: number, mode: 'series' | 'parallel'): PairReading {
  wires = 0;
  let schematic: Schematic;
  if (mode === 'series') {
    schematic = {
      parts: [
        V('V1', [0, 0], [0, 4], volts), R('R1', [0, 0], [4, 0], ohms),
        LED('LED1', [4, 0], [4, 2]), LED('LED2', [4, 2], [4, 4]), W([4, 4], [0, 4]),
      ],
      grounds: [[0, 4]],
    };
  } else {
    schematic = {
      parts: [
        V('V1', [0, 0], [0, 4], volts), W([0, 0], [3, 0]), W([3, 0], [6, 0]),
        R('R1', [3, 0], [3, 2], ohms), LED('LED1', [3, 2], [3, 4]),
        R('R2', [6, 0], [6, 2], ohms), LED('LED2', [6, 2], [6, 4]),
        W([6, 4], [3, 4]), W([3, 4], [0, 4]),
      ],
      grounds: [[0, 4]],
    };
  }
  const { r, amps } = run(schematic);
  return {
    schematic, led1: amps('LED1'), led2: amps('LED2'), supply: amps('V1'),
    vResistor: Math.abs((r.currents.R1 ?? 0) * ohms),
  };
}

// ── Class 4: the voltage divider ──────────────────────────────────────────────────

export interface DividerReading { schematic: Schematic; vOut: number; amps: number; ratio: number }

export function dividerLab(volts: number, rTop: number, rBottom: number): DividerReading {
  wires = 0;
  const schematic: Schematic = {
    parts: [
      V('V1', [0, 0], [0, 4], volts), W([0, 0], [3, 0]),
      R('R1', [3, 0], [3, 2], rTop), R('R2', [3, 2], [3, 4], rBottom), W([3, 4], [0, 4]),
    ],
    grounds: [[0, 4]],
    labels: [{ at: [3, 2], name: 'TP1' }],
  };
  const { volt, amps } = run(schematic);
  return { schematic, vOut: volt([3, 2]), amps: amps('R1'), ratio: rBottom / (rTop + rBottom) };
}

/** Formula version, for the worked examples: Vout = V × Rb / (Rt + Rb). */
export const dividerOut = (volts: number, rTop: number, rBottom: number) => volts * rBottom / (rTop + rBottom);

// ── Class 5: charging a capacitor ─────────────────────────────────────────────────

export interface RcReading {
  schematic: Schematic;
  /** τ as the circuit really behaves: R × C, or (R ∥ bleed) × C with a bleed resistor. */
  tau: number;
  /** Where the capacitor ends up: the supply, or less when a bleed resistor divides it. */
  vFinal: number;
  /** Time to reach 63 % of vFinal, measured from the transient run. */
  t63: number;
  /** [t, V] samples over `span` seconds. */
  curve: [number, number][];
  span: number;
}

/**
 * Supply → R1 → C1 (+ an optional bleed resistor across C1, as in level 0–5), C1 empty
 * at t = 0. Runs the real transient simulation and measures when it crosses 63 %.
 */
export function rcLab(volts: number, ohms: number, farads: number, bleedOhms?: number): RcReading {
  wires = 0;
  const parts: SchPart[] = [
    V('V1', [0, 0], [0, 3], volts), R('R1', [0, 0], [4, 0], ohms),
    { kind: 'capacitor', id: 'C1', p1: [4, 0], p2: [4, 3], farads }, W([4, 3], [0, 3]),
  ];
  if (bleedOhms) parts.push(W([4, 0], [6, 0]), R('R2', [6, 0], [6, 3], bleedOhms), W([6, 3], [4, 3]));
  const schematic: Schematic = { parts, grounds: [[0, 3]] };
  const rEff = bleedOhms ? (ohms * bleedOhms) / (ohms + bleedOhms) : ohms;
  const tau = rEff * farads;
  const vFinal = bleedOhms ? volts * bleedOhms / (ohms + bleedOhms) : volts;
  const span = 5 * tau;
  const conv = toCircuit(schematic);
  const node = conv.nodeAt([4, 0])!;
  const sim = new Simulator(conv.circuit);
  const steps = 400, dt = span / steps;
  const curve: [number, number][] = [[0, 0]];
  let t63 = NaN;
  let prev: [number, number] = [0, 0];
  for (let k = 1; k <= steps; k++) {
    const r = sim.step(dt);
    const v = r.nodeVoltages[node] ?? 0;
    if (Number.isNaN(t63) && v >= 0.632 * vFinal) {
      // Interpolate between the two samples that straddle 63 %.
      const f = (0.632 * vFinal - prev[1]) / (v - prev[1]);
      t63 = prev[0] + f * dt;
    }
    prev = [r.time, v];
    if (k % 4 === 0) curve.push(prev);
  }
  return { schematic, tau, vFinal, t63, curve, span };
}

// ── World 1: gates built from switches and transistors ─────────────────────────────

/** How many inputs each gate has. */
export const GATE_INPUTS: Record<Gate, number> = { AND: 2, OR: 2, NOT: 1, NAND: 2, XOR: 2 };

/**
 * The gate as the circuit the level builds, solved: AND is two switches in series, OR two in
 * parallel, NOT a transistor with a 1 kΩ pull-up, NAND two transistors in series under it,
 * XOR two changeover switches with their traveller wires crossed (a stairwell light).
 * The lamp is a red LED; it counts as lit above 1 mA.
 */
export function logicLab(gate: Gate, inputs: boolean[]): { lit: boolean; amps: number } {
  const sw = (i: number) => (inputs[i] ? 'closed' : 'open');
  const net = {
    AND: ['V1 vcc 0 9', `SA vcc m ${sw(0)}`, `SB m a ${sw(1)}`, 'R1 a b 470', 'LED1 b 0 red'],
    OR: ['V1 vcc 0 9', `SA vcc a ${sw(0)}`, `SB vcc a ${sw(1)}`, 'R1 a b 470', 'LED1 b 0 red'],
    NOT: ['V1 vcc 0 9', `SA vcc s ${sw(0)}`, 'RB s b 10000', 'Q1 o b 0 beta=200', 'RP vcc o 1000', 'LED1 o 0 red'],
    NAND: ['V1 vcc 0 9', `SA vcc s1 ${sw(0)}`, 'R1 s1 b1 10000', `SB vcc s2 ${sw(1)}`, 'R2 s2 b2 10000', 'Q1 o b1 m beta=200', 'Q2 m b2 0 beta=200', 'RP vcc o 1000', 'LED1 o 0 red'],
    // Changeover A sides closed when an input is 0, B sides when 1; travellers p and q crossed.
    XOR: ['V1 vcc 0 9', `SAa vcc p ${inputs[0] ? 'open' : 'closed'}`, `SAb vcc q ${inputs[0] ? 'closed' : 'open'}`,
      `SBa q c ${inputs[1] ? 'open' : 'closed'}`, `SBb p c ${inputs[1] ? 'closed' : 'open'}`, 'R1 c d 470', 'LED1 d 0 red'],
  }[gate].join('\n');
  const r = solve(parseNetlist(net));
  const amps = Math.abs(r.currents.LED1 ?? 0);
  return { lit: amps > 1e-3, amps };
}

/** The gate's truth, as logic: what the circuit is meant to do. */
export const GATE_TRUTH: Record<Gate, (x: boolean[]) => boolean> = {
  AND: (x) => !!x[0] && !!x[1], OR: (x) => !!x[0] || !!x[1], NOT: (x) => !x[0], NAND: (x) => !(x[0] && x[1]), XOR: (x) => !!x[0] !== !!x[1],
};
