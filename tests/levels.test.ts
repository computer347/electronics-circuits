import { describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardPart, type BoardState } from '../src/breadboard/model';
import { checkLevel, partsAdded, stars } from '../src/levels/check';
import { applyFaults, FaultError } from '../src/levels/faults';
import { LevelError, parseLevel, startingBoard, WORLD0 } from '../src/levels';

const L1 = WORLD0[0]!;
const withParts = (b: BoardState, ...extra: BoardPart[]): BoardState => ({ ...b, parts: [...b.parts, ...extra] });
const resistor = (ohms: number, h1 = 'g3', h2 = 'g12'): BoardPart => ({ id: 'R1', kind: 'resistor', h1, h2, ohms });
const check = (b: BoardState) => checkLevel(L1, b, analyzeBoard(b));

describe('level files', () => {
  it('all World 0 levels parse', () => {
    expect(WORLD0.length).toBeGreaterThan(0);
    for (const l of WORLD0) expect(() => parseLevel(l)).not.toThrow();
  });
  it('reject typos loudly', () => {
    const bad = structuredClone(L1);
    bad.board.parts[0]!.h1 = 'z99';
    expect(() => parseLevel(bad)).toThrow(LevelError);
    const bad2 = structuredClone(L1);
    bad2.locked = ['NOPE'];
    expect(() => parseLevel(bad2)).toThrow(/locked part NOPE/);
  });
});

describe('fault injection', () => {
  const base = L1.board;
  it('reverses, re-values, moves and removes parts', () => {
    const b = withParts(base, resistor(330));
    const f = applyFaults(b, [
      { kind: 'reverse', part: 'LED1' },
      { kind: 'value', part: 'R1', ohms: 33 },
      { kind: 'move-leg', part: 'W2', leg: 'h1', to: 'e14' },
      { kind: 'remove', part: 'W1' },
    ]);
    const led = f.parts.find((p) => p.id === 'LED1')!;
    expect([led.h1, led.h2]).toEqual(['h14', 'h12']);
    expect(f.parts.find((p) => p.id === 'R1')!.ohms).toBe(33);
    expect(f.parts.find((p) => p.id === 'W2')!.h1).toBe('e14');
    expect(f.parts.some((p) => p.id === 'W1')).toBe(false);
    // the base board is untouched
    expect(base.parts.find((p) => p.id === 'LED1')!.h1).toBe('h12');
  });
  it('refuses faults that make no sense', () => {
    expect(() => applyFaults(base, [{ kind: 'reverse', part: 'X9' }])).toThrow(FaultError);
    expect(() => applyFaults(base, [{ kind: 'value', part: 'LED1', ohms: 1 }])).toThrow(FaultError);
    expect(() => applyFaults(base, [{ kind: 'move-leg', part: 'W2', leg: 'h1', to: 'h12' }])).toThrow(/already taken/);
  });
});

describe('level 1: First light', () => {
  it('starts dark, and says why', () => {
    const r = check(startingBoard(L1));
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.part).toBe('LED1');
    expect(r.diagnosis?.message).toMatch(/Nothing else is plugged into column 12/);
  });

  it.each([330, 390, 470, 560, 680])('passes with %i Ω', (ohms) => {
    const r = check(withParts(L1.board, resistor(ohms)));
    expect(r.pass).toBe(true);
    expect(r.diagnosis).toBeUndefined();
  });

  it('fails too dim with 1 kΩ and too bright with 270 Ω', () => {
    const dim = check(withParts(L1.board, resistor(1000)));
    expect(dim.pass).toBe(false);
    expect(dim.diagnosis?.message).toMatch(/lit but dim: 7 mA/);
    const hot = check(withParts(L1.board, resistor(270)));
    expect(hot.pass).toBe(false);
    expect(hot.diagnosis?.message).toMatch(/25.9 mA, above the datasheet's 25 mA/);
  });

  it('measures what the solver says: (9 − 2) / 330 = 21.2 mA', () => {
    const r = check(withParts(L1.board, resistor(330)));
    expect(r.lines[0]).toEqual({ ok: true, label: 'LED1 current 10–25 mA', measured: '21.2 mA' });
  });

  it('220 Ω burns the LED', () => {
    const b = withParts(L1.board, resistor(220));
    expect(analyzeBoard(b).newlyBurnt).toEqual(['LED1']);
    const burnt = { ...b, parts: b.parts.map((p) => (p.id === 'LED1' ? { ...p, burnt: true } : p)) };
    const r = check(burnt);
    expect(r.pass).toBe(false);
    expect(r.diagnosis?.message).toMatch(/burnt out/);
  });

  it('explains a resistor with both legs in one column', () => {
    const r = check(withParts(L1.board, resistor(330, 'g3', 'i3')));
    expect(r.diagnosis?.message).toMatch(/Nothing else is plugged into column 12/);
  });

  it('explains a backwards LED', () => {
    // the resistor feeds column 12, which is now the cathode; the anode is wired to ground
    const b = withParts(applyFaults(L1.board, [{ kind: 'reverse', part: 'LED1' }]), resistor(330));
    expect(check(b).diagnosis?.message).toMatch(/LED1 is in backwards/);
  });

  it('explains an LED with both legs in one strip', () => {
    const b: BoardState = { ...L1.board, parts: [...L1.board.parts.map((p) => (p.id === 'LED1' ? { ...p, h1: 'h12', h2: 'f12' } : p)), resistor(330)] };
    expect(check(b).diagnosis?.message).toMatch(/same strip/);
  });
});

describe('stars', () => {
  const base = { hintsUsed: 0, burnt: 0, checks: 1, partsAdded: 1, seconds: 60 };
  it('gold for a clean first-try pass, silver over par, bronze with hints or burns', () => {
    expect(stars(L1, base)).toBe(3);
    expect(stars(L1, { ...base, checks: 2 })).toBe(2);
    expect(stars(L1, { ...base, partsAdded: 2 })).toBe(2);
    expect(stars(L1, { ...base, hintsUsed: 1 })).toBe(1);
    expect(stars(L1, { ...base, burnt: 1 })).toBe(1);
  });
  it('counts only parts the player added', () => {
    expect(partsAdded(L1, withParts(L1.board, resistor(330)))).toBe(1);
    expect(partsAdded(L1, L1.board)).toBe(0);
  });
});
