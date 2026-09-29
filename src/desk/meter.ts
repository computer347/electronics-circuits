/**
 * The desk multimeter, measured the way a real one works:
 * - V: the voltage of the red probe against the black one.
 * - A: the meter is a wire between the probes (that's what an ammeter is), so the board is
 *   solved with that wire in place and the reading is the current through it. Across a
 *   supply that's a short: the fuse blows.
 * - Ω: the supply and batteries are taken out and a small test current is pushed through the
 *   probes; the reading is volts over amps. No path, a capacitor or a diode reads OL.
 */
import type { HoleId } from '../breadboard/layout';
import { boardToCircuit, type BoardPart, type BoardState } from '../breadboard/model';
import { solve } from '../sim';

export type MeterMode = 'off' | 'V' | 'Ω' | 'A';
/** Dial order, clockwise. */
export const DIAL: MeterMode[] = ['off', 'V', 'Ω', 'A'];
export const AMMETER_ID = 'METER';
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
function scaled(v: number, unit: string): { text: string; unit: string } {
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

/** Resistance between two holes with every source switched off. */
export function ohmsBetween(board: BoardState, red: HoleId, black: HoleId): number | null {
  const { circuit, nodeOf } = boardToCircuit({ supply: { ...board.supply, on: false }, parts: board.parts });
  const a = nodeOf(red), b = nodeOf(black);
  if (a === b) return 0;
  const components = circuit.components.map((c) => (c.kind === 'vsource' ? { ...c, volts: 0, wave: undefined } : c));
  // Try a strong test current first, then weaker ones for big resistances.
  for (const amps of [1e-3, 1e-5, 1e-7]) {
    components.push({ kind: 'isource', id: '__TEST', a: b, b: a, amps });
    const r = solve({ components });
    components.pop();
    if (!r.ok) return null;
    const v = (r.nodeVoltages[a] ?? 0) - (r.nodeVoltages[b] ?? 0);
    if (Math.abs(v) <= OHM_COMPLIANCE) return v / amps;
  }
  return null;
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
  if (!both(probes)) return { text: '- - - -', unit: mode === 'A' ? 'mA' : mode };
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
  if (r === null || r < 0) return { text: 'OL', unit: 'Ω', note: 'OL: no path the meter can push its test current through.' };
  return { ...scaled(r, 'Ω'), value: r };
}
