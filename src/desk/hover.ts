/** The small riso tag that follows the pointer over a desk object ("Notebook · read the task"). */
import { create } from 'zustand';
import type { DeskObject } from './steps';

export const TAGS: Record<DeskObject, [string, string]> = {
  notebook: ['Notebook', 'read the task'],
  breadboard: ['Breadboard', 'build or fix'],
  meter: ['Multimeter', 'test it'],
  corkboard: ['Level map', 'pick a level'],
  scope: ['Oscilloscope', 'watch it change'],
};

interface Hover {
  object: DeskObject | null;
  x: number;
  y: number;
  set: (object: DeskObject | null, x?: number, y?: number) => void;
}

export const useHover = create<Hover>((set) => ({
  object: null, x: 0, y: 0,
  set: (object, x = 0, y = 0) => set({ object, x, y }),
}));
