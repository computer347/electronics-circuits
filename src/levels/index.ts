/**
 * Level registry. Levels are JSON files; `parseLevel` checks each one against the board so
 * a typo in a hole or part id fails loudly (and in the tests) instead of at play time.
 */
import { HOLE_BY_ID } from '../breadboard/layout';
import { applyFaults } from './faults';
import type { LevelDef } from './types';
export class LevelError extends Error {}

const TOOLS = new Set(['select', 'wire', 'resistor', 'led', 'button', 'toggle', 'spdt', 'dip', 'battery', 'capacitor', 'generator', 'diode', 'pot', 'npn', 'nmos', 'regulator', 'probe', 'scope']);

export function parseLevel(raw: unknown): LevelDef {
  const l = raw as LevelDef;
  const fail = (m: string): never => { throw new LevelError(`${l?.id ?? 'level'}: ${m}`); };
  if (!l || typeof l.id !== 'string' || typeof l.title !== 'string') fail('missing id or title');
  if (!Array.isArray(l.board?.parts)) fail('missing board.parts');
  const ids = new Set<string>();
  for (const p of l.board.parts) {
    if (ids.has(p.id)) fail(`duplicate part id ${p.id}`);
    ids.add(p.id);
    for (const h of [p.h1, p.h2, ...(p.h3 ? [p.h3] : []), ...(p.pins ?? [])]) if (!HOLE_BY_ID.has(h)) fail(`${p.id} uses a hole that doesn't exist: ${h}`);
  }
  for (const id of [...(l.locked ?? []), ...(l.pinned ?? [])]) if (!ids.has(id)) fail(`locked part ${id} isn't on the board`);
  for (const t of l.tools) if (!TOOLS.has(t)) fail(`unknown tool ${t}`);
  for (const c of l.spec) {
    if ((c.kind === 'led-current' || c.kind === 'switched-led') && !ids.has(c.part)) fail(`spec refers to missing part ${c.part}`);
    if (c.kind === 'part-current' && !ids.has(c.part.split('.')[0]!)) fail(`spec refers to missing part ${c.part}`);
    if (c.kind === 'sequence') for (const st of c.steps) for (const id of [...Object.keys(st.set), ...Object.keys(st.expect)]) if (!ids.has(id)) fail(`sequence refers to missing part ${id}`);
    if (c.kind === 'led-pattern') for (const id of Object.keys(c.leds)) if (!ids.has(id)) fail(`spec refers to missing LED ${id}`);
    if (c.kind === 'truth-table') {
      for (const id of [...c.inputs, c.output]) if (id !== '?' && !ids.has(id)) fail(`truth table refers to missing part ${id}`);
      if (c.table.length !== 1 << c.inputs.length) fail('truth table has the wrong number of rows');
    }
    if ((c.kind === 'led-current' || c.kind === 'switched-led') && !(c.min < c.max)) fail(`spec window for ${c.part} is empty`);
    if (c.kind === 'voltage' && (!HOLE_BY_ID.has(c.hole) || (c.ref && !HOLE_BY_ID.has(c.ref)))) fail('spec refers to a missing hole');
    if (c.kind === 'charge-time' && !l.board.parts.some((p) => p.id === c.part && p.kind === 'capacitor')) fail(`charge-time refers to ${c.part}, which isn't a capacitor`);
  }
  if (!l.spec.length) fail('no spec: nothing to pass');
  for (const h of [l.scope?.ch1, l.scope?.ch2]) if (h && !HOLE_BY_ID.has(h)) fail(`scope probe on a missing hole: ${h}`);
  applyFaults(l.board, l.faults); // throws if a fault doesn't fit the board
  return l;
}

/** A world's level files, in file-name order (01-…, 02-…), parsed and checked. */
const load = (files: Record<string, unknown>) =>
  Object.keys(files).sort().map((k) => parseLevel((files[k] as { default?: unknown }).default ?? files[k]));

/** World 0, in order. */
export const WORLD0: LevelDef[] = load(import.meta.glob('./world0/*.json', { eager: true }));

/** World 0's slots, so the level map can show what's coming. */
export const WORLD0_PLAN = [
  { number: 1, title: 'First light', topic: 'LED + resistor' },
  { number: 2, title: 'Wrong way round', topic: 'Reversed diode' },
  { number: 3, title: 'Side by side', topic: 'Series vs parallel' },
  { number: 4, title: 'Split the difference', topic: 'Voltage divider' },
  { number: 5, title: 'Slow blink', topic: 'RC timing' },
  { number: 6, title: 'Fork in the road', topic: 'Current splits (KCL)' },
  { number: 7, title: 'Push to light', topic: 'Switches' },
  { number: 8, title: 'Stack them up', topic: 'Batteries in series' },
  { number: 9, title: 'Balance the bridge', topic: 'Wheatstone bridge' },
  { number: 10, title: 'Switch it', topic: 'Transistor switch' },
  { number: 11, title: 'Two in a row', topic: 'LEDs in series' },
  { number: 12, title: 'Mixed colours', topic: 'Forward voltages' },
  { number: 13, title: 'Make do', topic: 'Combining resistors' },
  { number: 14, title: 'Bypassed', topic: 'Short circuits' },
  { number: 15, title: 'Dead rail', topic: 'Rails and continuity' },
  { number: 16, title: 'Power budget', topic: 'Power and supply limits' },
  { number: 17, title: 'One-way valve', topic: 'Diodes' },
  { number: 18, title: 'Turn it down', topic: 'Potentiometer (rheostat)' },
  { number: 19, title: 'Set the level', topic: 'Potentiometer (divider)' },
  { number: 20, title: 'Wrong partner', topic: 'Sensor dividers' },
  { number: 21, title: 'Under load', topic: 'Loaded dividers' },
  { number: 22, title: 'Double up', topic: 'Capacitors in parallel' },
  { number: 23, title: 'Regulated', topic: 'Voltage regulators' },
  { number: 24, title: 'Enough gain', topic: 'Transistor gain' },
  { number: 25, title: 'Heavy lifting', topic: 'MOSFETs' },
];

/** World 1: logic, built first from the parts World 0 taught (switches, transistors). */
export const WORLD1: LevelDef[] = load(import.meta.glob('./world1/*.json', { eager: true }));

export const WORLD1_PLAN = [
  { number: 1, title: 'Count in lights', topic: 'Binary' },
  { number: 2, title: 'Both', topic: 'AND' },
  { number: 3, title: 'Either will do', topic: 'OR' },
  { number: 4, title: 'Not', topic: 'NOT (inverter)' },
  { number: 5, title: 'Not both', topic: 'NAND' },
  { number: 6, title: 'Stairwell', topic: 'XOR' },
  { number: 7, title: 'Power the chip', topic: 'Logic chips' },
  { number: 8, title: 'Half adder', topic: 'Adding bits' },
  { number: 9, title: 'Remember', topic: 'Latch (memory)' },
  { number: 10, title: 'Either way in', topic: 'Diode logic' },
  { number: 11, title: 'Upside down', topic: 'Inverter chip' },
  { number: 12, title: 'AND from NANDs', topic: 'Universal gates' },
  { number: 13, title: 'OR from NANDs', topic: 'De Morgan’s law' },
  { number: 14, title: 'Same or different', topic: 'XNOR (equality)' },
  { number: 15, title: 'Odd one out', topic: 'Parity' },
  { number: 16, title: 'Burglar alarm', topic: 'Words to gates' },
  { number: 17, title: 'Majority vote', topic: 'Sum of products' },
  { number: 18, title: 'Pick one', topic: 'Multiplexer' },
  { number: 19, title: 'One of four', topic: 'Decoder' },
  { number: 20, title: 'Crack the code', topic: 'Code comparator' },
  { number: 21, title: 'Drive it harder', topic: 'Logic drivers' },
  { number: 22, title: 'Full adder', topic: 'Adding with carry' },
  { number: 23, title: 'Hold that bit', topic: 'D latch' },
  { number: 24, title: 'Traffic lights', topic: 'State decoding' },
];

export interface World { number: number; name: string; levels: LevelDef[]; plan: { number: number; title: string; topic: string }[] }

/** Every world, in order. */
export const WORLDS: World[] = [
  { number: 0, name: 'Foundations', levels: WORLD0, plan: WORLD0_PLAN },
  { number: 1, name: 'Logic', levels: WORLD1, plan: WORLD1_PLAN },
];

export const ALL_LEVELS: LevelDef[] = WORLDS.flatMap((w) => w.levels);

export const levelById = (id: string) => ALL_LEVELS.find((l) => l.id === id);

/** The board the player starts with: the level's board with its faults applied. */
export const startingBoard = (l: LevelDef) => applyFaults(l.board, l.faults);
