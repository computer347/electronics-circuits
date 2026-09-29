/**
 * Which classes you've finished, kept in localStorage next to level progress. Guarded the
 * same way: if storage is blocked the classes still work, they just won't be ticked off.
 */
import { create } from 'zustand';

const KEY = 'signal-path.learn.v1';

export interface ClassRecord {
  /** Correct answers on the check at the best attempt, and how many questions it had. */
  best: number;
  of: number;
  finished: string;
}

interface LearnProgress {
  classes: Record<string, ClassRecord>;
  finish: (id: string, correct: number, of: number) => void;
  reset: () => void;
}

function readSaved(): Record<string, ClassRecord> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as { classes?: Record<string, ClassRecord> }) : null;
    return v?.classes && typeof v.classes === 'object' ? v.classes : {};
  } catch {
    return {};
  }
}

function save(classes: Record<string, ClassRecord>) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify({ classes })); } catch { /* not saved */ }
}

export const useLearnProgress = create<LearnProgress>((set, get) => ({
  classes: readSaved(),
  finish: (id, correct, of) => {
    const prev = get().classes[id];
    const rec: ClassRecord = {
      best: Math.max(prev?.best ?? 0, correct), of,
      finished: prev?.finished ?? new Date().toISOString(),
    };
    const classes = { ...get().classes, [id]: rec };
    save(classes);
    set({ classes });
  },
  reset: () => { save({}); set({ classes: {} }); },
}));
