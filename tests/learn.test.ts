import { describe, expect, it } from 'vitest';
import { gradeNumber } from '../src/drills/check';
import { WORLD0_CLASSES, classForLevel } from '../src/learn/classes';
import { dividerLab, dividerOut, ledLab, ledResistor, ohmLab, pairLab, rcLab } from '../src/learn/physics';
import type { LabSpec } from '../src/learn/types';
import { WORLD0, levelById } from '../src/levels';
import { parseNetlist, solve } from '../src/sim';

const near = (got: number, want: number, pct = 1) => expect(Math.abs(got - want)).toBeLessThanOrEqual(Math.abs(want) * pct / 100);
const byNumber = (n: number) => WORLD0_CLASSES.find((c) => c.number === n)!;

describe('World 0 classes: structure', () => {
  it('has one class per World 0 level, numbered like the level it prepares for', () => {
    expect(WORLD0_CLASSES).toHaveLength(WORLD0.length);
    for (const c of WORLD0_CLASSES) {
      const level = levelById(c.levelId);
      expect(level, c.id).toBeDefined();
      expect(level!.number).toBe(c.number);
      expect(classForLevel(c.levelId)).toBe(c);
    }
    expect(new Set(WORLD0_CLASSES.map((c) => c.id)).size).toBe(WORLD0_CLASSES.length);
  });

  it('gives every class steps, goals and a three-question check with valid answers', () => {
    for (const c of WORLD0_CLASSES) {
      expect(c.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.goals.length).toBeGreaterThan(0);
      expect(c.check).toHaveLength(3);
      for (const q of c.check) {
        if (q.kind === 'choice') expect(q.correct).toBeLessThan(q.options.length);
        else expect(gradeNumber(q.answer, q.tolerancePct, String(q.answer)).kind).toBe('correct');
      }
    }
  });

  it('builds and solves every lab preset', () => {
    const run = (s: LabSpec) => {
      switch (s.kind) {
        case 'ohm': return ohmLab(s.volts ?? 9, s.ohms ?? 1000);
        case 'led': return ledLab(s.volts ?? 9, s.ohms ?? 330, s.reversed);
        case 'pair': return pairLab(9, s.ohms ?? 330, s.mode ?? 'series');
        case 'divider': return dividerLab(9, s.rTop ?? 1000, s.rBottom ?? 1000);
        case 'rc': return rcLab(9, s.ohms ?? 10000, s.farads ?? 100e-6, s.bleed ? 100000 : undefined);
      }
    };
    for (const c of WORLD0_CLASSES) for (const s of c.steps) if (s.lab) expect(() => run(s.lab!)).not.toThrow();
  });
});

describe('World 0 classes: the numbers they teach agree with the solver', () => {
  it('0–1: Ohm, LED resistor sizing and burning', () => {
    near(ohmLab(9, 330).amps, 0.0273);
    near(ohmLab(9, 330).watts, 0.245, 2);
    near(ohmLab(9, 1000).amps, 0.009);
    near(ledResistor(9, 0.02), 350);
    near(ledLab(9, 330).amps, 0.0212);
    near(ledLab(9, 390).amps, 0.0179);
    expect(ledLab(9, 330).state).toBe('lit');
    expect(ledLab(9, 100).state).toBe('burnt');
    near(ledLab(9, 100).amps, 0.07);
    const [q1, q2] = byNumber(1).check;
    if (q1!.kind !== 'number' || q2!.kind !== 'number') throw new Error('expected number questions');
    near(ledLab(12, q1!.answer).amps, 0.02);
    near(ledLab(9, 470).amps, q2!.answer);
  });

  it('0–2: what the meter shows on a lit and a reversed LED', () => {
    const fwd = ledLab(5, 150);
    near(fwd.amps, 0.02);
    near(fwd.vAnodeSide, 2.0);
    expect(Math.abs(fwd.vGroundSide)).toBeLessThan(1e-3);
    const rev = ledLab(5, 150, true);
    expect(rev.amps).toBeLessThan(1e-6);
    near(rev.vAnodeSide, 5);
    expect(Math.abs(rev.vGroundSide)).toBeLessThan(1e-3);
    expect(rev.state).toBe('off');
    const q = byNumber(2).check[0]!;
    if (q.kind !== 'choice') throw new Error('expected choice');
    expect(q.options[q.correct]).toBe('5.0 V');
  });

  it('0–3: series shares a current, parallel adds currents', () => {
    const s = pairLab(9, 330, 'series');
    near(s.led1, 5 / 330, 2);
    near(s.led2, s.led1, 0.1);
    near(s.supply, s.led1, 0.1);
    near(s.vResistor, 5, 2);
    const p = pairLab(9, 470, 'parallel');
    near(p.supply, p.led1 + p.led2, 0.5);
    expect(p.supply).toBeGreaterThan(0.02); // parallel blows the level 0–3 budget
    const q = byNumber(3).check[0]!;
    if (q.kind !== 'number') throw new Error('expected number');
    near(s.led1, q.answer, 2);
  });

  it('0–4: divider outputs and currents', () => {
    near(dividerLab(9, 1000, 1000).vOut, 4.5);
    near(dividerLab(9, 2000, 1000).vOut, 3);
    near(dividerLab(9, 20000, 10000).vOut, 3);
    near(dividerLab(9, 2200, 1000).amps, 0.0028, 1);
    const good = dividerLab(9, 6800, 3300);
    near(good.vOut, 2.94, 1);
    near(good.amps, 0.00089, 1);
    near(dividerLab(9, 3300, 6800).vOut, 6.06, 1); // swapped
    const [q1, q2] = byNumber(4).check;
    if (q1!.kind !== 'number' || q2!.kind !== 'number') throw new Error('expected number questions');
    near(dividerLab(9, 10000, 4700).vOut, q1!.answer);
    near(dividerOut(9, 10000, 4700), q1!.answer);
    near(dividerLab(9, 10000, 4700).amps, q2!.answer);
  });

  it('0–5: the transient run crosses 63 % at τ, with and without the bleed resistor', () => {
    const plain = rcLab(9, 10000, 100e-6);
    near(plain.tau, 1);
    near(plain.t63, 1, 2);
    const bled = rcLab(9, 10000, 100e-6, 100000);
    near(bled.vFinal, 8.18, 1);
    near(bled.tau, 0.909, 1);
    near(bled.t63, 0.909, 2);
    expect(bled.t63).toBeGreaterThan(0.8);
    expect(bled.t63).toBeLessThan(1.2);
    const [q1, q2] = byNumber(5).check;
    if (q1!.kind !== 'number' || q2!.kind !== 'number') throw new Error('expected number questions');
    near(rcLab(9, 47000, 22e-6).t63, q1!.answer, 2);
    near(rcLab(9, q2!.answer, 100e-6).t63, 0.5, 2);
    // After 3τ it's about 95 % full.
    const at3 = plain.curve.find(([t]) => t >= 3 * plain.tau)!;
    near(at3[1] / 9, 0.95, 1.5);
  });
});

describe('World 0 classes 6–9: the numbers they teach agree with the solver', () => {
  const solveNet = (text: string) => solve(parseNetlist(text));
  const num = (n: number, i: number) => { const q = byNumber(n).check[i]!; if (q.kind !== 'number') throw new Error('expected a number question'); return q.answer; };

  it('0–6: parallel branches add at the junction', () => {
    const r = solveNet('V1 vcc 0 9\nR1 vcc a 330\nLED1 a 0 red\nR2 vcc b 330\nLED2 b 0 green');
    near(r.currents.LED1!, 0.0212);
    near(r.currents.LED2!, 0.0206);
    near(Math.abs(r.currents.V1!), 0.0418);
    const slow = solveNet('V1 vcc 0 9\nR2 vcc b 3300\nLED2 b 0 green');
    near(slow.currents.LED2!, 0.00206);
    near(slow.nodeVoltages.vcc! - slow.nodeVoltages.b!, 6.8);
    near(num(6, 0), 0.012 + 0.018);
    near(solveNet('V1 a 0 5\nR1 a 0 1000').currents.R1!, num(6, 1));
  });

  it('0–7: the held current, and nothing with the switch open', () => {
    near(solveNet('V1 vcc 0 9\nS1 vcc a closed\nR1 a b 330\nLED1 b 0 red').currents.LED1!, num(7, 1));
    near(num(7, 1), 0.0212);
    expect(Math.abs(solveNet('V1 vcc 0 9\nS1 vcc a open\nR1 a b 330\nLED1 b 0 red').currents.LED1 ?? 0)).toBeLessThan(1e-6);
  });

  it('0–8: cells stack, a backwards one cancels, and 15 mA once fixed', () => {
    const good = solveNet('V1 a 0 1.5\nV2 b a 1.5\nV3 c b 1.5\nR1 c d 100\nLED1 d 0 blue');
    near(good.nodeVoltages.c!, 4.5);
    near(good.currents.LED1!, 0.015);
    const bad = solveNet('V1 a 0 1.5\nV2 a b 1.5\nV3 c b 1.5\nR1 c d 100\nLED1 d 0 blue');
    near(bad.nodeVoltages.c!, num(8, 1));
    expect(Math.abs(bad.currents.LED1 ?? 0)).toBeLessThan(1e-6);
    near(solveNet('V1 a 0 1.5\nV2 b a 1.5\nV3 c b 1.5\nV4 d c 1.5\nR1 d 0 1000').nodeVoltages.d!, num(8, 0));
  });

  it('0–9: both taps at 6.19 V when the ratios match', () => {
    const r = solveNet('V1 vcc 0 9\nR1 vcc a 1000\nR2 a 0 2200\nR3 vcc b 10000\nR4 b 0 22000');
    near(r.nodeVoltages.a!, 6.19);
    expect(Math.abs(r.nodeVoltages.a! - r.nodeVoltages.b!)).toBeLessThan(1e-6);
    near(dividerOut(9, 1000, 1000), num(9, 0));
    const b = solveNet(`V1 vcc 0 9\nR1 vcc a 2000\nR2 a 0 6000\nR3 vcc b 5000\nR4 b 0 ${num(9, 1)}`);
    expect(Math.abs(b.nodeVoltages.a! - b.nodeVoltages.b!)).toBeLessThan(1e-6);
  });
  it('0–10: 0.83 mA into the base, saturated at about 14.5 mA; 1 MΩ starves it', () => {
    const on = solveNet('V1 vcc 0 9\nRB vcc b 10000\nQ1 c b 0 beta=200\nR2 vcc a 470\nLED1 a c green');
    near(on.currents['Q1.base']!, 0.00083, 2);
    near(on.currents.LED1!, 0.0145, 4);
    expect(on.nodeVoltages.c!).toBeLessThan(0.25);
    const dim = solveNet('V1 vcc 0 9\nRB vcc b 1000000\nQ1 c b 0 beta=200\nR2 vcc a 470\nLED1 a c green');
    near(dim.currents.LED1!, 0.00166, 3);
    const pin = solveNet('V1 p 0 5\nRB p b 10000\nQ1 c b 0 beta=200\nR2 p c 1000');
    near(pin.currents['Q1.base']!, num(10, 0), 3);
    near(200 * 0.0001, num(10, 1));
  });
});
