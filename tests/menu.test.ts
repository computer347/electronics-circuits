import { describe, expect, it } from 'vitest';
import { MENU, bootLine, continueTarget, worldStars } from '../src/app/menu';
import { TOPICS } from '../src/drills/generators';
import { WORLD0 } from '../src/levels';
import type { LevelRecord } from '../src/levels/progress';

const rec = (stars: 1 | 2 | 3): LevelRecord => ({ stars, seconds: 60, firstPassed: '2026-09-29T00:00:00Z' });
const byNumber = (n: number) => WORLD0.find((l) => l.number === n)!;

describe('title screen menu', () => {
  it('lists the five modes on keys 1–5, with Learn marked as coming soon', () => {
    expect(MENU.map((m) => m.key)).toEqual(['1', '2', '3', '4', '5']);
    expect(MENU.map((m) => m.title)).toEqual(['Play', 'Learn', 'Drills', 'Sandbox', 'Solver bench']);
    expect(MENU.filter((m) => m.soon).map((m) => m.tab)).toEqual(['learn']);
  });

  it('counts drill topics from the generators rather than a hard-coded number', () => {
    expect(MENU.find((m) => m.tab === 'drills')!.sub).toContain(`${TOPICS.length} topics`);
  });

  it('starts a fresh save on level 1', () => {
    const t = continueTarget({});
    expect(t).toMatchObject({ kind: 'level', levelId: byNumber(1).id, fresh: true });
    if (t.kind === 'level') expect(t.label).toBe('0–1 First light');
  });

  it('continues at the first level not yet passed', () => {
    const records = { [byNumber(1).id]: rec(3), [byNumber(2).id]: rec(2), [byNumber(3).id]: rec(1) };
    const t = continueTarget(records);
    expect(t).toMatchObject({ kind: 'level', levelId: byNumber(4).id, fresh: false, label: '0–4 Split the difference' });
  });

  it('goes to the map once every level is passed, and says how many stars are left', () => {
    const records = Object.fromEntries(WORLD0.map((l) => [l.id, rec(2)]));
    const t = continueTarget(records);
    expect(t.kind).toBe('map');
    expect(t.label).toContain(`${WORLD0.length} stars still out there`);
    const all = Object.fromEntries(WORLD0.map((l) => [l.id, rec(3)]));
    expect(continueTarget(all).label).toBe('World 0 cleared · every star');
  });

  it('adds up World 0 stars out of 15', () => {
    expect(worldStars({})).toEqual({ got: 0, max: 15 });
    expect(worldStars({ [byNumber(1).id]: rec(3), [byNumber(4).id]: rec(2) })).toEqual({ got: 5, max: 15 });
  });

  it('pads boot-log labels with dots so the values line up', () => {
    const a = bootLine('power on'), b = bootLine('world 0 · foundations');
    expect(a.length).toBe(b.length);
    expect(a.startsWith('> power on .')).toBe(true);
  });
});
