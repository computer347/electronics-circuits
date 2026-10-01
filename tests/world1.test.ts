/**
 * World 1 against the solver: each logic level passes with the right build and fails, with a
 * useful reason, with the wrong ones. The classes' numbers and the notebook pages too.
 */
import { describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardPart, type BoardState } from '../src/breadboard/model';
import { taskPage } from '../src/desk/taskPages';
import { followingLevel, isUnlocked, nextLevel } from '../src/desk/levelPick';
import { WORLD1_CLASSES, classForLevel } from '../src/learn/classes';
import { checkLevel } from '../src/levels/check';
import { startingBoard, WORLD0, WORLD1 } from '../src/levels';
import { parseNetlist, solve } from '../src/sim';

const L = (n: number) => WORLD1.find((l) => l.number === n)!;
const add = (b: BoardState, ...parts: BoardPart[]): BoardState => ({ ...b, parts: [...b.parts, ...parts] });
const set = (b: BoardState, patch: Record<string, Partial<BoardPart>>): BoardState => ({ ...b, parts: b.parts.map((p) => (patch[p.id] ? { ...p, ...patch[p.id] } : p)) });
const check = (n: number, b: BoardState) => checkLevel(L(n), b, analyzeBoard(b));
const T = (id: string, h1: string, h2: string): BoardPart => ({ id, kind: 'toggle', h1, h2, pressed: false });
const R = (id: string, h1: string, h2: string, ohms: number): BoardPart => ({ id, kind: 'resistor', h1, h2, ohms });
const W = (id: string, h1: string, h2: string): BoardPart => ({ id, kind: 'wire', h1, h2 });

describe('World 1', () => {
  it('has five levels, numbered in order, after World 0', () => {
    expect(WORLD1.map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
    expect(WORLD1.every((l) => l.world === 1)).toBe(true);
  });

  it('opens its first level straight away (nothing is mandatory), the rest in order', () => {
    expect(isUnlocked(1, {}, 1)).toBe(true);
    expect(isUnlocked(2, {}, 1)).toBe(false);
    const rec = { [L(1).id]: { stars: 3 as const, seconds: 20, firstPassed: '2026-10-01' } };
    expect(isUnlocked(2, rec, 1)).toBe(true);
  });

  it('follows World 0’s last level with World 1’s first, and suggests it once World 0 is done', () => {
    const last = WORLD0[WORLD0.length - 1]!;
    expect(followingLevel(last.id, {})).toBe(L(1).id);
    const all0 = Object.fromEntries(WORLD0.map((l) => [l.id, { stars: 1 as const, seconds: 1, firstPassed: 'x' }]));
    expect(nextLevel(all0)).toBe(L(1).id);
  });
});

describe('1-1 Count in lights', () => {
  const b = startingBoard(L(1));
  const thirteen = { S8: { pressed: true }, S4: { pressed: true }, S1: { pressed: true } };
  it('shows 13 once R4 is back to 470 Ω and S8, S4 and S1 are on', () => {
    const fixed = set(b, { ...thirteen, R4: { ohms: 470 } });
    expect(check(1, fixed).pass).toBe(true);
  });
  it('fails with R4 still 47 kΩ (LED4 too dim to count), naming LED4', () => {
    const r = check(1, set(b, thirteen));
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/LED4 should be lit/);
  });
  it('never burns anything, whatever the switches do', () => {
    for (let i = 0; i < 16; i++) {
      const sw = Object.fromEntries(['S1', 'S2', 'S4', 'S8'].map((id, k) => [id, { pressed: !!(i & (1 << k)) }]));
      expect(analyzeBoard(set(b, sw)).newlyBurnt).toEqual([]);
    }
  });
  it('fails showing 15 instead', () => {
    expect(check(1, set(b, { ...thirteen, S2: { pressed: true }, R4: { ohms: 470 } })).pass).toBe(false);
  });
});

describe('1-2 Both (AND)', () => {
  const b = L(2).board;
  it('is AND with a second switch in series', () => {
    expect(check(2, add(b, T('S1', 'b2', 'b5'))).pass).toBe(true);
  });
  it('fails with a wire instead (the LED follows SA alone)', () => {
    const r = check(2, add(b, W('W9', 'b2', 'b5'), T('S1', 'T+:20', 'j30')));
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/should be dark but it's lit/);
  });
  it('asks for a switch when there isn’t one', () => {
    expect(check(2, b).diagnosis?.message).toMatch(/no second switch/);
  });
});

describe('1-3 Either will do (OR)', () => {
  const b = L(3).board;
  it('is OR with a second switch in parallel', () => {
    expect(check(3, add(b, T('S1', 'T+:3', 'b2'))).pass).toBe(true);
  });
  it('is not OR with the second switch in series', () => {
    const series = { ...b, parts: [...b.parts.map((p) => (p.id === 'R1' ? { ...p, h1: 'c4' } : p)), T('S1', 'b2', 'b4')] };
    expect(check(3, series).pass).toBe(false);
  });
});

describe('1-4 Not', () => {
  const b = L(4).board;
  it('inverts with a 1 kΩ pull-up: lit when SA is off, dark when on', () => {
    const ok = add(b, R('R2', 'T+:9', 'a12', 1000));
    expect(check(4, ok).pass).toBe(true);
    const on = analyzeBoard(set(ok, { SA: { pressed: true } }));
    expect(on.voltageAt('a12')!).toBeLessThan(0.3);
    expect(analyzeBoard(ok).result.currents['LED1']! * 1000).toBeCloseTo(7, 0);
  });
  it('is too dim with 10 kΩ, and burns the LED with 100 Ω', () => {
    expect(check(4, add(b, R('R2', 'T+:9', 'a12', 10000))).pass).toBe(false);
    expect(analyzeBoard(add(b, R('R2', 'T+:9', 'a12', 100))).newlyBurnt).toContain('LED1');
  });
});

describe('1-5 Not both (NAND)', () => {
  const b = L(5).board;
  it('is NAND with Q1’s emitter wired to Q2’s collector', () => {
    expect(check(5, add(b, W('W9', 'a8', 'a18'))).pass).toBe(true);
  });
  it('is just NOT A if Q1’s emitter goes straight to ground', () => {
    const r = check(5, add(b, W('W9', 'a8', 'T-:5')));
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/SB off.*should be lit|should be lit/);
  });
});

describe('World 1 notebook and classes', () => {
  it('has a class per level, and a page with a skill and a real-life reason', () => {
    expect(WORLD1_CLASSES).toHaveLength(WORLD1.length);
    for (const l of WORLD1) {
      expect(classForLevel(l.id)?.number).toBe(l.number);
      const p = taskPage(l);
      expect(p.skill.length, l.id).toBeGreaterThan(25);
      expect(p.skill.length, l.id).toBeLessThan(90);
      expect(p.realLife.length, l.id).toBeGreaterThan(60);
      expect(['binary', 'and', 'or', 'not', 'nand']).toContain(p.picture);
    }
  });

  it('teaches the pull-up current the solver gives', () => {
    const r = solve(parseNetlist('V1 vcc 0 9\nR1 vcc a 1000\nLED1 a 0 red'));
    const q = WORLD1_CLASSES[3]!.check[0]!;
    if (q.kind !== 'number') throw new Error('expected a number question');
    expect(Math.abs(r.currents.LED1! - q.answer) / q.answer).toBeLessThan(0.03);
  });
});

describe('the logic labs in World 1’s theory', () => {
  it('light the lamp exactly as each gate’s truth table says, solved from real parts', async () => {
    const { logicLab, GATE_TRUTH, GATE_INPUTS } = await import('../src/learn/physics');
    for (const gate of ['AND', 'OR', 'NOT', 'NAND'] as const) {
      const n = GATE_INPUTS[gate];
      for (let i = 0; i < 1 << n; i++) {
        const ins = Array.from({ length: n }, (_, k) => !!(i & (1 << k)));
        expect(logicLab(gate, ins).lit, `${gate} ${ins.map(Number).join('')}`).toBe(GATE_TRUTH[gate](ins));
      }
    }
  });
});

describe('World 1 inside the circuit', () => {
  it('builds a walkable world for every level, before and after the fix', async () => {
    const { buildWorld } = await import('../src/circuitworld/world');
    const fixes: Record<number, (b: BoardState) => BoardState> = {
      1: (b) => set(b, { S8: { pressed: true }, S4: { pressed: true }, S1: { pressed: true }, R4: { ohms: 470 } }),
      2: (b) => set(add(b, T('S1', 'b2', 'b5')), { SA: { pressed: true }, S1: { pressed: true } }),
      3: (b) => set(add(b, T('S1', 'T+:3', 'b2')), { SA: { pressed: true } }),
      4: (b) => add(b, R('R2', 'T+:9', 'a12', 1000)),
      5: (b) => add(b, W('W9', 'a8', 'a18')),
    };
    for (const l of WORLD1) {
      for (const b of [startingBoard(l), fixes[l.number]!(startingBoard(l))]) {
        const w = buildWorld(b, analyzeBoard(b));
        expect(w.plazas.length, l.id).toBeGreaterThan(0);
      }
    }
  });
});
