import { describe, expect, it } from 'vitest';
import { contributions, DIODE_KEY, parseNetlist, solve } from '../src/sim';

const sumOf = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe('superposition breakdown', () => {
  it('two batteries: each source contribution matches the textbook answer and they sum to the total', () => {
    // V1 = 10 V and V2 = 5 V feeding a shared 1k load through 1k each.
    const c = parseNetlist(`
      V1 a 0 10
      R1 a m 1k
      V2 b 0 5
      R2 b m 1k
      R3 m 0 1k
    `);
    const full = solve(c);
    const k = contributions(c, full)!;
    expect(k.keys).toEqual(['V1', 'V2']);
    // V1 alone: 10 V into 1k + (1k || 1k) -> V(m) = 10 * 500/1500 = 3.333 V
    expect(k.voltages.m!.V1).toBeCloseTo(10 / 3, 6);
    expect(k.voltages.m!.V2).toBeCloseTo(5 / 3, 6);
    expect(sumOf(k.voltages.m!)).toBeCloseTo(full.nodeVoltages.m!, 9);
    for (const id of ['R1', 'R2', 'R3', 'V1', 'V2']) {
      expect(sumOf(k.currents[id]!)).toBeCloseTo(full.currents[id]!, 9);
    }
  });

  it('LED circuit: supply share plus diode-drop share equals the real LED current', () => {
    const c = parseNetlist(`
      V1 vcc 0 9
      R1 vcc a 330
      LED1 a 0 red
    `);
    const full = solve(c);
    const k = contributions(c, full)!;
    expect(k.keys).toEqual(['V1', DIODE_KEY]);
    expect(k.currents.LED1!.V1).toBeCloseTo(9 / 330, 5);
    expect(k.currents.LED1![DIODE_KEY]).toBeCloseTo(-2 / 330, 5);
    expect(sumOf(k.currents.LED1!)).toBeCloseTo(full.currents.LED1!, 9);
  });

  it('current source contributions work too', () => {
    const c = parseNetlist(`
      I1 0 a 1m
      V1 b 0 3
      R1 a b 1k
      R2 a 0 1k
    `);
    const full = solve(c);
    const k = contributions(c, full)!;
    expect(k.voltages.a!.I1).toBeCloseTo(0.5, 6);  // 1 mA into 1k || 1k
    expect(k.voltages.a!.V1).toBeCloseTo(1.5, 6);  // divider from 3 V
    expect(sumOf(k.voltages.a!)).toBeCloseTo(full.nodeVoltages.a!, 9);
  });

  it('returns null for a circuit that failed to solve', () => {
    const c = parseNetlist('V1 a 0 9\nW1 a 0');
    expect(contributions(c, solve(c))).toBeNull();
  });
});
