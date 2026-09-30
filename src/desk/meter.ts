/**
 * The desk multimeter, measured the way a real one works:
 * - V: the voltage of the red probe against the black one.
 * - A: the meter is a wire between the probes (that's what an ammeter is), so the board is
 *   solved with that wire in place and the reading is the current through it. Across a
 *   supply that's a short: the fuse blows.
 * - Ω: the supply and batteries are taken out and a small test current is pushed through the
 *   probes; the reading is volts over amps. No path, a capacitor or a diode reads OL.
 * - Diode (▶|): the same, but with a fixed 1 mA test current and the voltage it takes shown
 *   directly. A silicon junction the right way round reads about 0.6–0.7 V, a red LED about
 *   1.8 V; backwards, or above the meter's 3 V, it reads OL. This is how you find a
 *   transistor's legs and a diode's cathode on the bench.
 */
import type { HoleId } from '../breadboard/layout';
import { boardToCircuit, type BoardPart, type BoardState } from '../breadboard/model';
import { GROUND_NAMES, solve, type Component } from '../sim';

export type MeterMode = 'off' | 'V' | 'Ω' | 'diode' | 'A';
/** Dial order, clockwise. */
export const DIAL: MeterMode[] = ['off', 'V', 'Ω', 'diode', 'A'];
/** What the dial and the buttons print for each mode. */
export const DIAL_LABEL: Record<MeterMode, string> = { off: 'OFF', V: 'V', 'Ω': 'Ω', diode: '▶|', A: 'A' };
/** The diode test's own source runs out of voltage here. */
const DIODE_COMPLIANCE = 3;
export const AMMETER_ID = 'METER';

/** The mode one click round the dial (wraps, so every mode is reachable by clicking on). */
export const nextMode = (m: MeterMode, dir: 1 | -1 = 1): MeterMode => DIAL[(DIAL.indexOf(m) + dir + DIAL.length) % DIAL.length]!;
/** The mA jack's fuse. */
export const FUSE_AMPS = 0.4;
/** The Ω range gives up above this test voltage (a meter's own source is only a couple of volts). */
const OHM_COMPLIANCE = 1.9;

export interface Probes { red: HoleId | null; black: HoleId | null }

export interface Reading {
  /** What the LCD shows. */
  text: string;
  unit: string;
  /** The raw value in V, A or Ω (undefined for OL, FUSE, blank). */
  value?: number;
  /** One line under the meter when something noteworthy happened. */
  note?: string;
}

const both = (p: Probes): p is { red: HoleId; black: HoleId } => !!p.red && !!p.black;

/** The board as the solver should see it with the meter connected: in A mode the meter is a wire. */
export function meteredBoard(board: BoardState, mode: MeterMode, probes: Probes): BoardState {
  if (mode !== 'A' || !both(probes)) return board;
  const meter: BoardPart = { id: AMMETER_ID, kind: 'wire', h1: probes.red, h2: probes.black };
  return { ...board, parts: [...board.parts, meter] };
}

function fixed(v: number, digits = 4) {
  const a = Math.abs(v);
  const decimals = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : 3;
  return v.toFixed(Math.max(0, Math.min(decimals, digits)));
}

/** Pick a unit prefix so the number fits the display: 0.0213 A → "21.30 mA". */
export function scaled(v: number, unit: string): { text: string; unit: string } {
  const a = Math.abs(v);
  if (unit === 'Ω') {
    if (a >= 1e6) return { text: fixed(v / 1e6), unit: 'MΩ' };
    if (a >= 1e3) return { text: fixed(v / 1e3), unit: 'kΩ' };
    return { text: fixed(v), unit: 'Ω' };
  }
  if (unit === 'A') {
    if (a < 1e-9) return { text: '0.000', unit: 'mA' };
    if (a < 1e-3) return { text: fixed(v * 1e6), unit: 'µA' };
    if (a < 1) return { text: fixed(v * 1e3), unit: 'mA' };
    return { text: fixed(v), unit: 'A' };
  }
  return { text: fixed(Math.abs(v) < 5e-4 ? 0 : v), unit };
}

/**
 * The two meter measurements that need the meter's own source, on any circuit: sources are
 * zeroed, then a test current goes in at `a` and out at `b`. Node names as the circuit uses them.
 */
function testCurrent(components: Component[], a: string, b: string, amps: number): number | null {
  // Sources are zeroed; an unpowered regulator passes nothing, so it's left out.
  const zeroed = components.filter((c) => c.kind !== 'regulator').map((c) => (c.kind === 'vsource' ? { ...c, volts: 0, wave: undefined } : c));
  zeroed.push({ kind: 'isource', id: '__TEST', a: b, b: a, amps });
  const r = solve({ components: zeroed });
  if (!r.ok) return null;
  return (r.nodeVoltages[a] ?? 0) - (r.nodeVoltages[b] ?? 0);
}
const sameNode = (a: string, b: string) => a === b || (GROUND_NAMES.has(a) && GROUND_NAMES.has(b));

/** Resistance between two nodes as a meter's Ω range sees it; null for OL. */
export function ohmsAcross(components: Component[], a: string, b: string): number | null {
  if (sameNode(a, b)) return 0;
  // Try a strong test current first, then weaker ones for big resistances.
  for (const amps of [1e-3, 1e-5, 1e-7]) {
    const v = testCurrent(components, a, b, amps);
    if (v === null) return null;
    if (Math.abs(v) <= OHM_COMPLIANCE) return v >= 0 ? v / amps : null;
  }
  return null;
}

/** Forward voltage between two nodes at the diode test's 1 mA; null for OL. */
export function diodeAcross(components: Component[], a: string, b: string): number | null {
  if (sameNode(a, b)) return 0;
  const v = testCurrent(components, a, b, 1e-3);
  return v !== null && v >= 0 && v <= DIODE_COMPLIANCE ? v : null;
}

/** Forward voltage between two holes at the diode test's 1 mA, sources off; null for OL. */
export function diodeDrop(board: BoardState, red: HoleId, black: HoleId): number | null {
  const { circuit, nodeOf } = boardToCircuit({ supply: { ...board.supply, on: false }, parts: board.parts });
  return diodeAcross(circuit.components, nodeOf(red), nodeOf(black));
}

/** Resistance between two holes with every source switched off. */
export function ohmsBetween(board: BoardState, red: HoleId, black: HoleId): number | null {
  const { circuit, nodeOf } = boardToCircuit({ supply: { ...board.supply, on: false }, parts: board.parts });
  return ohmsAcross(circuit.components, nodeOf(red), nodeOf(black));
}

/**
 * What the meter reads. `solved` is the analysis of `meteredBoard(...)` (so in A mode the
 * current through the meter is in it).
 */
export function readMeter(
  board: BoardState, mode: MeterMode, probes: Probes,
  solved: { ok: boolean; voltageAt: (h: HoleId) => number | undefined; currents: Record<string, number> },
): Reading {
  if (mode === 'off') return { text: '', unit: '' };
  if (!both(probes)) return { text: '- - - -', unit: mode === 'A' ? 'mA' : mode === 'diode' ? 'V' : mode };
  if (mode === 'diode') {
    const v = diodeDrop(board, probes.red, probes.black);
    if (v === null) return { text: 'OL', unit: 'V', note: 'OL: nothing conducts this way at the meter’s 3 V. Try the probes the other way round.' };
    return { text: v.toFixed(3), unit: 'V', value: v, note: v < 0.05 ? 'Near 0 V: the probes are joined (a short, or a wire).' : undefined };
  }
  if (mode === 'V') {
    if (!solved.ok) return { text: '- - - -', unit: 'V' };
    const v = (solved.voltageAt(probes.red) ?? 0) - (solved.voltageAt(probes.black) ?? 0);
    return { ...scaled(v, 'V'), value: v };
  }
  if (mode === 'A') {
    const i = solved.currents[AMMETER_ID] ?? 0;
    if (!solved.ok || Math.abs(i) > FUSE_AMPS) {
      return { text: 'FUSE', unit: '', note: 'Fuse blown: on A the meter is a wire, and that just shorted the supply. Measure current in series, not across.' };
    }
    return { ...scaled(i, 'A'), value: i };
  }
  const r = ohmsBetween(board, probes.red, probes.black);
  if (r === null) return { text: 'OL', unit: 'Ω', note: 'OL: no path the meter can push its test current through.' };
  return { ...scaled(r, 'Ω'), value: r };
}
