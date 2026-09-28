/**
 * Textbook circuits with hand-calculated answers. The solver must match these
 * before anything is built on top of it.
 */
import { describe, expect, it } from 'vitest';
import { parseNetlist, solve, Simulator, type SolveResult } from '../src/sim';

const run = (netlist: string) => solve(parseNetlist(netlist));
const faultKinds = (r: SolveResult) => r.faults.map((f) => f.kind);
/** Relative closeness: within `pct` percent (default 0.01 %). */
const near = (actual: number, expected: number, pct = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * (pct / 100) + 1e-9);

describe('resistive circuits', () => {
  it('voltage divider: 9 V across 1k + 2k gives 6 V and 3 mA', () => {
    const r = run(`
      V1 vcc 0 9
      R1 vcc out 1k
      R2 out 0 2k
    `);
    expect(r.ok).toBe(true);
    near(r.nodeVoltages.out!, 6);
    near(r.currents.R1!, 0.003);
    near(r.currents.V1!, -0.003); // battery delivering power: current flows - to + inside it
    expect(r.faults).toEqual([]);
  });

  it('series-parallel: 12 V, 100 ohm then 200 || 300', () => {
    const r = run(`
      V1 a 0 12
      R1 a m 100
      R2 m 0 200
      R3 m 0 300
    `);
    near(r.currents.R1!, 12 / 220);
    near(r.nodeVoltages.m!, (12 * 120) / 220);
    near(r.currents.R2!, (12 * 120) / 220 / 200);
    near(r.currents.R3!, (12 * 120) / 220 / 300);
  });

  it('current source: 1 mA into 1k gives 1 V', () => {
    const r = run(`
      I1 0 a 1m
      R1 a 0 1k
    `);
    near(r.nodeVoltages.a!, 1);
  });

  it('balanced Wheatstone bridge carries no current through the bridge resistor', () => {
    const r = run(`
      V1 top 0 10
      R1 top l 1k
      R2 top r 1k
      R3 l 0 1k
      R4 r 0 1k
      R5 l r 470
    `);
    expect(Math.abs(r.currents.R5!)).toBeLessThan(1e-9);
    near(r.nodeVoltages.l!, 5);
  });

  it('conserves energy and satisfies KCL', () => {
    const r = run(`
      V1 a 0 5
      R1 a b 220
      R2 b 0 470
      R3 b c 1k
      R4 c 0 1k
    `);
    const total = Object.values(r.power).reduce((s, p) => s + p, 0);
    expect(Math.abs(total)).toBeLessThan(1e-9);
    // KCL at node b: in through R1 = out through R2 + R3
    near(r.currents.R1!, r.currents.R2! + r.currents.R3!);
  });

  it('wires and closed switches connect, open switches break the circuit', () => {
    const closed = run(`
      V1 a 0 5
      W1 a b
      S1 b c closed
      R1 c 0 1k
    `);
    near(closed.currents.R1!, 0.005, 0.1);
    near(closed.currents.W1!, 0.005, 0.1);

    const open = run(`
      V1 a 0 5
      S1 a c open
      R1 c 0 1k
    `);
    expect(Math.abs(open.currents.R1!)).toBeLessThan(1e-9);
  });
});

describe('diodes and LEDs', () => {
  it('red LED with 330 ohm on 9 V: (9 - 2.0) / 330 = 21.2 mA, no fault', () => {
    const r = run(`
      V1 vcc 0 9
      R1 vcc a 330
      LED1 a 0 red
    `);
    expect(r.diodeStates.LED1).toBe('on');
    near(r.currents.LED1!, 7 / 330, 0.1);
    expect(r.faults).toEqual([]);
  });

  it('reversed LED blocks: no current', () => {
    const r = run(`
      V1 vcc 0 3.3
      R1 vcc a 330
      LED1 0 a red
    `);
    expect(r.diodeStates.LED1).toBe('off');
    expect(Math.abs(r.currents.R1!)).toBeLessThan(1e-9);
    expect(r.faults).toEqual([]);
  });

  it('reversed LED on 9 V exceeds its 5 V reverse rating', () => {
    const r = run(`
      V1 vcc 0 9
      R1 vcc a 330
      LED1 0 a red
    `);
    expect(faultKinds(r)).toContain('reverse-overvoltage');
  });

  it('LED with no current-limiting resistor burns out', () => {
    const r = run(`
      V1 vcc 0 5
      LED1 vcc 0 green
    `);
    expect(faultKinds(r)).toContain('overcurrent');
  });

  it('two identical diodes in parallel share the current', () => {
    const r = run(`
      V1 a 0 5
      R1 a b 1k
      D1 b 0
      D2 b 0
    `);
    near(r.currents.R1!, 0.0043, 0.1);
    near(r.currents.D1!, 0.00215, 0.5);
    near(r.currents.D2!, 0.00215, 0.5);
  });

  it('diode blocks a negative supply', () => {
    const r = run(`
      V1 a 0 -5
      D1 a b
      R1 b 0 1k
    `);
    expect(r.diodeStates.D1).toBe('off');
    expect(Math.abs(r.currents.R1!)).toBeLessThan(1e-9);
  });

  it('picks the LED colour forward voltage', () => {
    const r = run(`
      V1 vcc 0 5
      R1 vcc a 1k
      LED1 a 0 blue
    `);
    near(r.currents.R1!, 0.002, 0.1); // (5 - 3.0) / 1k
  });
});

describe('faults', () => {
  it('wire across a battery is a short circuit', () => {
    const r = run(`
      V1 a 0 9
      W1 a 0
      R1 a 0 1k
    `);
    expect(r.ok).toBe(false);
    expect(faultKinds(r)).toContain('short-circuit');
  });

  it('two sources in parallel are a source conflict', () => {
    const r = run(`
      V1 a 0 5
      V2 a 0 3.3
      R1 a 0 1k
    `);
    expect(r.ok).toBe(false);
    expect(faultKinds(r)).toContain('source-conflict');
  });

  it('an unconnected resistor leg is a floating node warning, and the solve still works', () => {
    const r = run(`
      V1 a 0 5
      R1 a 0 1k
      R2 x y 1k
    `);
    expect(r.ok).toBe(true);
    const floating = r.faults.filter((f) => f.kind === 'floating-node').map((f) => f.node);
    expect(floating.sort()).toEqual(['x', 'y']);
    near(r.currents.R1!, 0.005);
  });
});

describe('transient (capacitors)', () => {
  it('RC charging reaches 63.2 % after one time constant', () => {
    // tau = 10k * 100u = 1 s
    const sim = new Simulator(parseNetlist(`
      V1 vcc 0 5
      R1 vcc out 10k
      C1 out 0 100u
    `));
    const samples = sim.run(1, 0.001);
    near(samples.at(-1)!.nodeVoltages.out!, 5 * (1 - Math.exp(-1)), 0.5);
    sim.run(4, 0.001);
    expect(sim.last!.nodeVoltages.out!).toBeGreaterThan(4.95);
  });

  it('RC discharging from an initial voltage halves in tau * ln 2', () => {
    const sim = new Simulator(parseNetlist(`
      R1 out 0 1k
      C1 out 0 1m v0=10
    `));
    sim.run(Math.LN2, 0.0005);
    near(sim.last!.nodeVoltages.out!, 5, 0.5);
  });

  it('capacitor is open in the DC operating point', () => {
    const r = run(`
      V1 vcc 0 5
      R1 vcc out 1k
      C1 out 0 10u
    `);
    near(r.nodeVoltages.out!, 5);
  });
});

describe('numerical robustness', () => {
  it('solves two LEDs in series joined by a wire (a wire-only island while both are off)', () => {
    const r = solve(parseNetlist(`
      V1 vcc 0 9
      R1 vcc a 330
      LED1 a b red
      W1 b c
      LED2 c 0 red
    `));
    expect(r.ok).toBe(true);
    expect(r.currents.LED1).toBeCloseTo(5 / 330, 5);
    expect(r.currents.LED2).toBeCloseTo(5 / 330, 5);
  });
});
