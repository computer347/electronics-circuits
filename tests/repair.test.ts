/**
 * Board repair against the Arduino Uno's own circuit: the probes read what a real Uno reads,
 * the fault shows up the way it does on the bench, and the rules of soldering hold.
 */
import { describe, expect, it } from 'vitest';
import { ARDUINO_UNO } from '../src/parts3d/boards';
import { NETLISTS, UNO_NETLIST, padSpots } from '../src/repair/netlists';
import { DEAD_POWER_LED as JOB, REPAIR_JOBS } from '../src/repair/jobs';
import { act, checkRepair, repairReading, repairStars, solveRepair, startRepair, type RepairAction, type RepairState } from '../src/repair/repair';
import type { MeterMode } from '../src/desk/meter';

const spots = padSpots(ARDUINO_UNO, UNO_NETLIST);
const pin = (header: string, label: string) => spots.find((s) => s.id.startsWith(`${header}.`) && s.label === `${label} pin`)!.id;
const GND = pin('H_PWR', 'GND'), V5 = pin('H_PWR', '5V'), V33 = pin('H_PWR', '3.3V'), RESET = pin('H_PWR', 'RESET');
const read = (s: RepairState, mode: MeterMode, red: string, black = GND) => repairReading(JOB, s, mode, red, black);
const run = (s: RepairState, ...actions: RepairAction[]) => actions.reduce((st, a) => act(JOB, st, a).state, s);

/** A good Uno: the job's board with the fault taken back out. */
const healthy = (): RepairState => ({ ...startRepair({ ...JOB, faults: [] }), power: true });

describe('Uno netlist', () => {
  it('puts every electrical part on the 3D board, with its pads inside the outline', () => {
    const ids = new Set(ARDUINO_UNO.parts.map((p) => p.id));
    for (const id of Object.keys(UNO_NETLIST.parts)) expect(ids.has(id), id).toBe(true);
    for (const s of spots) {
      expect(Math.abs(s.at[0]), s.id).toBeLessThan(ARDUINO_UNO.w / 2);
      expect(Math.abs(s.at[1]), s.id).toBeLessThan(ARDUINO_UNO.d / 2);
    }
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
  });

  it('places R_ON’s pads either side of it, 1.3 mm apart like a real 0603', () => {
    const [a, b] = [spots.find((s) => s.id === 'R_ON.1')!, spots.find((s) => s.id === 'R_ON.2')!];
    expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1])).toBeCloseTo(1.28, 2);
  });

  it('reads like a real Uno on USB: 5 V, 3.3 V, RESET pulled high, ON LED at about 3 mA', () => {
    const s = healthy();
    expect(read(s, 'V', V5).value).toBeCloseTo(5, 2);
    expect(read(s, 'V', V33).value).toBeCloseTo(3.3, 2);
    expect(read(s, 'V', RESET).value).toBeCloseTo(5, 2);
    const amps = solveRepair(JOB, s).currents['LED_ON']!;
    expect(amps * 1000).toBeCloseTo(3, 1);
    expect(checkRepair(JOB, s).pass).toBe(true);
  });

  it('has every board’s netlist tied to its 3D model', () => {
    for (const [id, b] of Object.entries(NETLISTS)) expect(b.def.id).toBe(id);
  });
});

describe('the dead power LED', () => {
  const faulty = () => run(startRepair(JOB), { kind: 'power', on: true });

  it('keeps the LED dark with R_ON open, though the board has its 5 V', () => {
    const s = faulty();
    expect(read(s, 'V', V5).value).toBeCloseTo(5, 2);
    expect(checkRepair(JOB, s)).toMatchObject({ pass: false, message: 'LED_ON is still dark.' });
  });

  it('shows the whole 5 V across the open resistor, and none across the LED', () => {
    const s = faulty();
    expect(read(s, 'V', 'R_ON.1', 'R_ON.2').value).toBeCloseTo(5, 1);
    expect(Math.abs(read(s, 'V', 'LED_ON.1', 'LED_ON.2').value!)).toBeLessThan(0.05);
  });

  it('reads OL on Ω with the power off, and refuses Ω on a live board', () => {
    const off = run(faulty(), { kind: 'power', on: false });
    expect(read(off, 'Ω', 'R_ON.1', 'R_ON.2').text).toBe('OL');
    expect(read(faulty(), 'Ω', 'R_ON.1', 'R_ON.2').text).toBe('Err');
  });

  it('reads a good R_ON as 1 kΩ in circuit, inside its tooltip range', () => {
    const s = { ...healthy(), power: false };
    const ohms = read(s, 'Ω', 'R_ON.1', 'R_ON.2').value!;
    expect(ohms).toBeGreaterThan(950);
    expect(ohms).toBeLessThan(1050);
  });

  it('finds the LED with the diode test: about 2 V one way, OL the other', () => {
    const s = { ...healthy(), power: false };
    expect(read(s, 'diode', 'LED_ON.1', 'LED_ON.2').value).toBeCloseTo(2, 1);
    expect(read(s, 'diode', 'LED_ON.2', 'LED_ON.1').text).toBe('OL');
  });

  it('won’t let you solder a live board', () => {
    const r = act(JOB, faulty(), { kind: 'desolder', part: 'R_ON' });
    expect(r.notice).toMatch(/Unplug the USB/);
    expect(r.state.fitted['R_ON']!.present).toBe(true);
  });

  it('is fixed by a 1 kΩ (102) soldered in, for three stars when measured first', () => {
    let s = faulty();
    s = run(s,
      { kind: 'measure', mode: 'V', red: 'R_ON.1', black: 'R_ON.2' },
      { kind: 'power', on: false },
      { kind: 'desolder', part: 'R_ON' },
      { kind: 'place', part: 'R_ON', spare: 'R102' },
    );
    // Sitting on its pads, not yet soldered: still dark.
    expect(checkRepair(JOB, run(s, { kind: 'power', on: true })).message).toMatch(/only sitting on its pads/);
    s = run(s, { kind: 'solder', part: 'R_ON' }, { kind: 'power', on: true });
    const c = checkRepair(JOB, s);
    expect(c.pass).toBe(true);
    expect(c.amps * 1000).toBeCloseTo(3, 1);
    expect(repairStars(JOB, s).stars).toBe(3);
  });

  it('burns the LED with a 100 Ω (101): 30 mA through a 20 mA LED', () => {
    const s = run(faulty(), { kind: 'power', on: false }, { kind: 'desolder', part: 'R_ON' }, { kind: 'place', part: 'R_ON', spare: 'R101' }, { kind: 'solder', part: 'R_ON' });
    const r = act(JOB, s, { kind: 'power', on: true });
    expect(r.notice).toMatch(/LED_ON burnt out/);
    expect(checkRepair(JOB, r.state).message).toMatch(/burnt out/);
    expect(repairStars(JOB, r.state).stars).toBe(1);
  });

  it('can recover from a burnt LED with the spare LED and the right resistor', () => {
    let s = run(faulty(), { kind: 'power', on: false }, { kind: 'desolder', part: 'R_ON' }, { kind: 'place', part: 'R_ON', spare: 'R101' }, { kind: 'solder', part: 'R_ON' }, { kind: 'power', on: true });
    s = run(s, { kind: 'power', on: false },
      { kind: 'desolder', part: 'R_ON' }, { kind: 'place', part: 'R_ON', spare: 'R102' }, { kind: 'solder', part: 'R_ON' },
      { kind: 'desolder', part: 'LED_ON' }, { kind: 'place', part: 'LED_ON', spare: 'LED-G' }, { kind: 'solder', part: 'LED_ON' },
      { kind: 'power', on: true });
    expect(checkRepair(JOB, s).pass).toBe(true);
  });

  it('is only dimly lit with a 10 kΩ (103): 0.3 mA', () => {
    const s = run(faulty(), { kind: 'power', on: false }, { kind: 'desolder', part: 'R_ON' }, { kind: 'place', part: 'R_ON', spare: 'R103' }, { kind: 'solder', part: 'R_ON' }, { kind: 'power', on: true });
    expect(checkRepair(JOB, s).message).toMatch(/dim: 0\.3 mA/);
  });

  it('refuses an LED on a resistor’s footprint', () => {
    const s = run(faulty(), { kind: 'power', on: false }, { kind: 'desolder', part: 'R_ON' });
    expect(act(JOB, s, { kind: 'place', part: 'R_ON', spare: 'LED-G' }).notice).toMatch(/footprint is for a resistor/);
  });

  it('gives two stars when you swap the part without measuring it first', () => {
    const s = run(faulty(), { kind: 'power', on: false }, { kind: 'desolder', part: 'R_ON' }, { kind: 'place', part: 'R_ON', spare: 'R102' }, { kind: 'solder', part: 'R_ON' }, { kind: 'power', on: true });
    expect(checkRepair(JOB, s).pass).toBe(true);
    expect(repairStars(JOB, s).stars).toBe(2);
  });
});

describe('repair jobs', () => {
  it('every job has a clear goal, a real-life reason and three hints, and its faults fit its board', () => {
    for (const j of REPAIR_JOBS) {
      expect(j.skill.length).toBeGreaterThan(25);
      expect(j.realLife.length).toBeGreaterThan(60);
      expect(j.hints).toHaveLength(3);
      expect(() => startRepair(j)).not.toThrow();
      // The fault really breaks it, and the right spare really fixes it.
      expect(checkRepair(j, { ...startRepair(j), power: true }).pass).toBe(false);
    }
  });
});
