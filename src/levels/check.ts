/**
 * Checking a level: run the spec against the solved board, and when it fails, say what is
 * actually wrong in the circuit ("LED1 is in backwards"), never just "wrong".
 */
import { hole, type HoleId } from '../breadboard/layout';
import { analyzeBoard, boardToCircuit, SUPPLY_ID, type BoardAnalysis, type BoardPart, type BoardState } from '../breadboard/model';
import { Simulator, solve } from '../sim';
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

/**
 * Nets: strips joined by jumper wires (and closed buttons) are one electrical point. The
 * bench supply's + is the T+ rail, ground the T- rail.
 */
function nets(board: BoardState) {
  const parent = new Map<string, string>();
  const find = (x: string): string => { const p = parent.get(x) ?? x; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
  for (const p of board.parts) {
    if (p.kind === 'wire' || (p.kind === 'button' && p.pressed)) parent.set(find(hole(p.h1).strip), find(hole(p.h2).strip));
  }
  return (h: HoleId) => find(hole(h).strip);
}

/** Jumper wires on a path between two strips (to name the one that shorts something out). */
function wirePath(board: BoardState, from: string, to: string): string[] {
  const wires = board.parts.filter((p) => p.kind === 'wire');
  const prev = new Map<string, { strip: string; wire: string } | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const w of wires) {
      const a = hole(w.h1).strip, b = hole(w.h2).strip;
      const next = a === cur ? b : b === cur ? a : null;
      if (next && !prev.has(next)) { prev.set(next, { strip: cur, wire: w.id }); queue.push(next); }
    }
  }
  const out: string[] = [];
  for (let at = to; prev.get(at); at = prev.get(at)!.strip) out.unshift(prev.get(at)!.wire);
  return prev.has(to) ? out : [];
}

/**
 * Why a voltage divider isn't dividing: the shapes players actually build by mistake
 * (the test point wired straight to the supply, both resistors side by side, one missing,
 * or the right shape with the resistors the wrong way round).
 */
/** An LED counts as lit above this current (a dim glow under 1 mA reads as off, as it would by eye). */
const LIT_AMPS = 1e-3;

export function explainDivider(board: BoardState, a: BoardAnalysis, tp: HoleId, label: string, fixed: ReadonlySet<string> = new Set()): Diagnosis | null {
  if (!a.result.ok) return null;
  const netOf = nets(board);
  const TP = netOf(tp), PLUS = netOf('T+:1'), GND = netOf('T-:1');
  const vs = board.supply.volts;
  const v = a.voltageAt(tp) ?? 0;
  const rs = board.parts.filter((p) => p.kind === 'resistor');
  const ends = (p: BoardPart) => [netOf(p.h1), netOf(p.h2)];
  const pair = (p: BoardPart) => ends(p).sort().join('|');
  const onTp = rs.filter((p) => ends(p).includes(TP));
  const where = (n: string) => (n === PLUS ? `${vs} V` : n === GND ? 'ground' : n === TP ? label : 'the same point');

  // the player's own jumpers on the path, not the level's fixed wiring
  const culprits = (to: string) => wirePath(board, hole(tp).strip, to).filter((w) => !fixed.has(w));
  const named = (ws: string[]) => (ws.length ? `jumper ${ws.join(' and ')}` : 'a jumper');
  if (TP === PLUS) {
    const w = culprits('T+');
    return { part: w[0], message: `${label} is wired straight to the ${vs} V supply by ${named(w)}, so it sits at the full ${vs} V and no resistor gets a chance to drop any of it. The top resistor should be the only thing between ${vs} V and ${label}: remove ${w.length > 1 ? 'those jumpers' : 'that jumper'}.` };
  }
  if (TP === GND) {
    const w = culprits('T-');
    return { part: w[0], message: `${label} is wired straight to ground by ${named(w)}, so it reads 0 V whatever the resistors do. The bottom resistor should be the only thing between ${label} and ground.` };
  }
  // two or more resistors across the same two points: parallel, not a chain
  const groups = new Map<string, BoardPart[]>();
  for (const p of rs) { const k = pair(p); groups.set(k, [...(groups.get(k) ?? []), p]); }
  for (const [k, g] of groups) {
    if (g.length < 2) continue;
    // name the ends in reading order: supply first, ground last
    const rank = (n: string) => (n === PLUS ? 0 : n === GND ? 2 : 1);
    const [n1, n2] = (k.split('|') as [string, string]).sort((x, y) => rank(x) - rank(y));
    const names = g.map((p) => p.id).join(' and ');
    const nv = (n: string) => a.result.nodeVoltages[n === PLUS ? 'T+' : n === GND ? '0' : n] ?? 0;
    const volts = Math.abs(nv(n1) - nv(n2));
    const effect = volts > 0.05
      ? `so each gets the same ${formatSI(volts, 'V')} and their currents add`
      : 'so together they act like one smaller resistor, and nothing else completes the chain';
    const tpNote = n1 === TP || n2 === TP ? '' : ` (${label} isn't between them at all)`;
    return {
      part: g[0]!.id,
      message: `${names} are in parallel: both sit between ${where(n1)} and ${where(n2)}${tpNote}, ${effect}. A divider needs them in a chain: ${vs} V → top resistor → ${label} → bottom resistor → ground.`,
    };
  }
  const across = rs.find((p) => ends(p).includes(PLUS) && ends(p).includes(GND));
  if (across) {
    return { part: across.id, message: `${across.id} runs from ${vs} V straight to ground, past ${label}, so it only wastes current and doesn't set ${label} at all. Move its lower leg to ${label} (column ${hole(tp).strip.slice(1)}) so it becomes the top half of the divider.` };
  }
  const top = onTp.filter((p) => ends(p).includes(PLUS));
  const bottom = onTp.filter((p) => ends(p).includes(GND));
  if (!onTp.length) {
    return { message: `No resistor touches ${label}, so nothing sets its voltage (it reads ${formatSI(v, 'V')}). Put the top resistor from ${vs} V to ${label} and the bottom one from ${label} to ground.` };
  }
  if (!top.length) {
    return { part: onTp[0]!.id, message: `Nothing connects ${label} up to ${vs} V through a resistor: ${onTp.map((p) => p.id).join(', ')} ${onTp.length > 1 ? 'go' : 'goes'} elsewhere. Add the top resistor from the supply column to ${label}.` };
  }
  if (!bottom.length) {
    return { part: onTp[0]!.id, message: `Nothing connects ${label} down to ground through a resistor, so no current flows and ${label} floats up to ${formatSI(v, 'V')}. Add the bottom resistor from ${label} to ground (column 25 is already wired to it).` };
  }
  if (top.length === 1 && bottom.length === 1) {
    const rt = top[0]!.ohms ?? 0, rb = bottom[0]!.ohms ?? 0;
    const vout = (vs * rb) / (rt + rb);
    const fix = vout > 3.2 ? `The bottom resistor should be the smaller one, about half the top one${rb > rt ? ': try swapping them' : ''}.` : 'The bottom resistor is too small next to the top one: aim for about half the top one.';
    return { part: bottom[0]!.id, message: `The shape is right, the values aren't: ${vs} V × ${formatSI(rb, 'Ω')} / (${formatSI(rt, 'Ω')} + ${formatSI(rb, 'Ω')}) = ${formatSI(vout, 'V')} at ${label}. ${fix}` };
  }
  return null;
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

function checkOne(c: SpecCheck, board: BoardState, analysis: BoardAnalysis, fixed: ReadonlySet<string> = new Set()): { line: CheckLine; why?: Diagnosis } {
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
        why: ok ? undefined
          : (c.divider ? explainDivider(board, analysis, c.hole, label, fixed) : null)
            ?? { message: `${label} is ${formatSI(v, 'V')}; it should be ${range(c.min, c.max, 'V')}.` },
      };
    }
    case 'supply-current': {
      const i = r.ok && board.supply.on ? Math.abs(r.currents[SUPPLY_ID] ?? 0) : 0;
      const ok = r.ok && i <= c.max && (c.min === undefined || i >= c.min);
      const label = c.min !== undefined ? `Supply current ${range(c.min, c.max, 'A')}` : `Supply current at most ${formatSI(c.max, 'A')}`;
      return {
        line: { ok, label, measured: mA(i) },
        why: ok ? undefined : {
          message: i > c.max
            ? `The supply is delivering ${mA(i)}, over the ${formatSI(c.max, 'A')} budget.`
            : `The supply is delivering only ${mA(i)}.`,
        },
      };
    }
    case 'charge-time': {
      const t = chargeTime(board, c.part);
      const ok = t.seconds !== undefined && t.seconds >= c.min && t.seconds <= c.max;
      const sec = (x: number) => formatSI(x, 's');
      return {
        line: { ok, label: `${c.part} reaches 63 % in ${range(c.min, c.max, 's')}`, measured: t.seconds !== undefined ? sec(t.seconds) : t.final < 0.1 ? 'never charges' : 'over 20 s' },
        why: ok ? undefined : t.seconds === undefined && t.final < 0.1
          ? { part: c.part, message: `${c.part} never charges: even with the button held there's no path from the supply to its + leg.` }
          : {
            part: c.part,
            message: t.seconds === undefined
              ? `${c.part} is charging far too slowly (not at 63 % after 20 s).`
              : `${c.part} reaches 63 % of its final ${formatSI(t.final, 'V')} after ${sec(t.seconds)}. The target is ${range(c.min, c.max, 's')}. ${t.seconds < c.min ? 'Too fast' : 'Too slow'}: the time constant is τ = R × C.`,
          },
      };
    }
    case 'switched-led': {
      const at = (pressed: boolean) => {
        const b: BoardState = { ...board, parts: board.parts.map((p) => (p.kind === 'button' ? { ...p, pressed } : p)) };
        const a = analyzeBoard(b);
        return a.result.ok ? Math.abs(a.result.currents[c.part] ?? 0) : 0;
      };
      const on = at(true), off = at(false);
      const hasButton = board.parts.some((p) => p.kind === 'button');
      const okOn = on >= c.min && on <= c.max, okOff = off < 1e-4;
      const ok = hasButton && okOn && okOff;
      const btn = board.parts.find((p) => p.kind === 'button');
      const why: Diagnosis | undefined = ok ? undefined
        : !hasButton ? { message: `There's no push button on the board yet: ${c.part} should light only while one is held.` }
          : !okOff ? { part: btn?.id, message: `${c.part} stays on when the button is let go (${mA(off)}): something else bridges the gap, so the button isn't in control.` }
            : btn && hole(btn.h1).strip === hole(btn.h2).strip ? { part: btn.id, message: `${btn.id} has both legs in the same column, so pressing it joins nothing. Put it across the gap: one leg on each side.` }
              : on < c.min ? { part: c.part, message: `With the button held, ${c.part} only gets ${mA(on)}. ${on < 1e-4 ? 'The button isn’t closing the loop: check it sits across the gap.' : 'More current needs less resistance.'}` }
                : { part: c.part, message: `With the button held, ${c.part} takes ${mA(on)}, over its limit.` };
      return { line: { ok, label: `${c.part} lit only while the button is held`, measured: `${mA(on)} held · ${mA(off)} let go` }, why };
    }
    case 'led-pattern': {
      const a = analyzeBoard(board);
      const lit = (id: string) => a.result.ok && Math.abs(a.result.currents[id] ?? 0) > LIT_AMPS;
      const wrong = Object.entries(c.leds).filter(([id, on]) => lit(id) !== on);
      const show = (on: boolean) => (on ? '1' : '0');
      return {
        line: { ok: wrong.length === 0, label: c.label ?? 'The LEDs show the pattern', measured: Object.keys(c.leds).map((id) => show(lit(id))).join(' ') },
        why: wrong.length ? { part: wrong[0]![0], message: `${wrong.map(([id, on]) => `${id} should be ${on ? 'lit' : 'dark'}`).join(', ')}.` } : undefined,
      };
    }
    case 'truth-table': {
      // "?" is whichever toggle the player added (the one the spec doesn't name).
      const named = new Set(c.inputs.filter((x) => x !== '?'));
      const extra = board.parts.filter((p) => p.kind === 'toggle' && !named.has(p.id)).map((p) => p.id);
      const inputs = c.inputs.map((x) => (x === '?' ? extra.shift() ?? '' : x));
      if (inputs.includes('')) {
        return { line: { ok: false, label: c.label ?? `${c.output} follows the truth table`, measured: 'a switch is missing' }, why: { message: 'There’s no second switch on the board yet: take a toggle from the bar.' } };
      }
      const n = inputs.length;
      const rows = Array.from({ length: 1 << n }, (_, i) => {
        const b: BoardState = { ...board, parts: board.parts.map((p) => { const k = inputs.indexOf(p.id); return k < 0 ? p : { ...p, pressed: !!(i & (1 << k)) }; }) };
        const a = analyzeBoard(b);
        const got: 0 | 1 = a.result.ok && Math.abs(a.result.currents[c.output] ?? 0) > LIT_AMPS ? 1 : 0;
        return { i, got, want: c.table[i]! };
      });
      const bad = rows.filter((r) => r.got !== r.want);
      const combo = (i: number) => inputs.map((id, k) => `${id} ${i & (1 << k) ? 'on' : 'off'}`).join(', ');
      return {
        line: { ok: bad.length === 0, label: c.label ?? `${c.output} follows the truth table`, measured: rows.map((r) => r.got).join('') },
        why: bad.length ? { part: c.output, message: `With ${combo(bad[0]!.i)}, ${c.output} should be ${bad[0]!.want ? 'lit' : 'dark'} but it's ${bad[0]!.got ? 'lit' : 'dark'}.` } : undefined,
      };
    }
    case 'part-current': {
      const held: BoardState = { ...board, parts: board.parts.map((p) => (p.kind === 'button' ? { ...p, pressed: true } : p)) };
      const a = analyzeBoard(held);
      const amps = a.result.ok ? Math.abs(a.result.currents[c.part] ?? 0) : 0;
      const ok = a.result.ok && amps <= c.max;
      const owner = c.part.split('.')[0];
      return {
        line: { ok, label: c.label ?? `${c.part} at most ${mA(c.max)}`, measured: mA(amps) },
        why: ok ? undefined : { part: owner, message: `${c.part === `${owner}.base` ? `${owner}'s base` : c.part} takes ${mA(amps)} with the button held, over ${mA(c.max)}.` },
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

/**
 * One time constant, measured the way you would on the bench: start with the capacitor empty,
 * hold every button down, and time how long it takes to reach 63 % of where it settles.
 */
export function chargeTime(board: BoardState, capId: string, maxSeconds = 20): { seconds?: number; final: number } {
  const held: BoardState = { ...board, parts: board.parts.map((p) => (p.kind === 'button' ? { ...p, pressed: true } : p)) };
  const { circuit, nodeOf } = boardToCircuit(held);
  const cap = held.parts.find((p) => p.id === capId);
  if (!cap) return { final: 0 };
  const v = (r: { nodeVoltages: Record<string, number> }) => (r.nodeVoltages[nodeOf(cap.h1)] ?? 0) - (r.nodeVoltages[nodeOf(cap.h2)] ?? 0);
  const dc = solve(circuit);
  if (!dc.ok) return { final: 0 };
  const final = v(dc);
  if (Math.abs(final) < 0.1) return { final };
  const target = 0.632 * final;
  const sim = new Simulator(circuit);
  const dt = 2e-3;
  let prev = 0, t = 0;
  while (t < maxSeconds) {
    const r = sim.step(dt);
    if (!r.ok) return { final };
    t = r.time;
    const now = v(r);
    if (Math.abs(now) >= Math.abs(target)) {
      const f = (target - prev) / (now - prev || 1);
      return { seconds: t - dt + f * dt, final };
    }
    prev = now;
  }
  return { final };
}

export function checkLevel(level: LevelDef, board: BoardState, analysis: BoardAnalysis): CheckResult {
  const results = level.spec.map((c) => {
    const x = checkOne(c, board, analysis, new Set([...(level.locked ?? []), ...(level.pinned ?? [])]));
    if (!x.line.ok && c.explain) x.why = { ...(x.why ?? { message: '' }), message: `${x.why?.message ?? ''} ${c.explain}`.trim() };
    return x;
  });
  const pass = results.every((x) => x.line.ok);
  return { pass, lines: results.map((x) => x.line), diagnosis: results.find((x) => !x.line.ok && x.why)?.why };
}

export interface RunStats {
  hintsUsed: number;
  /** Multimeter measurements made. */
  measurements: number;
  burnt: number;
  checks: number;
  partsAdded: number;
  seconds: number;
}

/** 1 = bronze (spec met), 2 = silver (no hints, nothing burnt), 3 = gold (silver, within par). */
export function stars(level: LevelDef, s: RunStats): 1 | 2 | 3 {
  if (s.hintsUsed > 0 || s.burnt > 0) return 1;
  const withinPar = s.checks <= level.par.checks
    && (level.par.partsAdded === undefined || s.partsAdded <= level.par.partsAdded)
    && (level.par.measurements === undefined || s.measurements <= level.par.measurements);
  return withinPar ? 3 : 2;
}

/** Parts the player added (on the board now, not in the level's starting board). */
export function partsAdded(level: LevelDef, board: BoardState): number {
  const start = new Set(level.board.parts.map((p) => p.id));
  return board.parts.filter((p) => !start.has(p.id)).length;
}
