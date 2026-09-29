/**
 * What the title screen shows, worked out from saved progress. Kept free of React so the
 * rules (where Continue goes, what the star count says) can be tested on their own.
 */
import { GENERATORS, TOPICS } from '../drills/generators';
import { WORLD0_CLASSES } from '../learn/classes';
import { WORLD0, WORLD0_PLAN } from '../levels';
import type { LevelRecord } from '../levels/progress';

export type Tab = 'home' | 'play' | 'learn' | 'drills' | 'breadboard' | 'bench';

export interface MenuItem {
  key: string;
  tab: Exclude<Tab, 'home'>;
  title: string;
  sub: string;
  /** Not built yet: shown, but can't be opened. */
  soon?: boolean;
}

export const MENU: MenuItem[] = [
  { key: '1', tab: 'play', title: 'Play', sub: 'Campaign · World 0 · Foundations' },
  { key: '2', tab: 'learn', title: 'Learn', sub: `Theory classes · World 0 · ${WORLD0_CLASSES.length} classes with live circuits` },
  { key: '3', tab: 'drills', title: 'Drills', sub: `Exam practice, ${TOPICS.length} topics, ${GENERATORS.length} question types, worked solutions` },
  { key: '4', tab: 'breadboard', title: 'Sandbox', sub: 'Breadboard, multimeter, oscilloscope' },
  { key: '5', tab: 'bench', title: 'Solver bench', sub: 'Type a netlist, read the voltages' },
];

export interface WorldStars { got: number; max: number }

export function worldStars(records: Record<string, LevelRecord>): WorldStars {
  return {
    got: WORLD0.reduce((n, l) => n + (records[l.id]?.stars ?? 0), 0),
    max: WORLD0_PLAN.length * 3,
  };
}

export type ContinueTarget =
  | { kind: 'level'; levelId: string; label: string; fresh: boolean }
  | { kind: 'map'; label: string };

/**
 * Continue opens the first level not yet passed (level 1 on a fresh save). Once every built
 * level is passed it opens the World 0 map instead, so you can go back for stars.
 */
export function continueTarget(records: Record<string, LevelRecord>): ContinueTarget {
  const next = [...WORLD0].sort((a, b) => a.number - b.number).find((l) => !records[l.id]);
  if (next) {
    const fresh = Object.keys(records).length === 0;
    return { kind: 'level', levelId: next.id, label: `${next.world}–${next.number} ${next.title}`, fresh };
  }
  const { got, max } = worldStars(records);
  return { kind: 'map', label: got < max ? `World 0 cleared · ${max - got} stars still out there` : 'World 0 cleared · every star' };
}

/** The dotted boot-log line: "> MNA solver ............... ok". */
export function bootLine(label: string, width = 26): string {
  const dots = Math.max(3, width - label.length);
  return `> ${label} ${'.'.repeat(dots)}`;
}
