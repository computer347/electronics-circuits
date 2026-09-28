/**
 * Checking a level: run the spec against the solved board, and when it fails, say what is
 * actually wrong in the circuit ("LED1 is in backwards"), never just "wrong".
 */
import { hole, type HoleId } from '../breadboard/layout';
import type { BoardAnalysis, BoardPart, BoardState } from '../breadboard/model';
import { formatSI } from '../lib/units';
import type { LevelDef, SpecCheck } from './types';

export interface CheckLine {
  ok: boolean;
  /** The requirement, e.g. "LED1 current 10–25 mA". */
  label: string;
  /** What the simulator measured, e.g. "31.8 mA". */
  measured: string;
}

export interface Diagnosis {
  message: string;
  /** Part to highlight on the board. */
  part?: string;
}

export interface CheckResult {
  pass: boolean;
  lines: CheckLine[];
  /** The most useful explanation of the first failure. */
  diagnosis?: Diagnosis;
}

const mA = (a: number) => formatSI(Math.abs(a) < 1e-9 ? 0 : a, 'A');
const range = (min: number, max: number, unit: string) => {
  const a = formatSI(min, unit), b = formatSI(max, unit);
  // "10 mA–25 mA" reads badly: share the unit when the prefix matches
  const [na, ua] = a.split(' '), [nb, ub] = b.split(' ');
  return ua === ub ? `${na}–${nb} ${ub}` : `${a} – ${b}`;
};

const stripLabel = (h: HoleId) => {
  const s = hole(h).strip;
  if (s.includes('+') || s.includes('-')) return `the ${s} rail`;
  return `column ${s.slice(1)} (${s.startsWith('L') ? 'a–e' : 'f–j'})`;
};

/** Other things plugged into the strip a hole is on (not counting `self`). */
function neighbours(board: BoardState, h: HoleId, self: string): BoardPart[] {
  const strip = hole(h).strip;
  const out: BoardPart[] = [];
  const supply = board.supply.on && (strip === 'T+' || strip === 'T-');
  for (const p of board.parts) {
    if (p.id === self) continue;
    if (hole(p.h1).strip === strip || hole(p.h2).strip === strip) out.push(p);
  }
  if (supply) out.push({ id: 'supply', kind: 'wire', h1: h, h2: h });
  return out;
}

/** Why an LED is dark, dim, or too bright: the explanation a lab assistant would give. */
export function explainLed(board: BoardState, analysis: BoardAnalysis, id: string, min: number, max: number): Diagnosis | null {
  const p = board.parts.find((x) => x.id === id);
  if (!p) return { message: `${id} isn't on the board any more. Put an LED back.` };
  const r = analysis.result;
  if (p.burnt) {
    return { part: id, message: `${id} is burnt out. Something let too much current through it: fix that first, then replace the LED.` };
  }
  if (!r.ok) {
    const short = r.faults.find((f) => f.kind === 'short-circuit');
    return { message: short ? `Short circuit: ${short.message} Nothing gets powered while the supply is shorted.` : 'The circuit has no valid solution (check for sources wired against each other).' };
  }
  if (analysis.shortedParts.includes(id)) {
    return { part: id, message: `Both of ${id}'s legs are on the same strip, so the strip shorts it out and no current goes through the LED. Put its legs in two different columns.` };
  }
  const i = r.currents[id] ?? 0;
  const va = analysis.voltageAt(p.h1) ?? 0, vk = analysis.voltageAt(p.h2) ?? 0;
  if (i < 1e-6) {
    if (vk - va > 0.5) {
      return { part: id, message: `${id} is in backwards: its cathode (short leg) is ${formatSI(vk - va, 'V')} above its anode, so it blocks. Flip it (right-click → Flip polarity).` };
    }
    for (const [leg, name] of [[p.h1, 'anode (long leg)'], [p.h2, 'cathode (short leg)']] as const) {
      if (neighbours(board, leg, id).length === 0) {
        return { part: id, message: `Nothing else is plugged into ${stripLabel(leg)}, where ${id}'s ${name} is. Current needs a complete loop: supply +, through the LED, back to ground.` };
      }
    }
    return { part: id, message: `${id} gets no current: there's no complete loop from the supply's + through the LED and back to ground. Probe along the path with the multimeter to find where it breaks.` };
  }
  if (i < min) {
    return { part: id, message: `${id} is lit but dim: ${mA(i)}, below the ${formatSI(min, 'A')} it needs. Less resistance means more current.` };
  }
  if (i > max) {
    return { part: id, message: `${id} takes ${mA(i)}, above the datasheet's ${formatSI(max, 'A')}. It glows, but it's running hot and won't last. More resistance means less current.` };
  }
  return null;
}

function checkOne(c: SpecCheck, board: BoardState, analysis: BoardAnalysis): { line: CheckLine; why?: Diagnosis } {
  const r = analysis.result;
  switch (c.kind) {
    case 'led-current': {
      const p = board.parts.find((x) => x.id === c.part);
      const i = p && !p.burnt && r.ok ? r.currents[c.part] ?? 0 : 0;
      const ok = !!p && !p.burnt && r.ok && i >= c.min && i <= c.max;
      return {
        line: { ok, label: `${c.part} current ${range(c.min, c.max, 'A')}`, measured: p?.burnt ? 'burnt out' : mA(i) },
        why: ok ? undefined : explainLed(board, analysis, c.part, c.min, c.max) ?? undefined,
      };
    }
    case 'voltage': {
      const v = (analysis.voltageAt(c.hole) ?? 0) - (c.ref ? analysis.voltageAt(c.ref) ?? 0 : 0);
      const ok = r.ok && v >= c.min && v <= c.max;
      const label = c.label ?? `Voltage at ${hole(c.hole).label}${c.ref ? ` vs ${hole(c.ref).label}` : ''}`;
      return {
        line: { ok, label: `${label} ${range(c.min, c.max, 'V')}`, measured: r.ok ? formatSI(v, 'V') : '—' },
        why: ok ? undefined : { message: `${label} is ${formatSI(v, 'V')}; it should be ${range(c.min, c.max, 'V')}.` },
      };
    }
    case 'no-burnt': {
      const burnt = board.parts.filter((p) => p.burnt).map((p) => p.id);
      return {
        line: { ok: burnt.length === 0, label: 'No burnt parts on the board', measured: burnt.length ? burnt.join(', ') : 'none' },
        why: burnt.length ? { part: burnt[0], message: `${burnt.join(', ')} ${burnt.length > 1 ? 'are' : 'is'} burnt out. Replace ${burnt.length > 1 ? 'them' : 'it'} once the circuit is safe.` } : undefined,
      };
    }
  }
}

export function checkLevel(level: LevelDef, board: BoardState, analysis: BoardAnalysis): CheckResult {
  const results = level.spec.map((c) => checkOne(c, board, analysis));
  const pass = results.every((x) => x.line.ok);
  return { pass, lines: results.map((x) => x.line), diagnosis: results.find((x) => !x.line.ok && x.why)?.why };
}

export interface RunStats {
  hintsUsed: number;
  burnt: number;
  checks: number;
  partsAdded: number;
  seconds: number;
}

/** 1 = bronze (spec met), 2 = silver (no hints, nothing burnt), 3 = gold (silver, within par). */
export function stars(level: LevelDef, s: RunStats): 1 | 2 | 3 {
  if (s.hintsUsed > 0 || s.burnt > 0) return 1;
  const withinPar = s.checks <= level.par.checks && (level.par.partsAdded === undefined || s.partsAdded <= level.par.partsAdded);
  return withinPar ? 3 : 2;
}

/** Parts the player added (on the board now, not in the level's starting board). */
export function partsAdded(level: LevelDef, board: BoardState): number {
  const start = new Set(level.board.parts.map((p) => p.id));
  return board.parts.filter((p) => !start.has(p.id)).length;
}
