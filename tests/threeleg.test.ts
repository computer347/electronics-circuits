/**
 * Three-legged parts on the breadboard (potentiometer, NPN transistor, MOSFET, regulator) and
 * the diode: that the board turns them into the right solver parts, that the bench can place,
 * move and turn them, and that the meter, the part card and the circuit world read them the
 * way a real bench would.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeBoard, currentLegs, legsOf, type BoardPart, type BoardState } from '../src/breadboard/model';
import { occupiedHoles, translateParts } from '../src/breadboard/move';
import { useBench } from '../src/breadboard/store';
import { buildMap } from '../src/circuitworld/map';
import { readMeter, type MeterMode } from '../src/desk/meter';
import { partInfo } from '../src/desk/partInfo';

const board = (volts: number, parts: BoardPart[]): BoardState => ({ supply: { volts, on: true }, parts });
const at = (b: BoardState, h: string) => analyzeBoard(b).voltageAt(h)!;
const amps = (b: BoardState, id: string) => analyzeBoard(b).result.currents[id] ?? 0;

/**
 * The classic transistor switch: 9 V, a 10 kΩ base resistor from +, a red LED and 470 Ω in the
 * collector, emitter to ground. Q1 sits in e10 (E), e11 (B), e12 (C).
 */
function npnSwitch(baseResistor = true): BoardState {
  const parts: BoardPart[] = [
    { id: 'Q1', kind: 'npn', h1: 'e10', h2: 'e11', h3: 'e12', marking: 'BC547' },
    { id: 'W1', kind: 'wire', h1: 'a10', h2: 'T-:9' },
    { id: 'R2', kind: 'resistor', h1: 'T+:14', h2: 'a14', ohms: 470 },
    { id: 'LED1', kind: 'led', h1: 'b14', h2: 'b12', color: 'red' },
  ];
  if (baseResistor) parts.push({ id: 'R1', kind: 'resistor', h1: 'T+:5', h2: 'a11', ohms: 10000 });
  return board(9, parts);
}

describe('NPN transistor on the breadboard', () => {
  it('switches the LED on when the base gets current, fully on (saturated)', () => {
    const b = npnSwitch();
    const a = analyzeBoard(b);
    expect(a.result.ok).toBe(true);
    const led = a.result.currents['LED1']!;
    // (9 − 1.8 − 0.2) / 470 ≈ 14.9 mA
    expect(led * 1000).toBeGreaterThan(13);
    expect(led * 1000).toBeLessThan(16);
    expect(at(b, 'e11')).toBeCloseTo(0.7, 1);
    expect(at(b, 'e12')).toBeLessThan(0.3);
    expect(a.result.activeStates?.['Q1']).toBe('sat');
  });

  it('is off with no base current: the LED stays dark', () => {
    const b = npnSwitch(false);
    expect(Math.abs(amps(b, 'LED1'))).toBeLessThan(1e-6);
  });

  it('amplifies in the active region: collector current is β × base current', () => {
    // A 1 MΩ base resistor gives ~8.3 µA; ×200 = 1.66 mA, well short of saturation.
    const b = npnSwitch();
    b.parts = b.parts.map((p) => (p.id === 'R1' ? { ...p, ohms: 1_000_000 } : p));
    const a = analyzeBoard(b);
    const ib = a.result.currents['Q1.base']!, ic = a.result.currents['Q1']!;
    expect(ib * 1e6).toBeCloseTo((9 - 0.7) / 1e6 * 1e6, 0);
    expect(ic / ib).toBeCloseTo(200, 0);
    expect(a.result.activeStates?.['Q1']).toBe('active');
  });

  it('reads like two diodes on the meter: B→E and B→C conduct, C→E does not', () => {
    const b = { ...npnSwitch(), parts: [npnSwitch().parts[0]!] };
    const diode = (red: string, black: string) => readMeter(b, 'diode', { red, black }, { ok: true, voltageAt: () => 0, currents: {} });
    expect(diode('e11', 'e10').value).toBeCloseTo(0.7, 1);
    expect(diode('e11', 'e12').value).toBeCloseTo(0.7, 1);
    expect(diode('e10', 'e11').text).toBe('OL');
    expect(diode('e12', 'e10').text).toBe('OL');
  });

  it('says on its card whether it is switched on, with each leg’s voltage', () => {
    const b = npnSwitch();
    const info = partInfo(b.parts[0]!, analyzeBoard(b));
    expect(info.tag).toBe('Q1 · BC547');
    expect(info.state).toMatch(/saturated/);
    const row = (k: string) => info.rows.find((r) => r[0] === k)?.[1];
    expect(row('Emitter leg')).toBe('0 V');
    expect(row('Base leg')).toMatch(/^7\d\d mV$/);
    expect(row('Base current')).toMatch(/µA$/);
    const off = partInfo(npnSwitch(false).parts[0]!, analyzeBoard(npnSwitch(false)));
    expect(off.state).toMatch(/off/);
  });

  it('is a door in the circuit world: the loop walks collector to emitter', () => {
    const b = npnSwitch();
    const m = buildMap(b, analyzeBoard(b));
    const q = m.loop.find((r) => r.id === 'Q1');
    expect(q?.kind).toBe('transistor');
    expect(q?.lit).toBe(true);
    expect(m.closed).toBe(true);
    const dark = buildMap(npnSwitch(false), analyzeBoard(npnSwitch(false)));
    expect(dark.loop.find((r) => r.id === 'Q1')?.lit).toBe(false);
  });
});

describe('potentiometer', () => {
  const pot = (position: number) => board(9, [
    { id: 'RV1', kind: 'pot', h1: 'e10', h2: 'e11', h3: 'e12', ohms: 10000, position },
    { id: 'W1', kind: 'wire', h1: 'T+:9', h2: 'a10' },
    { id: 'W2', kind: 'wire', h1: 'a12', h2: 'T-:12' },
  ]);

  it('divides the voltage by where the knob is', () => {
    expect(at(pot(0.5), 'e11')).toBeCloseTo(4.5, 2);
    expect(at(pot(0.25), 'e11')).toBeCloseTo(9 * 0.75, 2);
    expect(at(pot(0), 'e11')).toBeCloseTo(9, 2);
    expect(at(pot(1), 'e11')).toBeCloseTo(0, 2);
  });

  it('measures its full value end to end, whatever the knob', () => {
    const b = { ...pot(0.3), supply: { volts: 9, on: false }, parts: [pot(0.3).parts[0]!] };
    const r = readMeter(b, 'Ω', { red: 'e10', black: 'e12' }, { ok: true, voltageAt: () => 0, currents: {} });
    expect(r.value).toBeCloseTo(10000, -1);
  });
});

describe('MOSFET', () => {
  // IRLZ44N: G e10, D e11, S e12. The gate goes to a pot's wiper; the drain drives an LED.
  const fet = (gateVolts: number) => board(9, [
    { id: 'Q1', kind: 'nmos', h1: 'e10', h2: 'e11', h3: 'e12', marking: 'IRLZ44N' },
    { id: 'B1', kind: 'battery', h1: 'a10', h2: 'T-:5', volts: gateVolts },
    { id: 'W1', kind: 'wire', h1: 'a12', h2: 'T-:12' },
    { id: 'R1', kind: 'resistor', h1: 'T+:16', h2: 'a16', ohms: 470 },
    { id: 'LED1', kind: 'led', h1: 'b16', h2: 'b11', color: 'green' },
  ]);

  it('switches on above its 2 V threshold and off below it, with no gate current', () => {
    expect(amps(fet(5), 'LED1') * 1000).toBeGreaterThan(10);
    expect(Math.abs(amps(fet(1), 'LED1'))).toBeLessThan(1e-6);
    expect(Math.abs(amps(fet(5), 'B1'))).toBeLessThan(1e-9);
  });

  it('has a body diode the meter finds from source to drain', () => {
    const b = board(9, [fet(5).parts[0]!]);
    b.supply.on = false;
    const r = readMeter(b, 'diode', { red: 'e12', black: 'e11' }, { ok: true, voltageAt: () => 0, currents: {} });
    expect(r.value).toBeCloseTo(0.7, 1);
  });
});

describe('regulator', () => {
  const reg = (volts: number) => board(volts, [
    { id: 'U1', kind: 'regulator', h1: 'e10', h2: 'e11', h3: 'e12', vout: 5, marking: 'LM7805' },
    { id: 'W1', kind: 'wire', h1: 'T+:9', h2: 'a10' },
    { id: 'W2', kind: 'wire', h1: 'a11', h2: 'T-:11' },
    { id: 'R1', kind: 'resistor', h1: 'a12', h2: 'T-:13', ohms: 1000 },
  ]);

  it('holds its output at 5 V from a 9 V or 12 V input', () => {
    expect(at(reg(9), 'e12')).toBeCloseTo(5, 2);
    expect(at(reg(12), 'e12')).toBeCloseTo(5, 2);
  });

  it('drops out below 7 V: the output follows the input, 2 V down', () => {
    expect(at(reg(6), 'e12')).toBeCloseTo(4, 1);
  });

  it('turns the difference into heat: (Vin − Vout) × I', () => {
    const a = analyzeBoard(reg(12));
    const p = a.result.power?.['U1'];
    expect(p).toBeCloseTo((12 - 5) * 0.005, 3);
  });
});

describe('diode', () => {
  it('conducts one way with about 0.7 V across it, and blocks the other', () => {
    const d = (h1: string, h2: string) => board(5, [
      { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'a3' },
      { id: 'D1', kind: 'diode', h1, h2, vf: 0.7, marking: '1N4148' },
      { id: 'R1', kind: 'resistor', h1: 'a8', h2: 'T-:8', ohms: 1000 },
    ]);
    const fwd = d('b3', 'b8');
    expect(amps(fwd, 'D1') * 1000).toBeCloseTo(4.3, 1);
    expect(Math.abs(amps(d('b8', 'b3'), 'D1'))).toBeLessThan(1e-6);
  });
});

describe('placing, moving and turning three-legged parts', () => {
  beforeEach(() => {
    useBench.getState().load({ supply: { volts: 9, on: true }, parts: [] });
  });

  it('knows every leg and the two the main current flows between', () => {
    const q = npnSwitch().parts[0]!;
    expect(legsOf(q)).toEqual(['e10', 'e11', 'e12']);
    expect(currentLegs(q)).toEqual(['e12', 'e10']);
    expect(currentLegs({ id: 'M', kind: 'nmos', h1: 'a1', h2: 'a2', h3: 'a3' })).toEqual(['a2', 'a3']);
    expect(currentLegs({ id: 'R', kind: 'resistor', h1: 'a1', h2: 'a5' })).toEqual(['a1', 'a5']);
    expect([...occupiedHoles([q])].sort()).toEqual(['e10', 'e11', 'e12']);
  });

  it('goes in with one click, into that hole and the next two along the row', () => {
    const s = useBench.getState();
    s.setTool('npn');
    useBench.getState().clickHole('c20');
    const q = useBench.getState().parts.find((p) => p.kind === 'npn')!;
    expect([q.h1, q.h2, q.h3]).toEqual(['c20', 'c21', 'c22']);
    expect(q.marking).toBe('BC547');
    expect(q.id).toBe('Q1');
  });

  it('refuses a spot where one of the three holes is taken', () => {
    const s = useBench.getState();
    s.load({ supply: { volts: 9, on: true }, parts: [{ id: 'R1', kind: 'resistor', h1: 'c22', h2: 'c26', ohms: 100 }] });
    s.setTool('regulator');
    useBench.getState().clickHole('c20');
    expect(useBench.getState().parts.some((p) => p.kind === 'regulator')).toBe(false);
    expect(useBench.getState().notice).toMatch(/three free holes/);
  });

  it('turns round about its middle leg', () => {
    const s = useBench.getState();
    s.load({ supply: { volts: 9, on: true }, parts: [npnSwitch().parts[0]!] });
    useBench.getState().flipPart('Q1');
    const q = useBench.getState().parts[0]!;
    expect([q.h1, q.h2, q.h3]).toEqual(['e12', 'e11', 'e10']);
  });

  it('moves with all three legs, and a turned-round transistor stops conducting', () => {
    const q = npnSwitch().parts[0]!;
    const moved = translateParts([q], ['Q1'], 'e10', 'e20', 'single');
    expect(moved.valid).toBe(true);
    const m = moved.parts[0]!;
    expect([m.h1, m.h2, m.h3]).toEqual(['e20', 'e21', 'e22']);

    // Collector and emitter swapped: the LED's current would have to go in at the emitter.
    const b = npnSwitch();
    b.parts = b.parts.map((p) => (p.id === 'Q1' ? { ...p, h1: 'e12', h3: 'e10' } : p));
    expect(amps(b, 'LED1') * 1000).toBeLessThan(1);
  });

  it('is never reported as shorted just because two of its legs share a net', () => {
    const b = npnSwitch();
    expect(analyzeBoard(b).shortedParts).not.toContain('Q1');
  });
});

describe('meter modes stay consistent', () => {
  it('prints ▶| on the dial for the diode test', async () => {
    const { DIAL, DIAL_LABEL } = await import('../src/desk/meter');
    expect(DIAL).toContain('diode' as MeterMode);
    expect(DIAL_LABEL.diode).toBe('▶|·)))');
    expect(DIAL_LABEL.Vac).toBe('V~');
  });
});
