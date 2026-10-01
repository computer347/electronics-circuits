/**
 * Which level the desk opens, and which cards on the corkboard can be played. Within a world a
 * level opens once the one before it is passed. The first level of every world is always open:
 * nothing is mandatory, so you can start World 1 without finishing World 0.
 */
import { ALL_LEVELS, WORLDS } from '../levels';
import type { LevelRecord } from '../levels/progress';
import { devUnlockAll } from '../lib/dev';

const worldOf = (n: number) => WORLDS.find((w) => w.number === n);

export const isUnlocked = (number: number, records: Record<string, LevelRecord>, world = 0) =>
  devUnlockAll || number === 1 || !!worldOf(world)?.levels.find((l) => l.number === number - 1 && records[l.id]);

/** The first level not passed yet, in world order, or null when everything is done. */
export function nextLevel(records: Record<string, LevelRecord>): string | null {
  return ALL_LEVELS.find((l) => !records[l.id])?.id ?? null;
}

/** The level after this one if it's open; after a world's last level, the next world's first. */
export function followingLevel(id: string, records: Record<string, LevelRecord>): string | null {
  const l = ALL_LEVELS.find((x) => x.id === id);
  if (!l) return null;
  const w = worldOf(l.world);
  const n = w?.levels.find((x) => x.number === l.number + 1);
  if (n) return isUnlocked(n.number, records, l.world) ? n.id : null;
  return worldOf(l.world + 1)?.levels[0]?.id ?? null;
}
