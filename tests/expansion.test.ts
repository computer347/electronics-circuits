/**
 * The 30 levels added to World 0 (11–25) and World 1 (10–24), against the solver: each fails as
 * it starts, passes with the right fix, and fails (with a useful reason) with the usual wrong
 * ones. `FIXES` is also used to walk the fixed boards inside the circuit.
 */
import { describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardPart, type BoardState } from '../src/breadboard/model';
import { checkLevel } from '../src/levels/check';
import { startingBoard, WORLD0, WORLD1 } from '../src/levels';
import type { LevelDef } from '../src/levels/types';

const L0 = (n: number) => WORLD0.find((l) => l.number === n)!;
const L1 = (n: number) => WORLD1.find((l) => l.number === n)!;
const add = (b: BoardState, ...parts: BoardPart[]): BoardState => ({ ...b, parts: [...b.parts, ...parts] });
const set = (b: BoardState, patch: Record<string, Partial<BoardPart>>): BoardState => ({ ...b, parts: b.parts.map((p) => (patch[p.id] ? { ...p, ...patch[p.id] } : p)) });
const R = (id: string, h1: string, h2: string, ohms: number): BoardPart => ({ id, kind: 'resistor', h1, h2, ohms });
const W = (id: string, h1: string, h2: string): BoardPart => ({ id, kind: 'wire', h1, h2 });
const D = (id: string, h1: string, h2: string): BoardPart => ({ id, kind: 'diode', h1, h2, vf: 0.7, marking: '1N4148' });
const C = (id: string, h1: string, h2: string, farads: number): BoardPart => ({ id, kind: 'capacitor', h1, h2, farads });
const check = (l: LevelDef, b: BoardState) => checkLevel(l, b, analyzeBoard(b));
const start = (l: LevelDef) => startingBoard(l);

/** The right fix for each new level, from its starting board. */
export const FIXES: Record<string, (b: BoardState) => BoardState> = {
  'w0-11-two-in-a-row': (b) => add(b, R('R1', 'c3', 'a8', 330)),
  'w0-12-mixed-colours': (b) => add(b, R('R1', 'c3', 'a10', 470), R('R2', 'd3', 'a17', 390)),
  'w0-13-make-do': (b) => add(b, R('R1', 'c3', 'a14', 470), R('R2', 'd3', 'c14', 1000)),
  'w0-14-bypassed': (b) => set(b, { W2: { h1: 'a13' } }),
  'w0-15-dead-rail': (b) => add(b, W('W3', 'B-:23', 'T-:23')),
  'w0-16-power-budget': (b) => set(b, { R1: { ohms: 560 }, R2: { ohms: 560 }, R3: { ohms: 560 } }),
  'w0-17-one-way': (b) => add(b, D('D1', 'c3', 'b8')),
  'w0-18-turn-it-down': (b) => set(b, { RV1: { position: 0.1 } }),
  'w0-19-set-the-level': (b) => set(b, { RV1: { position: 0.4 } }),
  'w0-20-wrong-sensor': (b) => set(b, { R1: { ohms: 10000 } }),
  'w0-21-under-load': (b) => add(b, R('R1', 'c3', 'a10', 1000), R('R2', 'b10', 'T-:10', 1000)),
  'w0-22-double-up': (b) => add(b, C('C2', 'j14', 'T-:14', 100e-6)),
  'w0-23-regulated': (b) => add(b, { id: 'U1', kind: 'regulator', h1: 'e5', h2: 'e6', h3: 'e7', vout: 5, marking: 'LM7805' }),
  'w0-24-enough-gain': (b) => add(b, R('RB', 'c7', 'a11', 10000)),
  'w0-25-heavy-lifting': (b) => add(b, { id: 'Q1', kind: 'nmos', h1: 'e10', h2: 'e11', h3: 'e12', marking: 'IRLZ44N' }),
  'w1-10-diode-or': (b) => add(b, D('DA', 'd3', 'd12'), D('DB', 'd9', 'c12')),
  'w1-11-chip-inverter': (b) => add(b, W('W1', 'a11', 'a20')),
  'w1-12-and-from-nand': (b) => add(b, W('W1', 'a12', 'a13')),
  'w1-13-or-from-nand': (b) => add(b, W('W1', 'a12', 'g15'), W('W2', 'a15', 'g14')),
  'w1-14-same-or-different': (b) => add(b, W('W1', 'a14', 'T+:12')),
  'w1-15-odd-one-out': (b) => add(b, W('W1', 'c12', 'c13')),
  'w1-16-burglar-alarm': (b) => add(b, W('W1', 'c5', 'c17')),
  'w1-17-majority-vote': (b) => add(b, W('W1', 'c7', 'g7'), W('W2', 'h9', 'c21')),
  'w1-18-pick-one': (b) => add(b, W('W1', 'd15', 'g12'), W('W2', 'g16', 'g11')),
  'w1-19-one-of-four': (b) => add(b, W('W7', 'c4', 'h22'), W('W8', 'c5', 'h21')),
  'w1-20-crack-the-code': (b) => add(b, W('W5', 'b4', 'b20'), W('W6', 'b6', 'b21')),
  'w1-21-drive-it-harder': (b) => add(b, R('RB', 'a5', 'b21', 10000)),
  'w1-22-full-adder': (b) => add(b, W('W1', 'd13', 'c21'), W('W2', 'd16', 'c22')),
  'w1-23-hold-that-bit': (b) => add(b, W('W1', 'h20', 'g15'), W('W2', 'g17', 'g18')),
  'w1-24-traffic-lights': (b) => add(b, W('W2', 'c3', 'c17'), W('W3', 'd6', 'c18')),
};

const NEW = [...WORLD0.filter((l) => l.number >= 11), ...WORLD1.filter((l) => l.number >= 10)];

describe('the 30 new levels', () => {
  it('are 15 more in each world, numbered on from the old ones', () => {
    expect(WORLD0.map((l) => l.number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(WORLD1.map((l) => l.number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(NEW).toHaveLength(30);
  });

  it('each fails as it starts and passes with its fix, burning nothing', () => {
    for (const l of NEW) {
      expect(check(l, start(l)).pass, `${l.id} should fail at the start`).toBe(false);
      const fixed = FIXES[l.id]!(start(l));
      const r = check(l, fixed);
      expect(r.pass, `${l.id}: ${r.diagnosis?.message ?? ''} ${r.lines.filter((x) => !x.ok).map((x) => `${x.label} = ${x.measured}`).join('; ')}`).toBe(true);
      expect(analyzeBoard(fixed).newlyBurnt, l.id).toEqual([]);
    }
  });

  it('give every level three hints, a story, a goal and a debrief', () => {
    for (const l of NEW) {
      expect(l.hints, l.id).toHaveLength(3);
      expect(l.brief.story.length, l.id).toBeGreaterThan(60);
      expect(l.debrief.length, l.id).toBeGreaterThan(120);
    }
  });
});

describe('World 0, levels 11–25: the wrong builds fail for the right reason', () => {
  it('0–11: 220 Ω is too much current through two LEDs, 470 Ω too little', () => {
    const l = L0(11);
    expect(check(l, add(start(l), R('R1', 'c3', 'a8', 220))).pass).toBe(false);
    expect(check(l, add(start(l), R('R1', 'c3', 'a8', 470))).pass).toBe(false);
    // the solver agrees with the hand sum: (9 − 2 − 2) ÷ 330 = 15.2 mA
    const a = analyzeBoard(FIXES[l.id]!(start(l)));
    expect(a.result.currents['LED1']! * 1000).toBeCloseTo(15.15, 1);
  });

  it('0–12: one 470 Ω value for both colours leaves blue dim', () => {
    const l = L0(12);
    const r = check(l, add(start(l), R('R1', 'c3', 'a10', 470), R('R2', 'd3', 'a17', 470)));
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/LEDB/);
  });

  it('0–13: one 470 Ω is too dim, 470 ∥ 470 too bright; three 1 kΩ in parallel also work', () => {
    const l = L0(13);
    expect(check(l, add(start(l), R('R1', 'c3', 'a14', 470))).pass).toBe(false);
    expect(check(l, add(start(l), R('R1', 'c3', 'a14', 470), R('R2', 'd3', 'c14', 470))).pass).toBe(false);
    expect(check(l, add(start(l), R('R1', 'c3', 'a14', 1000), R('R2', 'd3', 'c14', 1000), R('R3', 'b3', 'd14', 1000))).pass).toBe(true);
  });

  it('0–14: the short puts 0 V across the LED and all 9 V on R1', () => {
    const a = analyzeBoard(start(L0(14)));
    expect(Math.abs(a.voltageAt('d10')! - a.voltageAt('d13')!)).toBeLessThan(0.01);
    expect(a.result.currents['LED1'] ?? 0).toBeLessThan(1e-6);
  });

  it('0–15: the bottom − rail floats until it’s jumpered to ground', () => {
    const a = analyzeBoard(start(L0(15)));
    expect(a.result.currents['LED1'] ?? 0).toBeLessThan(1e-6);
  });

  it('0–16: 330 Ω draws 63 mA, over budget; 820 Ω is under budget but too dim', () => {
    const l = L0(16);
    const a = analyzeBoard(start(l));
    expect(Math.abs(a.result.currents['SUPPLY']!) * 1000).toBeGreaterThan(60);
    expect(check(l, set(start(l), { R1: { ohms: 820 }, R2: { ohms: 820 }, R3: { ohms: 820 } })).pass).toBe(false);
  });

  it('0–17: a wire instead of the diode gives too much current; a reversed diode gives none', () => {
    const l = L0(17);
    expect(check(l, add(start(l), W('W3', 'c3', 'b8'))).pass).toBe(false);
    expect(check(l, add(start(l), D('D1', 'b8', 'c3'))).pass).toBe(false);
    const a = analyzeBoard(FIXES[l.id]!(start(l)));
    expect(a.result.currents['LED1']! * 1000).toBeCloseTo(19.09, 1);
  });

  it('0–18: 20 % is too dim and 0 % too bright', () => {
    const l = L0(18);
    expect(check(l, set(start(l), { RV1: { position: 0.2 } })).pass).toBe(false);
    expect(check(l, set(start(l), { RV1: { position: 0 } })).pass).toBe(false);
  });

  it('0–19: the wiper sits at 9 V × (1 − position)', () => {
    for (const k of [0.2, 0.4, 0.7]) {
      const a = analyzeBoard(set(start(L0(19)), { RV1: { position: k } }));
      expect(a.voltageAt('c6')!).toBeCloseTo(9 * (1 - k), 2);
    }
  });

  it('0–20: with the faulty 1 kΩ the sensor reads 8.2 V', () => {
    expect(analyzeBoard(start(L0(20))).voltageAt('c8')!).toBeCloseTo(8.18, 2);
  });

  it('0–21: two 10 kΩ sag to 3 V under the load; two 470 Ω hold up but blow the 5 mA budget; 4.7 k over 10 k works', () => {
    const l = L0(21);
    const div = (top: number, bottom: number) => add(start(l), R('R1', 'c3', 'a10', top), R('R2', 'b10', 'T-:10', bottom));
    expect(analyzeBoard(div(10000, 10000)).voltageAt('d10')!).toBeCloseTo(3, 2);
    expect(check(l, div(10000, 10000)).pass).toBe(false);
    expect(check(l, div(470, 470)).pass).toBe(false);
    expect(check(l, div(4700, 10000)).pass).toBe(true);
  });

  it('0–22: one capacitor charges in about 0.47 s, too fast', () => {
    const l = L0(22);
    const r = check(l, start(l));
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/Too fast/);
  });

  it('0–23: wired straight to 9 V, the 220 Ω lets 32 mA through and burns the LED', () => {
    const l = L0(23);
    const a = analyzeBoard(add(start(l), W('W4', 'd5', 'd7')));
    expect(a.newlyBurnt).toContain('LED1');
  });

  it('0–24: 47 kΩ can’t saturate Q1 for three LEDs; 1 kΩ takes too much base current', () => {
    const l = L0(24);
    expect(check(l, add(start(l), R('RB', 'c7', 'a11', 47000))).pass).toBe(false);
    expect(check(l, add(start(l), R('RB', 'c7', 'a11', 1000))).pass).toBe(false);
    expect(check(l, add(start(l), R('RB', 'c7', 'a11', 4700))).pass).toBe(true);
  });

  it('0–25: the MOSFET turned round leaves the LEDs on through its body diode', () => {
    const l = L0(25);
    const r = check(l, add(start(l), { id: 'Q1', kind: 'nmos', h1: 'e12', h2: 'e11', h3: 'e10', marking: 'IRLZ44N' }));
    expect(r.pass).toBe(false);
  });
});

describe('World 1, levels 10–24: the wrong builds fail for the right reason', () => {
  it('1–10: plain wires make OR, but SA then lights LEDB too', () => {
    const l = L1(10);
    const r = check(l, add(start(l), W('WA', 'd3', 'd12'), W('WB', 'd9', 'c12')));
    expect(r.pass).toBe(false);
    expect(r.lines.find((x) => x.label.startsWith('OUT'))?.ok).toBe(true);
  });

  it('1–11: wired from pin 1 the light just copies SA', () => {
    const l = L1(11);
    expect(check(l, add(start(l), W('W1', 'a10', 'a20'))).pass).toBe(false);
  });

  it('1–12: the LED off pin 3 would be NAND, not AND', () => {
    const l = L1(12);
    expect(check(l, start(l)).pass).toBe(false);
  });

  it('1–13: the plain inputs into gate 3 give NAND, not OR', () => {
    const l = L1(13);
    expect(check(l, add(start(l), W('W1', 'd10', 'g15'), W('W2', 'd13', 'g14'))).pass).toBe(false);
  });

  it('1–14: tied to ground instead of +, gate 2 passes XOR through', () => {
    const l = L1(14);
    expect(check(l, add(start(l), W('W1', 'a14', 'T-:12'))).pass).toBe(false);
  });

  it('1–18 and 1–19: half the wiring isn’t enough', () => {
    expect(check(L1(18), add(start(L1(18)), W('W1', 'd15', 'g12'))).pass).toBe(false);
    expect(check(L1(19), add(start(L1(19)), W('W7', 'c4', 'h22'))).pass).toBe(false);
  });

  it('1–20: the lock opens for exactly one code of sixteen', () => {
    const l = L1(20);
    const fixed = FIXES[l.id]!(start(l));
    const r = check(l, fixed);
    expect(r.lines[0]!.measured).toBe('0000000000100000');
  });

  it('1–21: 100 Ω overloads the chip’s pin; 100 kΩ starves Q1', () => {
    const l = L1(21);
    expect(check(l, add(start(l), R('RB', 'a5', 'b21', 100))).pass).toBe(false);
    expect(check(l, add(start(l), R('RB', 'a5', 'b21', 100000))).pass).toBe(false);
  });

  it('1–22: without the carry wires COUT never lights, though SUM already works', () => {
    const r = check(L1(22), start(L1(22)));
    expect(r.lines[0]!.ok).toBe(true);
    expect(r.lines[1]!.ok).toBe(false);
  });

  it('1–23: with only one feedback wire it can’t hold', () => {
    const l = L1(23);
    expect(check(l, add(start(l), W('W1', 'h20', 'g15'))).pass).toBe(false);
  });

  it('1–24: green from S0 instead of NOT S0 lights in the wrong state', () => {
    const l = L1(24);
    expect(check(l, add(start(l), W('W2', 'c3', 'c17'), W('W3', 'c5', 'c18'))).pass).toBe(false);
  });
});

describe('the new levels inside the circuit', () => {
  it('builds a walkable world for each, before and after the fix', async () => {
    const { buildWorld } = await import('../src/circuitworld/world');
    for (const l of NEW) {
      for (const b of [start(l), FIXES[l.id]!(start(l))]) {
        const w = buildWorld(b, analyzeBoard(b));
        expect(w.plazas.length, l.id).toBeGreaterThan(0);
      }
    }
  });
});
