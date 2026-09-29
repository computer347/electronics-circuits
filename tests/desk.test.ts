import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardState } from '../src/breadboard/model';
import { useBench } from '../src/breadboard/store';
import { buildMap } from '../src/circuitworld/map';
import { followingLevel, isUnlocked, nextLevel } from '../src/desk/levelPick';
import { meteredBoard, nextMode, readMeter, type MeterMode } from '../src/desk/meter';
import { PARTS, spreads } from '../src/desk/notebook';
import { partInfo } from '../src/desk/partInfo';
import { makeDrill } from '../src/drills/generators';
import { taskPage } from '../src/desk/taskPages';
import { TOUR } from '../src/desk/tour';
import { parText, starRules } from '../src/desk/starRules';
import type { RunStats } from '../src/levels/check';
import { measurementsNow, useDesk } from '../src/desk/store';
import { canSubmit, currentStep, FRESH, glowing, mainAction, railStates } from '../src/desk/steps';
import { startingBoard, WORLD0 } from '../src/levels';
import { useProgress } from '../src/levels/progress';
import { useSession } from '../src/levels/session';

const L2 = WORLD0[1]!;

describe('desk step rules', () => {
  it('goes notebook → breadboard → meter → clear, one glowing object at a time', () => {
    let p = { ...FRESH };
    expect(currentStep(p)).toBe('task');
    expect(glowing(p)).toBe('notebook');
    p = { ...p, readTask: true };
    expect(glowing(p)).toBe('breadboard');
    p = { ...p, built: true };
    expect(glowing(p)).toBe('meter');
    expect(railStates(p)).toEqual({ task: 'done', build: 'done', test: 'current', clear: 'future' });
    p = { ...p, measurements: 1, submitted: true };
    expect(currentStep(p)).toBe('clear');
    p = { ...p, cleared: true };
    expect(currentStep(p)).toBe('done');
    expect(glowing(p)).toBe('corkboard');
  });

  it('only lets you submit after a measurement', () => {
    const p = { ...FRESH, readTask: true, built: true };
    expect(canSubmit(p)).toBe(false);
    expect(mainAction(p, 'meter')).toEqual({ kind: 'submit', label: 'Measure first', enabled: false });
    expect(mainAction({ ...p, measurements: 2 }, 'meter')).toEqual({ kind: 'submit', label: 'Submit', enabled: true });
  });

  it('points the main button at the next object when nothing is in focus', () => {
    expect(mainAction(FRESH, null)).toMatchObject({ kind: 'focus', object: 'notebook' });
    expect(mainAction({ ...FRESH, readTask: true }, null)).toMatchObject({ kind: 'focus', object: 'breadboard' });
    expect(mainAction(FRESH, 'notebook')).toMatchObject({ kind: 'close-notebook' });
    // Looking ahead at a future step's object just offers the way back.
    expect(mainAction(FRESH, 'meter')).toMatchObject({ kind: 'back' });
  });
});

describe('circuit map', () => {
  const map = (b: BoardState) => buildMap(b, analyzeBoard(b));

  it('lays level 0–2 out as a loop with the LED as a one-way door facing the wrong way', () => {
    const m = map(startingBoard(L2));
    expect(m.loop.map((r) => r.id)).toEqual(['SUPPLY', 'R1', 'LED1']);
    expect(m.closed).toBe(true);
    expect(m.corridors).toHaveLength(3);
    const led = m.loop[2]!;
    expect(led.forward).toBe(false);
    expect(led.fault).toBe('reversed');
    expect(led.lit).toBe(false);
    expect(m.faults).toEqual(['LED1']);
    // The scan: 5 V on the side the current arrives at, 0 V beyond, nothing flowing.
    expect(led.vIn).toBeCloseTo(5, 2);
    expect(led.vOut).toBeCloseTo(0, 2);
    expect(m.amps).toBe(0);
  });

  it('clears once the door is turned round, and the current goes round', () => {
    const b = startingBoard(L2);
    b.parts = b.parts.map((p) => (p.id === 'LED1' ? { ...p, h1: p.h2, h2: p.h1 } : p));
    const m = map(b);
    expect(m.faults).toEqual([]);
    expect(m.loop[2]).toMatchObject({ forward: true, lit: true });
    expect(m.amps * 1000).toBeCloseTo(20, 0); // (5 − 2) V / 150 Ω
  });

  it('marks a burnt LED as a scorched room', () => {
    const b = startingBoard(L2);
    b.parts = b.parts.map((p) => (p.id === 'LED1' ? { ...p, h1: p.h2, h2: p.h1, burnt: true } : p));
    expect(map(b).loop.find((r) => r.id === 'LED1')?.fault).toBe('burnt');
  });

  it('leaves the loop open when a part is missing', () => {
    const b = startingBoard(L2);
    b.parts = b.parts.filter((p) => p.id !== 'R1');
    const m = map(b);
    expect(m.closed).toBe(false);
    expect(m.loop.map((r) => r.id)).toEqual(['SUPPLY']);
  });
});

describe('playing level 0–2 on the desk', () => {
  beforeEach(() => { useDesk.getState().leave(); useProgress.getState().reset(); });

  it('reads, measures, submits, fixes inside and scores', () => {
    const desk = () => useDesk.getState();
    desk().enter(L2.id);
    desk().focusOn('notebook');
    desk().closeNotebook();
    desk().focusOn('breadboard');
    desk().doneBuilding();
    desk().focusOn('meter');
    expect(useBench.getState().tool).toBe('probe');
    expect(desk().submit()).toBe(false);
    useBench.getState().clickHole('T-:5');
    useBench.getState().clickHole('h12');
    expect(measurementsNow()).toBe(1);
    expect(desk().submit()).toBe(true);
    expect(desk().phase).toBe('power');
    // Inside the circuit: turn the door round.
    useBench.getState().flipPart('LED1');
    const attempt = desk().finishClear();
    expect(attempt?.check.pass).toBe(true);
    expect(attempt?.stars).toBeGreaterThanOrEqual(2);
    expect(desk().flags.cleared).toBe(true);
    expect(useProgress.getState().levels[L2.id]).toBeTruthy();
    desk().leave();
    expect(useSession.getState().levelId).toBeNull();
  });
});

describe('multimeter modes', () => {
  const fixedL2 = () => {
    const b = startingBoard(L2);
    b.parts = b.parts.map((p) => (p.id === 'LED1' ? { ...p, h1: p.h2, h2: p.h1 } : p));
    return b;
  };
  const read = (b: BoardState, mode: MeterMode, red: string, black: string) => {
    const probes = { red, black };
    const a = analyzeBoard(meteredBoard(b, mode, probes));
    return readMeter(b, mode, probes, { ok: a.result.ok, voltageAt: a.voltageAt, currents: a.result.currents });
  };

  it('reads volts between the probes', () => {
    const r = read(startingBoard(L2), 'V', 'h12', 'T-:5');
    expect(r.value).toBeCloseTo(5, 2);
    expect(r.unit).toBe('V');
  });

  it('reads a resistor in ohms with the power taken out', () => {
    const r = read(fixedL2(), 'Ω', 'g3', 'g12');
    expect(r.value).toBeCloseTo(150, 0);
    expect(r.text).toBe('150.0');
  });

  it('reads OL where there is no path, and through a diode', () => {
    expect(read(fixedL2(), 'Ω', 'a1', 'a5').text).toBe('OL');
    expect(read(fixedL2(), 'Ω', 'h12', 'h14').text).toBe('OL');
  });

  it('is a wire on A: across the LED it carries the loop current, across the supply it blows the fuse', () => {
    const r = read(fixedL2(), 'A', 'h12', 'h14');
    expect(r.unit).toBe('mA');
    expect(r.value! * 1000).toBeCloseTo(5 / 150 * 1000, 0);
    expect(read(fixedL2(), 'A', 'T+:2', 'T-:2').text).toBe('FUSE');
  });

  it('shows nothing when switched off', () => {
    expect(read(fixedL2(), 'off', 'h12', 'h14').text).toBe('');
  });
});

describe('every World 0 level on the desk', () => {
  const L1 = WORLD0[0]!, L5 = WORLD0[4]!;
  const map = (b: BoardState) => buildMap(b, analyzeBoard(b));

  it('opens levels in order and suggests the next one', () => {
    expect(isUnlocked(1, {})).toBe(true);
    expect(isUnlocked(2, {})).toBe(false);
    const rec = { [L1.id]: { stars: 2 as const, seconds: 30, firstPassed: '2026-09-29' } };
    expect(isUnlocked(2, rec)).toBe(true);
    expect(nextLevel({})).toBe(L1.id);
    expect(nextLevel(rec)).toBe(L2.id);
    expect(followingLevel(L1.id, rec)).toBe(L2.id);
    expect(followingLevel(L2.id, rec)).toBeNull();
  });

  it('has a notebook page for every level: one sentence, the goal, a tip and a picture', () => {
    for (const l of WORLD0) {
      const p = taskPage(l);
      expect(p.headline.length).toBeLessThan(60);
      expect(p.goal).toBe(l.brief.goal);
      expect(p.tip.length).toBeGreaterThan(20);
      expect(['led', 'two-leds', 'divider', 'rc']).toContain(p.picture);
    }
  });

  it('shows a missing resistor as a loop that never closes (the broken bridge)', () => {
    const m = map(startingBoard(L1));
    expect(m.closed).toBe(false);
    expect(m.loop.map((r) => r.id)).toEqual(['SUPPLY']);
  });

  it('closes the loop once the resistor is in, and puts a bleed resistor in a side alcove', () => {
    const b1 = startingBoard(L1);
    b1.parts.push({ id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g12', ohms: 330 });
    expect(map(b1)).toMatchObject({ closed: true, faults: [] });
    const b5 = startingBoard(L5);
    b5.parts.push({ id: 'R1', kind: 'resistor', h1: 'i6', h2: 'i14', ohms: 10000 });
    const m5 = map(b5);
    expect(m5.closed).toBe(true);
    expect(m5.loop.map((r) => r.id)).toEqual(['SUPPLY', 'SW1', 'R1', 'C1']);
    expect(m5.side.map((r) => r.id)).toEqual(['R2']);
  });

  it('plays a build level through the desk: place, measure, submit, score', () => {
    useDesk.getState().leave();
    useProgress.getState().reset();
    const desk = () => useDesk.getState();
    const bench = () => useBench.getState();
    desk().enter(L1.id);
    desk().closeNotebook();
    desk().focusOn('breadboard');
    bench().setTool('resistor');
    bench().setOhms(330);
    bench().clickHole('g3');
    bench().clickHole('g12');
    desk().doneBuilding();
    desk().focusOn('meter');
    bench().clickHole('h12');
    bench().clickHole('T-:5');
    expect(desk().submit()).toBe(true);
    const a = desk().finishClear();
    expect(a?.check.pass).toBe(true);
    expect(nextLevel(useProgress.getState().levels)).toBe(L2.id);
    expect(mainAction({ ...FRESH, readTask: true, built: true, measurements: 1, submitted: true, cleared: true }, 'corkboard').kind).toBe('pick-level');
  });
});

describe('meter dial and part cards', () => {
  it('clicks round every mode on the dial, wrapping', () => {
    const seen: string[] = [];
    let m: MeterMode = 'V';
    for (let i = 0; i < 4; i++) { m = nextMode(m); seen.push(m); }
    expect(seen).toEqual(['Ω', 'A', 'off', 'V']);
    expect(nextMode('off', -1)).toBe('A');
  });

  it('says what an LED is doing in plain words, with the numbers underneath', () => {
    const b = startingBoard(L2);
    const a = analyzeBoard(b);
    const led = b.parts.find((p) => p.id === 'LED1')!;
    const info = partInfo(led, a);
    expect(info.tag).toBe('LED1');
    expect(info.state).toMatch(/backwards/);
    expect(info.tone).toBe('bad');
    const r = partInfo(b.parts.find((p) => p.id === 'R1')!, a);
    expect(r.tag).toBe('R1 · 150 Ω');
    expect(r.rows).toContainEqual(['Colour code', 'brown · green · brown']);
    const fixed = { ...b, parts: b.parts.map((p) => (p.id === 'LED1' ? { ...p, h1: p.h2, h2: p.h1 } : p)) };
    const lit = partInfo(fixed.parts.find((p) => p.id === 'LED1')!, analyzeBoard(fixed));
    expect(lit.state).toBe('lit');
    expect(lit.rows.find(([k]) => k === 'Current through')?.[1]).toBe('20 mA');
  });
});

describe('notebook sections', () => {
  it('gives every level parts, theory steps and a check, then formulas, worked examples and practice', () => {
    for (const l of WORLD0) {
      const theory = spreads(l, 'theory');
      expect(theory[0]?.kind).toBe('part');
      expect(theory.some((s) => s.kind === 'step')).toBe(true);
      expect(theory.at(-1)?.kind).toBe('check');
      const math = spreads(l, 'math');
      expect(math[0]?.kind).toBe('formulas');
      expect(math.at(-1)?.kind).toBe('practice');
      for (const s of math) {
        if (s.kind === 'formulas') expect(s.formulas.length).toBeGreaterThan(0);
        // Worked examples are real drills: they build, and the solver agrees with the formula.
        if (s.kind === 'worked') {
          const d = makeDrill(s.generator, s.seed);
          expect(d.solution.length).toBeGreaterThan(1);
          expect(d.answer.value).toBeCloseTo(d.expected, 6);
        }
      }
      expect(spreads(l, 'task')).toEqual([]);
    }
  });

  it('explains each part with at least two callouts', () => {
    for (const p of Object.values(PARTS)) expect(p.facts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('bench tour', () => {
  it('visits each thing on the bench once, with a short card', () => {
    expect(new Set(TOUR.map((t) => t.id)).size).toBe(TOUR.length);
    for (const t of TOUR) {
      expect(t.text.length).toBeLessThan(260);
      expect(Number.isFinite(t.target.x + t.target.y + t.target.z)).toBe(true);
      expect(t.elevation).toBeGreaterThan(0);
    }
    useDesk.getState().setTour(2);
    useDesk.getState().focusOn('meter');
    expect(useDesk.getState().tour).toBeNull();
  });
});

describe('stars and hints on the desk', () => {
  const stats = (o: Partial<RunStats> = {}): RunStats => ({ hintsUsed: 0, measurements: 2, burnt: 0, checks: 1, partsAdded: 0, seconds: 40, ...o });

  it('spells out what each star takes and why one was missed', () => {
    expect(parText(L2)).toBe('1 try · 2 measurements · 0 parts added');
    expect(starRules(L2, stats(), true).map((r) => r.met)).toEqual([true, true, true]);
    const hinted = starRules(L2, stats({ hintsUsed: 1 }), true);
    expect(hinted.map((r) => r.met)).toEqual([true, false, false]);
    expect(hinted[1]!.detail).toBe('1 hint used');
    const slow = starRules(L2, stats({ measurements: 5 }), true);
    expect(slow[2]!.met).toBe(false);
    expect(slow[2]!.detail).toMatch(/you took 5 measurements/);
    expect(starRules(L2, stats(), false).every((r) => !r.met)).toBe(true);
  });

  it('a hint used at the desk costs the second star', () => {
    useDesk.getState().leave();
    useProgress.getState().reset();
    useDesk.getState().enter(L2.id);
    useSession.getState().showHint();
    useBench.getState().setTool('probe');
    useBench.getState().clickHole('h12');
    useBench.getState().clickHole('T-:5');
    useDesk.setState((s) => ({ flags: { ...s.flags, readTask: true, built: true } }));
    expect(useDesk.getState().submit()).toBe(true);
    useBench.getState().flipPart('LED1');
    expect(useDesk.getState().finishClear()?.stars).toBe(1);
  });
});

describe('free bench', () => {
  it('leaves the level, keeps the sandbox board, and scores nothing', () => {
    useDesk.getState().leave();
    useBench.getState().load({ supply: { volts: 9, on: true }, parts: [{ id: 'MINE', kind: 'wire', h1: 'a1', h2: 'a5' }] });
    useDesk.getState().enter(L2.id);
    expect(useBench.getState().parts.some((p) => p.id === 'MINE')).toBe(false);
    useDesk.getState().enterSandbox();
    expect(useDesk.getState().mode).toBe('sandbox');
    expect(useSession.getState().levelId).toBeNull();
    expect(useBench.getState().parts.map((p) => p.id)).toEqual(['MINE']);
    expect(useBench.getState().locked).toEqual([]);
    // Picking a level from the corkboard goes back to level mode.
    useDesk.getState().enter(L2.id);
    expect(useDesk.getState().mode).toBe('level');
    useDesk.getState().leave();
  });

  it('puts the scope probes on in the scope view', () => {
    useDesk.getState().focusOn('scope');
    expect(useBench.getState().tool).toBe('scope');
    expect(mainAction(FRESH, 'scope').kind).toBe('back');
    useDesk.getState().focusOn(null);
  });
});
