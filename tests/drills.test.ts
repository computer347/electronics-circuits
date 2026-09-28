/**
 * Every generator, many seeds: the solver's answer must match the hand formula shown
 * in the worked solution. This guards both the solver and the drill layouts.
 */
import { describe, expect, it } from 'vitest';
import { checkAnswer, parseAnswer } from '../src/drills/check';
import { GENERATORS, makeDrill } from '../src/drills/generators';
import { Simulator, solve } from '../src/sim';
import { toCircuit } from '../src/schematic/model';

const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);

describe.each(GENERATORS.map((g) => [g.id]))('generator %s', (id) => {
  it('solver answer matches the worked solution for 60 seeds', () => {
    for (const seed of SEEDS) {
      const d = makeDrill(id, seed);
      const rel = Math.abs(d.answer.value - d.expected) / Math.max(Math.abs(d.expected), 1e-12);
      expect(rel, `${id} seed ${seed}`).toBeLessThan(1e-4);
      expect(Number.isFinite(d.answer.value)).toBe(true);
      expect(d.solution.length).toBeGreaterThan(0);
    }
  });

  it('is reproducible from its seed', () => {
    expect(makeDrill(id, 42).answer.value).toBe(makeDrill(id, 42).answer.value);
  });

  it('draws a circuit with no faults', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const r = solve(toCircuit(makeDrill(id, seed).schematic).circuit);
      expect(r.faults.filter((f) => f.severity === 'error'), `${id} seed ${seed}`).toEqual([]);
    }
  });
});

describe('answers that are formulas, checked by simulation', () => {
  it('LED resistor: the computed R really gives the target current', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const d = makeDrill('led-resistor', seed);
      const r = solve(toCircuit(d.schematic).circuit);
      const target = Number(/current of ([\d.]+) mA/.exec(d.prompt)![1]) / 1000;
      expect(Math.abs(r.currents.LED1! - target) / target).toBeLessThan(1e-3);
    }
  });

  it('RC charging: the formula matches a transient simulation', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const d = makeDrill('rc-charge', seed);
      const sim = new Simulator(toCircuit(d.schematic).circuit);
      const part = (id: string) => d.schematic.parts.find((x) => x.id === id)!;
      const r1 = part('R1'), c1 = part('C1'), v1 = part('V1');
      if (r1.kind !== 'resistor' || c1.kind !== 'capacitor' || v1.kind !== 'vsource') throw new Error('layout');
      const tau = r1.ohms * c1.farads;
      const k = -Math.log(1 - d.expected / v1.volts); // t / tau used by the drill
      const steps = 4000;
      sim.run(k * tau, (k * tau) / steps);
      const node = toCircuit(d.schematic).nodeAt([5, 0])!;
      const vc = sim.last!.nodeVoltages[node]!;
      expect(Math.abs(vc - d.expected) / d.expected, `seed ${seed}`).toBeLessThan(0.01);
    }
  });

});

describe('answer checking', () => {
  const d = makeDrill('ohm', 5);
  const v = d.answer.value;

  it('reads prefixes, spaces, units and decimal commas', () => {
    expect(parseAnswer('27.3 mA')).toBeCloseTo(0.0273);
    expect(parseAnswer('4,7k')).toBeCloseTo(4700);
    expect(parseAnswer('')).toBeNull();
    expect(parseAnswer('lots')).toBeNull();
  });

  it('accepts answers within 1 % and rejects others', () => {
    expect(checkAnswer(d, String(v * 1.005)).kind).toBe('correct');
    expect(checkAnswer(d, String(v * 1.05)).kind).toBe('wrong');
  });

  it('hints at prefix and sign mistakes', () => {
    const prefix = checkAnswer(d, String(v * 1000));
    expect(prefix.kind === 'wrong' && prefix.hint).toMatch(/prefix/);
    const sign = checkAnswer(d, String(-v));
    expect(sign.kind === 'wrong' && sign.hint).toMatch(/sign/);
  });
});
