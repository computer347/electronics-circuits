/**
 * Breadboard state -> circuit. Every strip is a node (T- is ground), jumper wires are
 * real (tiny-resistance) components so their currents are known, and the bench supply
 * drives the top rails.
 */

import { contributions, LED_VF, solve, type Circuit, type Component, type Contributions, type LedColor, type SolveResult, type Waveform } from '../sim';
import { hole, type HoleId } from './layout';

export type BoardPartKind = 'resistor' | 'led' | 'wire' | 'button' | 'battery' | 'capacitor' | 'generator';

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
  /** Push buttons: currently pressed. */
  pressed?: boolean;
  /** LEDs that have been overloaded stay dead until replaced, like real ones. */
  burnt?: boolean;
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
      case 'button':
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
    .filter((p) => p.kind !== 'wire' && p.kind !== 'battery' && p.kind !== 'generator' && joined.find(hole(p.h1).strip) === joined.find(hole(p.h2).strip))
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
