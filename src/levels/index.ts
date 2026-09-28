/**
 * Level registry. Levels are JSON files; `parseLevel` checks each one against the board so
 * a typo in a hole or part id fails loudly (and in the tests) instead of at play time.
 */
import { HOLE_BY_ID } from '../breadboard/layout';
import { applyFaults } from './faults';
import type { LevelDef } from './types';
import firstLight from './world0/01-first-light.json';

export class LevelError extends Error {}

const TOOLS = new Set(['select', 'wire', 'resistor', 'led', 'button', 'battery', 'capacitor', 'generator', 'probe', 'scope']);

export function parseLevel(raw: unknown): LevelDef {
  const l = raw as LevelDef;
  const fail = (m: string): never => { throw new LevelError(`${l?.id ?? 'level'}: ${m}`); };
  if (!l || typeof l.id !== 'string' || typeof l.title !== 'string') fail('missing id or title');
  if (!Array.isArray(l.board?.parts)) fail('missing board.parts');
  const ids = new Set<string>();
  for (const p of l.board.parts) {
    if (ids.has(p.id)) fail(`duplicate part id ${p.id}`);
    ids.add(p.id);
    for (const h of [p.h1, p.h2]) if (!HOLE_BY_ID.has(h)) fail(`${p.id} uses a hole that doesn't exist: ${h}`);
  }
  for (const id of l.locked ?? []) if (!ids.has(id)) fail(`locked part ${id} isn't on the board`);
  for (const t of l.tools) if (!TOOLS.has(t)) fail(`unknown tool ${t}`);
  for (const c of l.spec) {
    if (c.kind === 'led-current' && !ids.has(c.part)) fail(`spec refers to missing part ${c.part}`);
    if (c.kind === 'led-current' && !(c.min < c.max)) fail(`spec window for ${c.part} is empty`);
    if (c.kind === 'voltage' && (!HOLE_BY_ID.has(c.hole) || (c.ref && !HOLE_BY_ID.has(c.ref)))) fail('spec refers to a missing hole');
  }
  if (!l.spec.length) fail('no spec: nothing to pass');
  applyFaults(l.board, l.faults); // throws if a fault doesn't fit the board
  return l;
}

/** World 0, in order. Levels 2–5 slot in here as they're written. */
export const WORLD0: LevelDef[] = [parseLevel(firstLight)];

/** The five World 0 slots from the spec, so the map can show what's coming. */
export const WORLD0_PLAN = [
  { number: 1, title: 'First light', topic: 'LED + resistor' },
  { number: 2, title: 'Wrong way round', topic: 'Reversed diode' },
  { number: 3, title: 'Side by side', topic: 'Series vs parallel' },
  { number: 4, title: 'Split the difference', topic: 'Voltage divider' },
  { number: 5, title: 'Slow blink', topic: 'RC timing' },
];

export const levelById = (id: string) => WORLD0.find((l) => l.id === id);

/** The board the player starts with: the level's board with its faults applied. */
export const startingBoard = (l: LevelDef) => applyFaults(l.board, l.faults);
