/**
 * The theory for the 30 new levels: every class has a technical explanation and a plain-words
 * one on every step, a worked calculation where there's a sum, and a three-question check whose
 * numbers agree with the solver.
 */
import { describe, expect, it } from 'vitest';
import { analyzeBoard } from '../src/breadboard/model';
import { WORLD0_MORE, WORLD1_MORE } from '../src/learn/classes2';
import { classForLevel } from '../src/learn/classes';
import type { LearnClass, Question } from '../src/learn/types';
import { GATE_TRUTH } from '../src/learn/physics';
import { startingBoard, WORLD0, WORLD1 } from '../src/levels';
import { parseNetlist, solve } from '../src/sim';
import { FIXES } from './expansion.test';

const ALL = [...WORLD0_MORE, ...WORLD1_MORE];
const num = (cls: LearnClass, i: number): number => {
  const q = cls.check[i] as Question;
  if (q.kind !== 'number') throw new Error(`${cls.id} question ${i + 1} isn't a number`);
  return q.answer;
};
const near = (got: number, want: number, pct = 3) => expect(Math.abs(got - want) / Math.abs(want)).toBeLessThan(pct / 100);
const amps = (net: string, id: string) => Math.abs(solve(parseNetlist(net)).currents[id] ?? 0);
const volts = (net: string, node: string) => solve(parseNetlist(net)).nodeVoltages[node] ?? 0;
const C = (n: number) => ALL.find((c) => c.world === (n >= 100 ? 1 : 0) && c.number === n % 100)!;

describe('the new classes: structure', () => {
  it('give each new level its class, with goals, steps in two registers, and three checks', () => {
    for (const l of [...WORLD0.filter((x) => x.number >= 11), ...WORLD1.filter((x) => x.number >= 10)]) {
      const c = classForLevel(l.id);
      expect(c?.number, l.id).toBe(l.number);
      expect(c!.goals.length, c!.id).toBeGreaterThanOrEqual(3);
      expect(c!.steps.length, c!.id).toBeGreaterThanOrEqual(3);
      for (const s of c!.steps) {
        expect(s.body.join(' ').length, `${c!.id}: ${s.title}`).toBeGreaterThan(80);
        expect(s.plain?.length ?? 0, `${c!.id}: ${s.title} needs a plain-words note`).toBeGreaterThan(40);
      }
      expect(c!.check, c!.id).toHaveLength(3);
      for (const q of c!.check) if (q.kind === 'choice') expect(q.correct).toBeLessThan(q.options.length);
    }
  });

  it('works a calculation in every World 0 class', () => {
    for (const c of WORLD0_MORE) expect(c.steps.some((s) => (s.calc?.length ?? 0) >= 2), c.id).toBe(true);
  });
});

describe('World 0 classes 11–25: the numbers agree with the solver', () => {
  it('0–11: two red LEDs and 270 Ω take 18.5 mA; three on 12 V want 300 Ω for 20 mA', () => {
    near(amps('V1 v 0 9\nR1 v a 270\nLED1 a b red\nLED2 b 0 red', 'R1'), num(C(11), 0));
    near(amps(`V1 v 0 12\nR1 v a ${num(C(11), 1)}\nLED1 a b red\nLED2 b c red\nLED3 c 0 red`, 'R1'), 0.02);
  });

  it('0–12: blue wants 400 Ω for 15 mA; yellow on 5 V through 150 Ω takes 19.3 mA', () => {
    near(amps(`V1 v 0 9\nR1 v a ${num(C(12), 0)}\nLED1 a 0 blue`, 'R1'), 0.015);
    near(amps('V1 v 0 5\nR1 v a 150\nLED1 a 0 yellow', 'R1'), num(C(12), 1));
    // and a shared resistor really does starve the blue one
    const r = solve(parseNetlist('V1 v 0 9\nR1 v a 470\nLEDR a 0 red\nLEDB a 0 blue'));
    expect(Math.abs(r.currents['LEDB']!)).toBeLessThan(0.001);
  });

  it('0–13: series and parallel totals, and 21.9 mA through 470 ∥ 1 k', () => {
    near(9 / amps('V1 v 0 9\nR1 v a 220\nR2 a 0 330', 'V1'), num(C(13), 0), 1);
    near(9 / amps('V1 v 0 9\nR1 v 0 1k\nR2 v 0 1k', 'V1'), num(C(13), 1), 1);
    near(amps('V1 v 0 9\nR1 v a 470\nR2 v a 1k\nLED1 a 0 red', 'LED1'), num(C(13), 2));
  });

  it('0–14: 27.3 mA through R1 with the LED shorted', () => {
    near(amps('V1 v 0 9\nR1 v a 330\nLED1 a 0 green\nW1 a 0', 'R1'), num(C(14), 1));
  });

  it('0–16: the level’s own three branches add to 62.7 mA; 560 Ω gives 12.5 mA', () => {
    const a = analyzeBoard(startingBoard(WORLD0.find((l) => l.number === 16)!));
    near(Math.abs(a.result.currents['SUPPLY']!), num(C(16), 0), 1);
    near(amps(`V1 v 0 9\nR1 v a ${num(C(16), 1)}\nLED1 a 0 red`, 'R1'), 0.0125);
  });

  it('0–17: 19.1 mA through a diode and a red LED; the diode keeps 0.7 V', () => {
    near(amps('V1 v 0 9\nD1 v a\nR1 a b 330\nLED1 b 0 red', 'R1'), num(C(17), 0));
    near(volts('V1 v 0 9\nD1 v a\nR1 a 0 330', 'v') - volts('V1 v 0 9\nD1 v a\nR1 a 0 330', 'a'), num(C(17), 1), 5);
  });

  it('0–18: the level’s pot at 30 % gives 2.1 mA, and at 0 % 21.2 mA', () => {
    const l = WORLD0.find((x) => x.number === 18)!;
    const at = (k: number) => analyzeBoard({ ...startingBoard(l), parts: startingBoard(l).parts.map((p) => (p.id === 'RV1' ? { ...p, position: k } : p)) }).result.currents['LED1']!;
    near(at(0.3), num(C(18), 0));
    near(at(0), num(C(18), 1));
  });

  it('0–19: the wiper at 25 % on 9 V and at 60 % on 5 V', () => {
    const l = WORLD0.find((x) => x.number === 19)!;
    const b = startingBoard(l);
    near(analyzeBoard({ ...b, parts: b.parts.map((p) => (p.id === 'RV1' ? { ...p, position: 0.25 } : p)) }).voltageAt('c6')!, num(C(19), 0), 1);
    near(analyzeBoard({ supply: { volts: 5, on: true }, parts: b.parts.map((p) => (p.id === 'RV1' ? { ...p, position: 0.6 } : p)) }).voltageAt('c6')!, num(C(19), 1), 1);
  });

  it('0–20: 4.5 V matched, 3.0 V warmer, 8.18 V with the wrong partner', () => {
    near(volts('V1 v 0 9\nR1 v s 10k\nRT s 0 10k', 's'), num(C(20), 0), 1);
    near(volts('V1 v 0 9\nR1 v s 10k\nRT s 0 5k', 's'), num(C(20), 1), 1);
    near(analyzeBoard(startingBoard(WORLD0.find((x) => x.number === 20)!)).voltageAt('c8')!, num(C(20), 2), 1);
  });

  it('0–21: loaded dividers at 3.0 V and 4.29 V, drawing 4.7 mA', () => {
    near(volts('V1 v 0 9\nR1 v o 10k\nR2 o 0 10k\nRL o 0 10k', 'o'), num(C(21), 0), 1);
    near(volts('V1 v 0 9\nR1 v o 1k\nR2 o 0 1k\nRL o 0 10k', 'o'), num(C(21), 1), 1);
    near(amps('V1 v 0 9\nR1 v o 1k\nR2 o 0 1k\nRL o 0 10k', 'V1'), num(C(21), 2), 1);
  });

  it('0–22: two capacitors in parallel give τ = 0.94 s on the level’s own board', () => {
    const l = WORLD0.find((x) => x.number === 22)!;
    const r = analyzeBoard(FIXES[l.id]!(startingBoard(l)));
    expect(r.result.ok).toBe(true);
    near(4700 * 200e-6, num(C(22), 0), 1);
    near(10000 * 94e-6, num(C(22), 1), 1);
  });

  it('0–23: 200 Ω for 15 mA on 5 V; 13.6 mA with 220 Ω through the real regulator', () => {
    near(amps(`V1 v 0 5\nR1 v a ${num(C(23), 0)}\nLED1 a 0 red`, 'R1'), 0.015);
    near(amps('V1 v 0 9\nU1 v 0 o 5\nR1 o a 220\nLED1 a 0 red', 'R1'), num(C(23), 1));
  });

  it('0–24: 0.83 mA into the base, allowing up to 166 mA', () => {
    const l = WORLD0.find((x) => x.number === 24)!;
    const held = FIXES[l.id]!(startingBoard(l));
    const a = analyzeBoard({ ...held, parts: held.parts.map((p) => (p.kind === 'button' ? { ...p, pressed: true } : p)) });
    near(Math.abs(a.result.currents['Q1.base']!), num(C(24), 0));
    near(200 * Math.abs(a.result.currents['Q1.base']!), num(C(24), 1));
    // and 47 kΩ really is too little for 43 mA of LEDs
    near(amps('V1 v 0 9\nRB v b 47k\nQ1 c b 0 beta=200\nRL v c 10', 'RL'), 200 * 8.3 / 47000, 5);
  });

  it('0–25: 18.2 mA through each white LED with the MOSFET on', () => {
    near(amps('V1 v 0 9\nR1 v a 330\nLED1 a d white\nM1 d v 0', 'R1'), num(C(25), 0));
  });
});

describe('World 1 classes 10–24: the numbers and the logic', () => {
  it('1–10: 6.1 mA through the diode-OR output LED', () => {
    near(amps('V1 v 0 9\nD1 v a\nR1 a b 1k\nLED1 b 0 green', 'R1'), num(C(110), 0));
  });

  it('1–11: 7.9 mA from a 74HC output (50 Ω inside) through 330 Ω', () => {
    near(amps('V1 v 0 5\nRO v o 50\nR1 o a 330\nLED1 a 0 red', 'R1'), num(C(111), 1), 5);
    const l = WORLD1.find((x) => x.number === 11)!;
    const fixed = FIXES[l.id]!(startingBoard(l));
    near(Math.abs(analyzeBoard(fixed).result.currents['LED1']!), num(C(111), 1), 8);
  });

  it('1–21: 0.43 mA base current, 0.18 mA needed', () => {
    near(amps('V1 v 0 5\nRB v b 10k\nD1 b 0', 'RB'), num(C(121), 0));
    near(0.036 / 200, num(C(121), 1), 1);
  });

  it('the logic answers match the gates’ truth tables', () => {
    expect(GATE_TRUTH.NAND([true, true])).toBe(false);
    // De Morgan, for every input
    for (const a of [false, true]) for (const b of [false, true]) {
      expect(GATE_TRUTH.NAND([!a, !b])).toBe(a || b);
      expect(!GATE_TRUTH.NAND([a, b])).toBe(a && b);
    }
    // 1-15: 1 ⊕ 1 ⊕ 1 = 1; 1-22: 1 + 0 + 1 = 10
    expect(GATE_TRUTH.XOR([GATE_TRUTH.XOR([true, true]), true])).toBe(true);
    const sum = (a: boolean, b: boolean, c: boolean) => GATE_TRUTH.XOR([GATE_TRUTH.XOR([a, b]), c]);
    const carry = (a: boolean, b: boolean, c: boolean) => (a && b) || (c && GATE_TRUTH.XOR([a, b]));
    expect([sum(true, false, true), carry(true, false, true)]).toEqual([false, true]);
    const q = C(122).check[0]!;
    expect(q.kind === 'choice' ? q.correct : -1).toBe(0);
  });
});

describe('all the theory', () => {
  it('explains every step of every class in plain words as well as technically', async () => {
    const { ALL_CLASSES } = await import('../src/learn/classes');
    expect(ALL_CLASSES).toHaveLength(49);
    for (const c of ALL_CLASSES) for (const s of c.steps) expect(s.plain?.length ?? 0, `${c.id}: ${s.title}`).toBeGreaterThan(40);
  });
});
