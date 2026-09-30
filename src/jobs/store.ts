/**
 * The client job in progress, if any: which job, when it started (for the wall clock), and how
 * far along it is. The desk runs the level; this remembers that it's someone's job.
 */
import { create } from 'zustand';
import type { ClientJob } from './client';

export type ClientPhase = 'intro' | 'working' | 'outro' | 'pay';

interface ClientState {
  job: ClientJob | null;
  phase: ClientPhase;
  startedAt: number;
  stars: 1 | 2 | 3;
  /** Workshop clock (minutes) when the fix passed. */
  finishedAt: number;
  begin: (job: ClientJob) => void;
  work: () => void;
  fixed: (stars: 1 | 2 | 3, clock: number) => void;
  pay: () => void;
  clear: () => void;
}

export const useClient = create<ClientState>((set) => ({
  job: null, phase: 'intro', startedAt: 0, stars: 1, finishedAt: 0,
  begin: (job) => set({ job, phase: 'intro', startedAt: performance.now(), stars: 1, finishedAt: 0 }),
  work: () => set({ phase: 'working' }),
  fixed: (stars, finishedAt) => set({ phase: 'outro', stars, finishedAt }),
  pay: () => set({ phase: 'pay' }),
  clear: () => set({ job: null, phase: 'intro' }),
}));
