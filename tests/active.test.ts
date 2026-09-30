import { describe, expect, it } from 'vitest';
import { parseNetlist, solve } from '../src/sim';

const run = (text: string) => { const r = solve(parseNetlist(text)); expect(r.ok, JSON.stringify(r.faults)).toBe(true); return r; };
const near = (got: number, want: number, tol = 1e-3) => expect(Math.abs(got - want)).toBeLessThan(tol);

describe('NPN transistor', () => {
  it('stays off with no base drive: the LED on its collector is dark', () => {
    const r = run('V1 vcc 0 9\nR1 vcc c 330\nLED1 c k red\nW1 k col\nQ1 col b 0\nRB b 0 10k');
    expect(r.activeStates.Q1).toBe('off');
    near(r.currents.LED1 ?? 0, 0, 1e-6);
  });

  it('saturates with a strong base drive: the LED lights at (9 − 2 − 0.2) / 330', () => {
    const r = run('V1 vcc 0 9\nR1 vcc c 330\nLED1 c col red\nQ1 col b 0\nRB vcc b 10k');
    expect(r.activeStates.Q1).toBe('sat');
    near(r.currents.LED1!, (9 - 2 - 0.2) / 330, 1e-4);
    near(r.currents['Q1.base']!, (9 - 0.7) / 10000, 1e-5);
  });

  it('works in the active region with a weak base drive: Ic = beta × Ib', () => {
    // Ib = (9 − 0.7) / 1 MΩ = 8.3 µA, so Ic = 830 µA: well below what 330 Ω would allow.
    const r = run('V1 vcc 0 9\nR1 vcc col 330\nQ1 col b 0 beta=100\nRB vcc b 1meg');
    expect(r.activeStates.Q1).toBe('active');
    near(r.currents.Q1!, 100 * (9 - 0.7) / 1e6, 2e-6);
  });
});

describe('MOSFET', () => {
  it('switches on above its threshold and off below', () => {
    const on = run('V1 vcc 0 5\nR1 vcc d 100\nM1 d g 0 vth=2 ron=0.05\nVG g 0 5');
    expect(on.activeStates.M1).toBe('on');
    near(on.currents.M1!, 5 / 100.05, 1e-4);
    const off = run('V1 vcc 0 5\nR1 vcc d 100\nM1 d g 0 vth=2\nVG g 0 1');
    expect(off.activeStates.M1).toBe('off');
    near(off.nodeVoltages.d!, 5, 1e-3);
  });
});

describe('regulator', () => {
  it('holds 5 V out of 9 V in, taking the load current from its input', () => {
    const r = run('V1 vin 0 9\nU1 vin 0 out 5\nRL out 0 100');
    expect(r.activeStates.U1).toBe('reg');
    near(r.nodeVoltages.out!, 5);
    near(Math.abs(r.currents.V1!), 0.05, 1e-4);
    // It burns the difference: (9 − 5) × 50 mA = 0.2 W.
    near(r.power.U1!, 0.2, 1e-3);
  });

  it('drops out when the input is too low: out = in − dropout', () => {
    const r = run('V1 vin 0 6\nU1 vin 0 out 5 dropout=2\nRL out 0 100');
    expect(r.activeStates.U1).toBe('dropout');
    near(r.nodeVoltages.out!, 4);
  });
});
