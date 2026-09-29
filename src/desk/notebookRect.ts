/**
 * Where the open notebook's two pages are on screen, in CSS pixels. The 3D scene measures it
 * each frame while the book is presented; the HTML pages (Theory, Math) are laid exactly over it.
 */
import { create } from 'zustand';

export interface Rect { left: number; top: number; width: number; height: number }

export const useNotebookRect = create<{ rect: Rect | null; set: (r: Rect | null) => void }>((set, get) => ({
  rect: null,
  set: (r) => {
    const cur = get().rect;
    if (!r || !cur) { if (r !== cur) set({ rect: r }); return; }
    // Only re-render when it has actually moved.
    if (Math.abs(r.left - cur.left) + Math.abs(r.top - cur.top) + Math.abs(r.width - cur.width) + Math.abs(r.height - cur.height) > 1) set({ rect: r });
  },
}));
