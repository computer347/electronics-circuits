/**
 * Half-size breadboard geometry and internal connections.
 *
 * Main area: 30 columns x rows a–j. In each column, holes a–e are one strip and f–j are
 * another; the centre gap separates them (chips straddle it). Power rails run along the
 * top (T+ / T-) and bottom (B+ / B-), 25 holes each in groups of five. Top and bottom
 * rails are NOT connected to each other: you have to jumper them, just like a real board.
 *
 * Units: 1 = one hole pitch (2.54 mm). The board top is at y = 0; x runs along columns,
 * z runs across rows (negative z = top of the board as seen by the player).
 */

export const COLS = 30;
export const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;
export type Row = (typeof ROWS)[number];
export const RAILS = ['T-', 'T+', 'B+', 'B-'] as const;
export type Rail = (typeof RAILS)[number];
export const RAIL_HOLES = 25;

/** Hole ids: main area "a1".."j30", rails "T+:1".."B-:25". */
export type HoleId = string;

const ROW_Z: Record<Row, number> = { j: -5, i: -4, h: -3, g: -2, f: -1, e: 1, d: 2, c: 3, b: 4, a: 5 };
const RAIL_Z: Record<Rail, number> = { 'T-': -8, 'T+': -7, 'B+': 7, 'B-': 8 };

export const BOARD = { width: 32, depth: 19, thickness: 0.8 } as const;

const colX = (col: number) => col - (COLS + 1) / 2;
/** Rail holes sit in five groups of five, aligned under columns 2–6, 8–12, ... */
const railX = (i: number) => colX(Math.floor((i - 1) / 5) * 6 + ((i - 1) % 5) + 2);

export interface HoleInfo {
  id: HoleId;
  x: number;
  z: number;
  /** The internal strip this hole belongs to. */
  strip: string;
  label: string;
}

function build(): HoleInfo[] {
  const holes: HoleInfo[] = [];
  for (const rail of RAILS) {
    for (let i = 1; i <= RAIL_HOLES; i++) {
      holes.push({ id: `${rail}:${i}`, x: railX(i), z: RAIL_Z[rail], strip: rail, label: `${rail} rail` });
    }
  }
  for (const row of ROWS) {
    const half = 'abcde'.includes(row) ? 'L' : 'U';
    for (let col = 1; col <= COLS; col++) {
      holes.push({ id: `${row}${col}`, x: colX(col), z: ROW_Z[row], strip: `${half}${col}`, label: `${row}${col}` });
    }
  }
  return holes;
}

export const HOLES: readonly HoleInfo[] = build();
export const HOLE_BY_ID: ReadonlyMap<HoleId, HoleInfo> = new Map(HOLES.map((h) => [h.id, h]));

export function hole(id: HoleId): HoleInfo {
  const h = HOLE_BY_ID.get(id);
  if (!h) throw new Error(`No such breadboard hole: ${id}`);
  return h;
}

/** All holes on the same strip (for highlighting what's connected). */
export function holesOnStrip(strip: string): HoleInfo[] {
  return HOLES.filter((h) => h.strip === strip);
}
