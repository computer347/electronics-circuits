/**
 * Level registry. Levels are JSON files; `parseLevel` checks each one against the board so
 * a typo in a hole or part id fails loudly (and in the tests) instead of at play time.
 */
import { HOLE_BY_ID } from '../breadboard/layout';
import { applyFaults } from './faults';
import type { LevelDef } from './types';
import firstLight from './world0/01-first-light.json';
import wrongWayRound from './world0/02-wrong-way-round.json';
import sideBySide from './world0/03-side-by-side.json';
import splitTheDifference from './world0/04-split-the-difference.json';
import slowBlink from './world0/05-slow-blink.json';
import forkInTheRoad from './world0/06-fork-in-the-road.json';
import pushToLight from './world0/07-push-to-light.json';
import stackThemUp from './world0/08-stack-them-up.json';
import balanceTheBridge from './world0/09-balance-the-bridge.json';

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
  for (const id of [...(l.locked ?? []), ...(l.pinned ?? [])]) if (!ids.has(id)) fail(`locked part ${id} isn't on the board`);
  for (const t of l.tools) if (!TOOLS.has(t)) fail(`unknown tool ${t}`);
  for (const c of l.spec) {
    if ((c.kind === 'led-current' || c.kind === 'switched-led') && !ids.has(c.part)) fail(`spec refers to missing part ${c.part}`);
    if ((c.kind === 'led-current' || c.kind === 'switched-led') && !(c.min < c.max)) fail(`spec window for ${c.part} is empty`);
    if (c.kind === 'voltage' && (!HOLE_BY_ID.has(c.hole) || (c.ref && !HOLE_BY_ID.has(c.ref)))) fail('spec refers to a missing hole');
    if (c.kind === 'charge-time' && !l.board.parts.some((p) => p.id === c.part && p.kind === 'capacitor')) fail(`charge-time refers to ${c.part}, which isn't a capacitor`);
  }
  if (!l.spec.length) fail('no spec: nothing to pass');
  for (const h of [l.scope?.ch1, l.scope?.ch2]) if (h && !HOLE_BY_ID.has(h)) fail(`scope probe on a missing hole: ${h}`);
  applyFaults(l.board, l.faults); // throws if a fault doesn't fit the board
  return l;
}

/** World 0, in order. */
export const WORLD0: LevelDef[] = [
  firstLight, wrongWayRound, sideBySide, splitTheDifference, slowBlink,
  forkInTheRoad, pushToLight, stackThemUp, balanceTheBridge,
].map(parseLevel);

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
];

export const levelById = (id: string) => WORLD0.find((l) => l.id === id);

/** The board the player starts with: the level's board with its faults applied. */
export const startingBoard = (l: LevelDef) => applyFaults(l.board, l.faults);
