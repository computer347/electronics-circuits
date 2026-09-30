/**
 * The workshop's book: money from client jobs and the best stars on every workshop job, kept
 * in localStorage (guarded like progress, so a blocked store just means it isn't remembered).
 */
import { create } from 'zustand';

const KEY = 'signal-path.wallet.v1';

interface Saved { credits: number; done: Record<string, { paid: number; at: string; stars?: 1 | 2 | 3 }> }

function read(): Saved {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    return { credits: typeof v?.credits === 'number' ? v.credits : 0, done: v?.done && typeof v.done === 'object' ? v.done : {} };
  } catch { return { credits: 0, done: {} }; }
}

const write = (s: Saved) => { try { globalThis.localStorage?.setItem(KEY, JSON.stringify(s)); } catch { /* not saved */ } };

export const useWallet = create<Saved & { earn: (jobId: string, amount: number, stars?: 1 | 2 | 3) => void; complete: (jobId: string, stars: 1 | 2 | 3) => void }>((set, get) => ({
  ...read(),
  earn: (jobId, amount, stars) => {
    const prev = get().done[jobId];
    const best = Math.max(prev?.stars ?? 0, stars ?? 0) as 0 | 1 | 2 | 3;
    const next: Saved = { credits: get().credits + amount, done: { ...get().done, [jobId]: { paid: (prev?.paid ?? 0) + amount, at: new Date().toISOString(), ...(best ? { stars: best } : {}) } } };
    write(next);
    set(next);
  },
  complete: (jobId, stars) => get().earn(jobId, 0, stars),
}));
