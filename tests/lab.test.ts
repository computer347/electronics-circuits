/**
 * The Parts Lab against the models: every catalogue part has exactly one level, every answer
 * is what the solver (or the 3D board) says it is, and every level teaches something useful.
 */
import { describe, expect, it } from 'vitest';
import { dialVolts, LABS, labReading, type LabSpec } from '../src/lab/labs';
import { LOOKS, seenX } from '../src/lab/looks';
import { CATALOGUE } from '../src/parts/catalogue';
import { BOARDS } from '../src/parts3d/boards';
import { MODELS } from '../src/parts3d/registry';

const lab = <K extends LabSpec['kind']>(part: string, kind: K) => {
  const l = LABS.find((x) => x.part === part)!;
  expect(l.kind).toBe(kind);
  return l as Extract<LabSpec, { kind: K }>;
};
const value = (r: { text: string; value?: number }) => (r.text === 'OL' ? Infinity : r.value!);

describe('Parts Lab', () => {
  it('has exactly one level for every catalogue part, and nothing else', () => {
    const ids = CATALOGUE.map((c) => c.id).sort();
    expect(LABS.map((l) => l.part).sort()).toEqual(ids);
  });

  it('gives every level a task, a skill, a reason it matters, a hint and an explanation', () => {
    for (const l of LABS) {
      expect(l.ask.length, l.part).toBeGreaterThan(20);
      expect(l.skill.length, l.part).toBeGreaterThan(20);
      expect(l.why.length, l.part).toBeGreaterThan(50);
      expect(l.hint.length, l.part).toBeGreaterThan(20);
      expect(l.explain.length, l.part).toBeGreaterThan(20);
    }
  });

  it('sorts parts the way the meter says: keep exactly when the reading is in range', () => {
    for (const l of LABS.filter((x): x is Extract<LabSpec, { kind: 'sort' }> => x.kind === 'sort')) {
      const v = value(labReading(l, l.mode, 0, 1));
      const inside = v >= l.range[0] && v <= l.range[1];
      expect(inside ? 'keep' : 'bin', `${l.part} read ${v}`).toBe(l.answer);
    }
  });

  it('quotes the reading the meter really shows in its explanation', () => {
    expect(labReading(lab('resistor', 'sort'), 'Ω', 0, 1).text).toBe('5.264');
    expect(lab('resistor', 'sort').explain).toMatch(/5\.26 kΩ/);
    expect(labReading(lab('cell-aa', 'sort'), 'V', 0, 1).value).toBeCloseTo(1.08, 2);
    expect(labReading(lab('chip-r-0402', 'sort'), 'Ω', 0, 1).text).toBe('9.800');
  });

  it('refuses Ω across a battery, like a careful meter user would', () => {
    expect(labReading(lab('battery-9v', 'sort'), 'Ω', 0, 1).text).toBe('Err');
  });

  it('finds each diode’s cathode with the diode test: forward reads a voltage, backwards OL', () => {
    for (const id of ['led', 'diode-1n4148', 'diode-1n4007', 'chip-led-0603']) {
      const l = lab(id, 'pins');
      const cathode = l.answer, anode = 1 - l.answer;
      expect(value(labReading(l, 'diode', anode, cathode)), id).toBeLessThan(2.5);
      expect(labReading(l, 'diode', cathode, anode).text, id).toBe('OL');
    }
    expect(labReading(lab('led', 'pins'), 'diode', 0, 1).value).toBeCloseTo(1.8, 1);
    expect(labReading(lab('diode-1n4148', 'pins'), 'diode', 0, 1).value).toBeCloseTo(0.62, 2);
  });

  it('finds the BC547’s base: red on it conducts to both other legs, no other leg does', () => {
    const l = lab('npn-bc547', 'pins');
    const conductsToBoth = (b: number) => [0, 1, 2].filter((x) => x !== b).every((x) => labReading(l, 'diode', b, x).text !== 'OL');
    expect([0, 1, 2].filter(conductsToBoth)).toEqual([l.answer]);
  });

  it('finds the button’s always-joined leg and the switch’s common leg on Ω', () => {
    const b = lab('tactile-button', 'pins');
    const joined = [1, 2, 3].filter((x) => value(labReading(b, 'Ω', 0, x)) < 1);
    expect(joined).toEqual([b.answer]);
    const s = lab('slide-switch', 'pins');
    expect(value(labReading(s, 'Ω', s.answer, 0))).toBeLessThan(1);
    expect(labReading(s, 'Ω', 0, 2).text).toBe('OL');
  });

  it('has exactly one right option in every “use it” level, per the solver', () => {
    for (const l of LABS.filter((x): x is Extract<LabSpec, { kind: 'use' }> => x.kind === 'use')) {
      const ok = l.options.map((_, i) => l.outcome(i).ok);
      expect(ok.filter(Boolean), l.part).toHaveLength(1);
      expect(ok.indexOf(true), l.part).toBe(l.answer);
    }
    expect(lab('reg-7805', 'use').outcome(0).says).toMatch(/5 V in gives 3\.00 V out/);
    expect(lab('ldo-ams1117', 'use').outcome(2).says).toMatch(/too hot/);
  });

  it('lands the pot on 2.5 V at half-turn', () => {
    const l = lab('potentiometer', 'dial');
    expect(dialVolts(l, 0.5)).toBeGreaterThan(l.target[0]);
    expect(dialVolts(l, 0.5)).toBeLessThan(l.target[1]);
    expect(dialVolts(l, 0)).toBeCloseTo(5, 2);
    expect(dialVolts(l, 1)).toBeCloseTo(0, 2);
  });

  it('asks to identify parts that really are on each 3D board', () => {
    for (const l of LABS.filter((x): x is Extract<LabSpec, { kind: 'identify' }> => x.kind === 'identify')) {
      const b = BOARDS.find((x) => x.id === l.board);
      expect(b, l.part).toBeDefined();
      expect(b!.parts.some((p) => p.id === l.target), `${l.part}: ${l.target} on ${l.board}`).toBe(true);
      expect(MODELS[`board:${l.board}`]).toBeDefined();
    }
  });

  it('names legs left to right as the 3D model shows them, and the marked leg is the answer', () => {
    for (const [part, look] of Object.entries(LOOKS)) {
      const l = LABS.find((x) => x.part === part);
      expect(l, part).toBeDefined();
      if (!look.legsX) continue;
      expect(l!.kind, part).toBe('pins');
      const p = l as Extract<LabSpec, { kind: 'pins' }>;
      expect(look.legsX.length, part).toBe(p.legs.length);
      const xs = look.legsX.map((x) => seenX(look, x));
      expect([...xs].sort((a, b) => a - b), `${part}: legs left to right`).toEqual(xs);
      if (look.markX !== undefined) expect(look.legsX.indexOf(look.markX), `${part}: the marked leg`).toBe(p.answer);
    }
  });

  it('puts the BC547’s emitter on the right with its flat face towards you, as on the real part', () => {
    const l = lab('npn-bc547', 'pins');
    // Base-emitter is the slightly higher reading; the emitter is leg 3, the right-hand one.
    expect(labReading(l, 'diode', 1, 2).value!).toBeGreaterThan(labReading(l, 'diode', 1, 0).value!);
    expect(seenX(LOOKS['npn-bc547']!, LOOKS['npn-bc547']!.legsX![2]!)).toBeGreaterThan(0);
  });

  it('has one right answer among distinct options when you read a marking', () => {
    for (const l of LABS.filter((x): x is Extract<LabSpec, { kind: 'read' }> => x.kind === 'read')) {
      expect(new Set(l.options).size).toBe(l.options.length);
      expect(l.answer).toBeGreaterThanOrEqual(0);
      expect(l.answer).toBeLessThan(l.options.length);
    }
  });
});
