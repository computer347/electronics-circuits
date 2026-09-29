/**
 * Which screen is showing: the front page, or the desk (where everything else happens).
 * A store rather than App state so any view can send you back to the front page.
 */
import { create } from 'zustand';

export type Screen = 'home' | 'desk';

export const useNav = create<{ screen: Screen; go: (screen: Screen) => void }>((set) => ({
  screen: 'home',
  go: (screen) => set({ screen }),
}));
