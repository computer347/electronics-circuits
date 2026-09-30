/**
 * Which screen is showing: the front page, the desk (where the campaign is played), the
 * workshop (the activity test levels), or one of the workshop's benches. A store rather
 * than App state so any view can send you somewhere else.
 */
import { create } from 'zustand';

export type Screen = 'home' | 'desk' | 'workshop' | 'repair' | 'coding';

export const useNav = create<{ screen: Screen; job: string | null; go: (screen: Screen, job?: string) => void }>((set) => ({
  screen: 'home',
  job: null,
  go: (screen, job) => set({ screen, job: job ?? null }),
}));
