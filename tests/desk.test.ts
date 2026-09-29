import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardState } from '../src/breadboard/model';
import { useBench } from '../src/breadboard/store';
import { buildMap } from '../src/circuitworld/map';
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
