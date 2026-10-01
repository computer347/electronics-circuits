/**
 * Logic gates in the solver: the output switches to VCC or GND through 50 Ω, the chip only
 * works when its supply pins are powered, inputs read high above half the supply, and gates
 * can drive LEDs and each other.
 */
import { describe, expect, it } from 'vitest';
import { gateLogic, solve, type Component, type GateFn } from '../src/sim';

const V = (id: string, a: string, volts: number): Component => ({ kind: 'vsource', id, a, b: '0', volts });
const R = (id: string, a: string, b: string, ohms: number): Component => ({ kind: 'resistor', id, a, b, ohms });
const gate = (id: string, fn: GateFn, out: string, inputs: string[], vcc = 'vcc'): Component => ({ kind: 'gate', id, fn, a: out, b: '0', vcc, inputs });

/** A gate powered from 5 V with its inputs tied to 0 or 5 V, output into a 10 kΩ load. */
function out(fn: GateFn, ins: boolean[]) {
  const comps: Component[] = [V('VCC', 'vcc', 5), ...ins.map((x, i) => V(`IN${i}`, `in${i}`, x ? 5 : 0)), gate('G', fn, 'o', ins.map((_, i) => `in${i}`)), R('L', 'o', '0', 10000)];
  return solve({ components: comps }).nodeVoltages['o']!;
}

describe('logic gates', () => {
  it('give each function’s truth table, with outputs near 5 V or 0 V', () => {
    for (const fn of ['NAND', 'AND', 'OR', 'NOR', 'XOR'] as GateFn[]) {
      for (let i = 0; i < 4; i++) {
        const ins = [!!(i & 1), !!(i & 2)];
        const v = out(fn, ins);
        if (gateLogic(fn, ins)) expect(v, `${fn} ${ins}`).toBeGreaterThan(4.9); else expect(v, `${fn} ${ins}`).toBeLessThan(0.1);
      }
    }
    expect(out('NOT', [false])).toBeGreaterThan(4.9);
    expect(out('NOT', [true])).toBeLessThan(0.1);
  });

  it('does nothing without power on its VCC pin', () => {
    const r = solve({ components: [V('IN', 'in', 5), gate('G', 'NOT', 'o', ['in'], 'vccOpen'), R('L', 'o', '0', 1000), R('P', 'vccOpen', '0', 1e6)] });
    expect(r.activeStates['G']).toBe('dead');
    expect(Math.abs(r.nodeVoltages['o'] ?? 0)).toBeLessThan(1e-3);
  });

  it('reads an unconnected input as low (it floats to ground here)', () => {
    const r = solve({ components: [V('VCC', 'vcc', 5), gate('G', 'NOT', 'o', ['nothing']), R('L', 'o', '0', 10000)] });
    expect(r.nodeVoltages['o']!).toBeGreaterThan(4.9);
  });

  it('lights an LED from a high output (sourcing) and from a low one (sinking)', () => {
    const src = solve({ components: [V('VCC', 'vcc', 5), gate('G', 'NOT', 'o', ['0']), R('R1', 'o', 'a', 330), { kind: 'diode', id: 'LED', a: 'a', b: '0', vf: 1.8 }] });
    expect(src.currents['LED']! * 1000).toBeCloseTo((5 - 1.8) / 380 * 1000, 0);
    expect(src.currents['G']!).toBeCloseTo(src.currents['LED']!, 4);
    const sink = solve({ components: [V('VCC', 'vcc', 5), V('IN', 'in', 5), gate('G', 'NOT', 'o', ['in']), R('R1', 'vcc', 'a', 330), { kind: 'diode', id: 'LED', a: 'a', b: 'o', vf: 1.8 }] });
    expect(sink.currents['LED']! * 1000).toBeGreaterThan(8);
    expect(sink.currents['G']!).toBeLessThan(0);
  });

  it('chains: two NANDs as AND (a NAND, then a NAND with its inputs tied)', () => {
    for (let i = 0; i < 4; i++) {
      const a = !!(i & 1), b = !!(i & 2);
      const r = solve({ components: [V('VCC', 'vcc', 5), V('A', 'a', a ? 5 : 0), V('B', 'b', b ? 5 : 0), gate('G1', 'NAND', 'n', ['a', 'b']), gate('G2', 'NAND', 'o', ['n', 'n']), R('L', 'o', '0', 10000)] });
      expect(r.nodeVoltages['o']! > 2.5, `${a}${b}`).toBe(a && b);
    }
  });
});
