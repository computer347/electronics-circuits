/**
 * Breadboard state -> circuit. Every strip is a node (T- is ground), jumper wires are
 * real (tiny-resistance) components so their currents are known, and the bench supply
 * drives the top rails.
 */

import { contributions, LED_VF, solve, type Circuit, type Component, type Contributions, type LedColor, type SolveResult, type Waveform } from '../sim';
import { hole, type HoleId } from './layout';
import { CHIPS, DEFAULT_CHIP, GND_PIN, VCC_PIN } from './chips';

export type BoardPartKind = 'resistor' | 'led' | 'wire' | 'button' | 'battery' | 'capacitor' | 'generator'
  | 'diode' | 'pot' | 'npn' | 'nmos' | 'regulator' | 'toggle' | 'spdt' | 'dip';

/** Parts with three legs in a row: h1, h2, h3 (the datasheet's pin order). */
export const THREE_LEGGED: readonly BoardPartKind[] = ['pot', 'npn', 'nmos', 'regulator', 'spdt'];

export interface BoardPart {
  id: string;
  kind: BoardPartKind;
  /** First leg (anode / long leg for an LED). */
  h1: HoleId;
  h2: HoleId;
  ohms?: number;
  /** Batteries: terminal voltage; h1 is the + terminal. */
  volts?: number;
  color?: LedColor;
  /** Capacitors: capacitance. 1 µF and up is an electrolytic, and h1 is its + leg. */
  farads?: number;
  /** Function generators: the output waveform; h1 is the signal lead, h2 the COM (ground) clip. */
  wave?: Waveform;
  /** Wire colour for display. */
  wireColor?: string;
  /** Push buttons: held down right now. Toggle switches: switched on (it stays where you leave it). */
  pressed?: boolean;
  /** LEDs that have been overloaded stay dead until replaced, like real ones. */
  burnt?: boolean;
  /**
   * Third leg of a three-legged part. Pin orders follow the datasheets: potentiometer
   * 1 / wiper / 3, NPN (BC547) E / B / C, MOSFET (IRLZ44N) G / D / S, regulator IN / GND / OUT,
   * changeover switch A / common / B (slid to B when `pressed`).
   */
  h3?: HoleId;
  /** Potentiometers: wiper position, 0 (at leg 1) to 1 (at leg 3). */
  position?: number;
  /** Regulators: output voltage. Diodes: forward drop. */
  vout?: number;
  vf?: number;
  /** Printed on the body (BC547, IRLZ44N, LM7805, 1N4148, 74HC00). */
  marking?: string;
  /** A chip's holes, pin 1 first (h1 is pin 1, h2 pin 8). See chips.ts. */
  pins?: HoleId[];
}

/** Every hole a part's legs are in. */
export const legsOf = (p: BoardPart): HoleId[] => (p.pins ? p.pins : p.h3 ? [p.h1, p.h2, p.h3] : [p.h1, p.h2]);

/**
 * The two legs the main current flows between, in the direction it's meant to flow: a
 * transistor's collector to emitter, a MOSFET's drain to source, a regulator's input to its
 * output, a potentiometer end to end. For two-legged parts it's just h1 → h2.
 */
export function currentLegs(p: BoardPart): [HoleId, HoleId] {
  if (!p.h3) return [p.h1, p.h2];
  switch (p.kind) {
    case 'npn': return [p.h3, p.h1];
    case 'spdt': return [p.h2, p.pressed ? p.h3 : p.h1];
    case 'nmos': return [p.h2, p.h3];
    default: return [p.h1, p.h3];
  }
}

export interface BoardState {
  supply: { volts: number; on: boolean };
  parts: BoardPart[];
}

export const LED_MAX_AMPS = 0.03;
/** Capacitors this size and up are electrolytics: polarised, with a stripe on the − leg. */
export const ELECTROLYTIC_FROM = 1e-6;
/** An electrolytic held more than this far backwards is flagged. */
export const ELECTROLYTIC_MAX_REVERSE = 0.5;
export const DEFAULT_WAVE: Waveform = { shape: 'square', freq: 1000, vpp: 5, offset: 2.5 };

export const isElectrolytic = (p: BoardPart) => p.kind === 'capacitor' && (p.farads ?? 0) >= ELECTROLYTIC_FROM;
/** Parts that make the board change over time, so it needs the transient simulator. */
export const isDynamicBoard = (b: BoardState) => b.parts.some((p) => p.kind === 'capacitor' || p.kind === 'generator');
export const SUPPLY_ID = 'SUPPLY';
const GROUND_STRIP = 'T-';

class UnionFind {
  private p = new Map<string, string>();
  find(x: string): string {
    const q = this.p.get(x) ?? x;
    if (q === x) return x;
    const r = this.find(q);
    this.p.set(x, r);
    return r;
  }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

/** Netlist node for a strip: its own name, except the top ground rail, which is 0. */
export const stripNode = (strip: string) => (strip === GROUND_STRIP ? '0' : strip);

export interface BoardCircuit {
  circuit: Circuit;
  /** Netlist node for a hole. */
  nodeOf: (h: HoleId) => string;
}

export function boardToCircuit(board: BoardState): BoardCircuit {
  const nodeOf = (h: HoleId) => stripNode(hole(h).strip);
  const components: Component[] = [];
  if (board.supply.on) {
    components.push({ kind: 'vsource', id: SUPPLY_ID, a: stripNode('T+'), b: '0', volts: board.supply.volts });
  }
  for (const p of board.parts) {
    const a = nodeOf(p.h1);
    const b = nodeOf(p.h2);
    switch (p.kind) {
      case 'resistor':
        components.push({ kind: 'resistor', id: p.id, a, b, ohms: p.ohms ?? 1000 });
        break;
      case 'led':
        if (!p.burnt) {
          const color = p.color ?? 'red';
          components.push({ kind: 'diode', id: p.id, a, b, vf: LED_VF[color], led: { color }, maxAmps: LED_MAX_AMPS, maxReverseVolts: 5 });
        }
        break;
      case 'button': case 'toggle':
        components.push({ kind: 'switch', id: p.id, a, b, closed: !!p.pressed });
        break;
      case 'wire':
        components.push({ kind: 'wire', id: p.id, a, b });
        break;
      case 'battery':
        components.push({ kind: 'vsource', id: p.id, a, b, volts: p.volts ?? 9 });
        break;
      case 'capacitor':
        components.push({ kind: 'capacitor', id: p.id, a, b, farads: p.farads ?? 100e-9 });
        break;
      case 'generator': {
        const wave = p.wave ?? DEFAULT_WAVE;
        components.push({ kind: 'vsource', id: p.id, a, b, volts: wave.offset, wave });
        break;
      }
      case 'diode':
        components.push({ kind: 'diode', id: p.id, a, b, vf: p.vf ?? 0.7, maxReverseVolts: p.marking === '1N4148' ? 75 : 1000 });
        break;
      case 'pot': {
        // Two resistors meeting at the wiper (h2); never quite zero at the ends.
        const total = p.ohms ?? 10000;
        const k = Math.min(1, Math.max(0, p.position ?? 0.5));
        const c = p.h3 ? nodeOf(p.h3) : b;
        components.push({ kind: 'resistor', id: `${p.id}`, a, b, ohms: Math.max(1, total * k) });
        components.push({ kind: 'resistor', id: `${p.id}.b`, a: b, b: c, ohms: Math.max(1, total * (1 - k)) });
        break;
      }
      case 'npn':
        // BC547 pin order E B C: h1 emitter, h2 base, h3 collector.
        if (p.h3) {
          components.push({ kind: 'npn', id: p.id, a: nodeOf(p.h3), b: a, base: b, beta: 200, vbe: 0.7, vcesat: 0.2 });
          // The base-collector junction: off in normal use, but it's the second diode a meter
          // finds when you test a transistor's legs.
          components.push({ kind: 'diode', id: `${p.id}.bc`, a: b, b: nodeOf(p.h3), vf: 0.7, maxReverseVolts: 1000 });
        }
        break;
      case 'nmos':
        // IRLZ44N pin order G D S: h1 gate, h2 drain, h3 source.
        if (p.h3) {
          components.push({ kind: 'nmos', id: p.id, a: b, b: nodeOf(p.h3), gate: a, vth: 2, ron: 0.03 });
          // The body diode, source to drain: every power MOSFET has one.
          components.push({ kind: 'diode', id: `${p.id}.body`, a: nodeOf(p.h3), b, vf: 0.7, maxReverseVolts: 1000 });
        }
        break;
      case 'spdt':
        // A changeover (SPDT) switch: common (h2) joins A (h1), or B (h3) once slid across.
        if (p.h3) {
          components.push({ kind: 'switch', id: `${p.id}.A`, a: b, b: a, closed: !p.pressed });
          components.push({ kind: 'switch', id: `${p.id}.B`, a: b, b: nodeOf(p.h3), closed: !!p.pressed });
        }
        break;
      case 'dip': {
        // A logic chip: each gate switches its output pin to the VCC or GND pin (see sim Gate).
        const chip = CHIPS[p.marking ?? DEFAULT_CHIP];
        if (!chip || !p.pins) break;
        const pin = (n: number) => nodeOf(p.pins![n - 1]!);
        chip.gates.forEach((g, k) => components.push({
          kind: 'gate', id: `${p.id}.${k + 1}`, fn: g.fn, a: pin(g.output), b: pin(GND_PIN), vcc: pin(VCC_PIN), inputs: g.inputs.map(pin),
        }));
        break;
      }
      case 'regulator':
        // LM7805 pin order IN GND OUT.
        if (p.h3) components.push({ kind: 'regulator', id: p.id, a, b, out: nodeOf(p.h3), vout: p.vout ?? 5, dropout: 2 });
        break;
    }
  }
  return { circuit: { components }, nodeOf };
}

export interface BoardAnalysis {
  result: SolveResult;
  nodeOf: (h: HoleId) => string;
  /** Voltage of the strip a hole is on, or undefined if nothing is connected there. */
  voltageAt: (h: HoleId) => number | undefined;
  /** LED ids that this solve would burn out. */
  newlyBurnt: string[];
  /** Parts whose legs are joined by strips/wires only (a classic mistake: they do nothing). */
  shortedParts: string[];
  /** Per-source breakdown of every current and voltage (null if the solve failed). */
  contributions: Contributions | null;
  circuit: Circuit;
}

export function analyzeBoard(board: BoardState): BoardAnalysis {
  const { circuit, nodeOf } = boardToCircuit(board);
  const result = solve(circuit);
  const newlyBurnt = result.faults
    .filter((f) => (f.kind === 'overcurrent' || f.kind === 'reverse-overvoltage') && f.component)
    .map((f) => f.component!);
  const joined = new UnionFind();
  for (const p of board.parts) if (p.kind === 'wire') joined.union(hole(p.h1).strip, hole(p.h2).strip);
  const shortedParts = board.parts
    .filter((p) => p.kind !== 'wire' && p.kind !== 'battery' && p.kind !== 'generator' && !p.h3 && !p.pins && joined.find(hole(p.h1).strip) === joined.find(hole(p.h2).strip))
    .map((p) => p.id);
  return {
    result,
    nodeOf,
    voltageAt: (h) => result.nodeVoltages[nodeOf(h)],
    newlyBurnt,
    shortedParts,
    contributions: contributions(circuit, result),
    circuit,
  };
}

/** Electrolytics sitting backwards (− leg more positive than + leg) in a result. */
export function reversedElectrolytics(board: BoardState, nodeOf: (h: HoleId) => string, r: SolveResult): string[] {
  if (!r.ok) return [];
  return board.parts
    .filter(isElectrolytic)
    .filter((p) => (r.nodeVoltages[nodeOf(p.h2)] ?? 0) - (r.nodeVoltages[nodeOf(p.h1)] ?? 0) > ELECTROLYTIC_MAX_REVERSE)
    .map((p) => p.id);
}
