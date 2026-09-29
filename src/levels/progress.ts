/**
 * Saved progress (best stars and time per level), kept in this browser's localStorage.
 * Storage can be missing or blocked (private windows, previews), so every access is guarded
 * and the game still works, it just won't remember.
 */
import { create } from 'zustand';
import { WORLD0 } from '.';

const KEY = 'signal-path.progress.v1';

export interface LevelRecord {
  stars: 1 | 2 | 3;
  /** Fastest pass, in seconds. */
  seconds: number;
  /** ISO date of the first pass. */
  firstPassed: string;
}

interface Progress {
  levels: Record<string, LevelRecord>;
  record: (id: string, stars: 1 | 2 | 3, seconds: number) => { improved: boolean };
  reset: () => void;
}

function readSaved(): Record<string, LevelRecord> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as { levels?: Record<string, LevelRecord> }) : null;
    return v?.levels && typeof v.levels === 'object' ? v.levels : {};
  } catch {
    return {};
  }
}

function save(levels: Record<string, LevelRecord>) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify({ levels })); } catch { /* not saved; fine */ }
}

export const useProgress = create<Progress>((set, get) => ({
  levels: readSaved(),
  record: (id, stars, seconds) => {
    const prev = get().levels[id];
    const next: LevelRecord = {
      stars: prev ? (Math.max(prev.stars, stars) as 1 | 2 | 3) : stars,
      seconds: prev ? Math.min(prev.seconds, seconds) : seconds,
      firstPassed: prev?.firstPassed ?? new Date().toISOString(),
    };
    const levels = { ...get().levels, [id]: next };
    save(levels);
    set({ levels });
    return { improved: !prev || stars > prev.stars };
  },
  reset: () => { save({}); set({ levels: {} }); },
}));

/** World 0 stars so far, out of three per level. */
export function worldStars(records: Record<string, LevelRecord>): { got: number; max: number } {
  return { got: WORLD0.reduce((n, l) => n + (records[l.id]?.stars ?? 0), 0), max: WORLD0.length * 3 };
}
