/**
 * Which screen is showing. A store rather than App state so a level can open its class
 * and a class can start its level without threading callbacks through every view.
 */
import { create } from 'zustand';
import { useSession } from '../levels/session';
import type { Tab } from './menu';

interface Nav {
  tab: Tab;
  /** The class open in Learn (null shows the class list). */
  classId: string | null;
  go: (tab: Tab) => void;
  openClass: (id: string | null) => void;
  playLevel: (levelId: string) => void;
}

export const useNav = create<Nav>((set) => ({
  tab: 'home',
  classId: null,
  go: (tab) => {
    // Leaving the campaign puts the sandbox bench back the way it was.
    if (tab !== 'play') useSession.getState().exit();
    set({ tab });
  },
  openClass: (id) => {
    if (useNav.getState().tab === 'play') useSession.getState().exit();
    set({ tab: 'learn', classId: id });
  },
  playLevel: (levelId) => {
    set({ tab: 'play' });
    useSession.getState().start(levelId);
  },
}));
