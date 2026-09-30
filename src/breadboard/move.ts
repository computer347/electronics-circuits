/**
 * Moving parts around the board: single parts, or a part together with everything
 * connected to it (its "island"), and hole-occupancy rules.
 */

import { HOLES, hole, type HoleId } from './layout';
import { legsOf, type BoardPart } from './model';

const isRail = (h: HoleId) => h.includes(':');
const key = (x: number, z: number) => `${x.toFixed(1)},${z.toFixed(1)}`;
const HOLE_AT = new Map(HOLES.map((h) => [key(h.x, h.z), h.id]));

/** Hole at a board position, if there is one exactly there. */
export function holeAt(x: number, z: number): HoleId | undefined {
  return HOLE_AT.get(key(x, z));
}

/** Holes that already have a leg in them. */
export function occupiedHoles(parts: BoardPart[], except: ReadonlySet<string> = new Set()): Set<HoleId> {
  const s = new Set<HoleId>();
  for (const p of parts) {
    if (except.has(p.id)) continue;
    for (const h of legsOf(p)) s.add(h);
  }
  return s;
}

/**
 * The part plus every part connected to it through the main-area strips.
 * Rails are not followed (they'd connect almost everything).
 */
export function connectedGroup(parts: BoardPart[], id: string): string[] {
  const start = parts.find((p) => p.id === id);
  if (!start) return [];
  const group = new Set<string>([id]);
  const strips = new Set<string>();
  const addStrips = (p: BoardPart) => {
    for (const h of legsOf(p)) if (!isRail(h)) strips.add(hole(h).strip);
  };
  addStrips(start);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of parts) {
      if (group.has(p.id)) continue;
      if (legsOf(p).some((h) => !isRail(h) && strips.has(hole(h).strip))) {
        group.add(p.id);
        addStrips(p);
        grew = true;
      }
    }
  }
  return parts.filter((p) => group.has(p.id)).map((p) => p.id);
}

export type MoveMode = 'single' | 'group';

export interface MoveResult {
  parts: BoardPart[];
  valid: boolean;
  reason?: string;
}

/**
 * Shift the parts in `ids` by the offset from `anchor` to `target`.
 * In group mode, legs plugged into a rail stay where they are (wires stretch),
 * so the moved circuit stays powered.
 */
export function translateParts(
  parts: BoardPart[],
  ids: readonly string[],
  anchor: HoleId,
  target: HoleId,
  mode: MoveMode,
): MoveResult {
  const a = hole(anchor), t = hole(target);
  const dx = t.x - a.x, dz = t.z - a.z;
  const moving = new Set(ids);
  const taken = occupiedHoles(parts, moving);
  const used = new Set<HoleId>();
  let valid = true;
  let reason: string | undefined;

  const shift = (h: HoleId): HoleId => {
    if (mode === 'group' && isRail(h)) return h;
    const info = hole(h);
    const n = holeAt(info.x + dx, info.z + dz);
    if (!n) { valid = false; reason ??= 'A leg would land off the board or between holes.'; return h; }
    return n;
  };

  const out = parts.map((p) => {
    if (!moving.has(p.id)) return p;
    const h1 = shift(p.h1), h2 = shift(p.h2), h3 = p.h3 ? shift(p.h3) : undefined;
    for (const h of h3 ? [h1, h2, h3] : [h1, h2]) {
      if (taken.has(h) && !(mode === 'group' && isRail(h) && legsOf(p).includes(h))) {
        valid = false; reason ??= `Hole ${hole(h).label} is already in use.`;
      }
      if (used.has(h)) { valid = false; reason ??= 'Two legs would share a hole.'; }
      used.add(h);
    }
    if (h1 === h2) { valid = false; reason ??= 'Both legs would be in the same hole.'; }
    return h3 ? { ...p, h1, h2, h3 } : { ...p, h1, h2 };
  });

  return { parts: out, valid, ...(reason && { reason }) };
}
