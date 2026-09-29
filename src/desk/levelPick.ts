/**
 * Which level the desk opens, and which cards on the corkboard can be played. A level opens
 * once the one before it is passed, the same rule as the old level map.
 */
import { WORLD0 } from '../levels';
import type { LevelRecord } from '../levels/progress';

export const isUnlocked = (number: number, records: Record<string, LevelRecord>) =>
  number === 1 || !!WORLD0.find((l) => l.number === number - 1 && records[l.id]);

/** The first level not passed yet, or null when World 0 is all done. */
export function nextLevel(records: Record<string, LevelRecord>): string | null {
  return [...WORLD0].sort((a, b) => a.number - b.number).find((l) => !records[l.id])?.id ?? null;
}

/** The level after this one, if it's open. */
export function followingLevel(id: string, records: Record<string, LevelRecord>): string | null {
  const l = WORLD0.find((x) => x.id === id);
  const n = l ? WORLD0.find((x) => x.number === l.number + 1) : undefined;
  return n && isUnlocked(n.number, records) ? n.id : null;
}
