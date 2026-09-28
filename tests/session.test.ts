import { beforeEach, describe, expect, it } from 'vitest';
import { useBench } from '../src/breadboard/store';
import { WORLD0 } from '../src/levels';
import { useProgress } from '../src/levels/progress';
import { useSession } from '../src/levels/session';

const L1 = WORLD0[0]!;
const bench = () => useBench.getState();
const session = () => useSession.getState();

/** Place a resistor the way two clicks on the board would. */
function placeResistor(ohms: number, a = 'g3', b = 'g12') {
  bench().setTool('resistor');
  bench().setOhms(ohms);
  bench().clickHole(a);
  bench().clickHole(b);
}

describe('playing a level', () => {
  beforeEach(() => {
    session().exit();
    useProgress.getState().reset();
    bench().load({ supply: { volts: 5, on: true }, parts: [{ id: 'SANDBOX1', kind: 'wire', h1: 'a1', h2: 'a5' }] });
  });

  it('loads the level board, locks its parts, and puts the sandbox back on exit', () => {
    session().start(L1.id);
    expect(bench().parts.map((p) => p.id)).toEqual(['W1', 'LED1', 'W2']);
    expect(bench().supply.volts).toBe(9);
    bench().select('LED1');
    bench().removeSelected();
    expect(bench().parts.some((p) => p.id === 'LED1')).toBe(true);
    expect(bench().notice).toMatch(/belongs to the level/);
    session().exit();
    expect(bench().parts.map((p) => p.id)).toEqual(['SANDBOX1']);
    expect(bench().locked).toEqual([]);
  });

  it('a clean first-try pass earns gold and is saved', () => {
    session().start(L1.id);
    placeResistor(330);
    const a = session().check()!;
    expect(a.check.pass).toBe(true);
    expect(a.stars).toBe(3);
    expect(useProgress.getState().levels[L1.id]?.stars).toBe(3);
  });

  it('a failed check first costs gold; a hint costs silver', () => {
    session().start(L1.id);
    expect(session().check()!.check.pass).toBe(false);
    placeResistor(470);
    expect(session().check()!.stars).toBe(2);
    session().restart();
    session().showHint();
    placeResistor(470);
    expect(session().check()!.stars).toBe(1);
    // the saved record keeps the best
    expect(useProgress.getState().levels[L1.id]?.stars).toBe(2);
  });

  it('burning the LED costs a spare and the silver star', () => {
    session().start(L1.id);
    placeResistor(220);
    // what the bench does when the solve says the LED is overloaded
    bench().markBurnt(['LED1']);
    expect(bench().notice).toMatch(/LED1 burnt out/);
    bench().updatePart('R1', { ohms: 330 });
    bench().replaceLed('LED1');
    expect(bench().spares).toBe(1);
    const a = session().check()!;
    expect(a.check.pass).toBe(true);
    expect(a.stars).toBe(1);
  });

  it('runs out of spare LEDs', () => {
    session().start(L1.id);
    for (let i = 0; i < 2; i++) { bench().markBurnt(['LED1']); bench().replaceLed('LED1'); }
    bench().markBurnt(['LED1']);
    bench().replaceLed('LED1');
    expect(bench().spares).toBe(0);
    expect(bench().parts.find((p) => p.id === 'LED1')!.burnt).toBe(true);
    expect(bench().notice).toMatch(/No spare LEDs left/);
    session().restart();
    expect(bench().spares).toBe(2);
    expect(bench().parts.find((p) => p.id === 'LED1')!.burnt).toBeFalsy();
  });
});
