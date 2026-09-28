import { describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardPart, type BoardState } from '../src/breadboard/model';
import { chargeTime, checkLevel } from '../src/levels/check';
import { startingBoard, WORLD0 } from '../src/levels';

const L = (n: number) => WORLD0.find((l) => l.number === n)!;
const add = (b: BoardState, ...parts: BoardPart[]): BoardState => ({ ...b, parts: [...b.parts, ...parts] });
const edit = (b: BoardState, id: string, patch: Partial<BoardPart>): BoardState => ({ ...b, parts: b.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
const R = (id: string, h1: string, h2: string, ohms: number): BoardPart => ({ id, kind: 'resistor', h1, h2, ohms });
const W = (id: string, h1: string, h2: string): BoardPart => ({ id, kind: 'wire', h1, h2 });
const check = (n: number, b: BoardState) => checkLevel(L(n), b, analyzeBoard(b));

describe('World 0', () => {
  it('has all five levels, numbered in order', () => {
    expect(WORLD0.map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(WORLD0.map((l) => l.id)).size).toBe(5);
  });
});

describe('level 2: Wrong way round', () => {
  const start = startingBoard(L(2));
  it('starts with the LED backwards, dark, and not burnt (5 V is within its reverse rating)', () => {
    const a = analyzeBoard(start);
    expect(a.newlyBurnt).toEqual([]);
    const r = check(2, start);
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/LED1 is in backwards/);
  });
  it('the two measurements the hint describes read 5 V and 0 V', () => {
    const a = analyzeBoard(start);
    expect(a.voltageAt('i12')).toBeCloseTo(5, 3);
    expect(a.voltageAt('i14')).toBeCloseTo(0, 3);
  });
  it('passes once LED1 is flipped: (5 − 2) / 150 = 20 mA', () => {
    const led = start.parts.find((p) => p.id === 'LED1')!;
    const fixed = edit(start, 'LED1', { h1: led.h2, h2: led.h1 });
    const r = check(2, fixed);
    expect(r.pass).toBe(true);
    expect(r.lines[0]!.measured).toBe('20 mA');
  });
});

describe('level 3: Side by side', () => {
  const b = L(3).board;
  const series = (ohms: number) => add(b, R('R1', 'g3', 'g10', ohms), W('W3', 'i12', 'i16'));
  it.each([270, 330, 390])('series with %i Ω passes', (ohms) => {
    expect(check(3, series(ohms)).pass).toBe(true);
  });
  it('series with 470 Ω is too dim (10.6 mA each)', () => {
    const r = check(3, series(470));
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/lit but dim/);
  });
  it('parallel, each LED with its own resistor, lights both but busts the supply budget', () => {
    // LED1 via R1; LED2 via R2 straight from the supply column; LED1's cathode to ground
    const parallel = add(b, R('R1', 'g3', 'g10', 470), R('R2', 'f3', 'f16', 470), W('W3', 'i12', 'T-:11'));
    const r = check(3, parallel);
    expect(r.lines[0]!.ok).toBe(true);
    expect(r.lines[1]!.ok).toBe(true);
    expect(r.lines[2]!.ok).toBe(false);
    expect(r.diagnosis?.message).toMatch(/supply is delivering 29.8 mA, over the 20 mA budget.*one current passes through both/);
  });
});

describe('level 4: Split the difference', () => {
  const b = L(4).board;
  const divider = (top: number, bottom: number) => add(b, R('R1', 'g3', 'g14', top), R('R2', 'h14', 'h25', bottom));
  it.each([[6800, 3300], [10000, 4700], [22000, 10000], [15000, 6800]])('%i / %i passes', (top, bottom) => {
    expect(check(4, divider(top, bottom)).pass).toBe(true);
  });
  it('2.2 kΩ / 1 kΩ has the right ratio but draws 2.8 mA', () => {
    const r = check(4, divider(2200, 1000));
    expect(r.lines[0]!.ok).toBe(true);
    expect(r.lines[1]!.ok).toBe(false);
    expect(r.diagnosis?.message).toMatch(/bigger resistors/);
  });
  it('equal resistors give 4.5 V and say which way to go', () => {
    const r = check(4, divider(10000, 10000));
    expect(r.lines[0]!.measured).toBe('4.5 V');
    expect(r.diagnosis?.message).toMatch(/TP1 is 4.5 V; it should be 2.8–3.2 V/);
  });
  it('the yellow TP1 link joins the two halves of column 14', () => {
    // bottom resistor on the a–e side of column 14, down to the ground rail
    const r = check(4, add(b, R('R1', 'g3', 'g14', 6800), R('R2', 'c14', 'T-:20', 3300)));
    expect(r.lines[0]!.ok).toBe(true);
  });
});

describe('level 5: Slow blink', () => {
  const b = L(5).board;
  const timed = (ohms: number) => add(b, R('R1', 'i6', 'f14', ohms));
  it('with no timing resistor C1 never charges', () => {
    expect(chargeTime(b, 'C1')).toEqual({ final: 0 });
    const r = check(5, b);
    expect(r.diagnosis?.message).toMatch(/never charges/);
  });
  it('10 kΩ gives τ ≈ 0.91 s (the 100 kΩ bleed shortens it a little) and passes', () => {
    const t = chargeTime(timed(10000), 'C1');
    // Thevenin: 10k || 100k = 9.09 kΩ, times 100 µF
    expect(t.seconds!).toBeCloseTo(0.909, 1);
    expect(t.final).toBeCloseTo((9 * 100) / 110, 2);
    expect(check(5, timed(10000)).pass).toBe(true);
  });
  it('4.7 kΩ is too fast and 22 kΩ too slow, with the reason', () => {
    const fast = check(5, timed(4700));
    expect(fast.pass).toBe(false);
    expect(fast.diagnosis?.message).toMatch(/Too fast: the time constant is τ = R × C/);
    const slow = check(5, timed(22000));
    expect(slow.diagnosis?.message).toMatch(/Too slow/);
  });
});
