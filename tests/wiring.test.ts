import { describe, expect, it } from 'vitest';
import { correctWires, DHT11_JOB as JOB, OLED_WIRING_JOB, powerUp, WIRING_JOBS, wireColor, wiringSpots, type Wire } from '../src/wiring/wiring';

const { module, board } = wiringSpots(JOB);
const m = (label: string) => module.find((s) => s.label === `${label} pin`)!.id;
const b = (label: string, header?: string) => board.find((s) => s.label === `${label} pin` && (!header || s.id.startsWith(`b:${header}.`)))!.id;
const RIGHT: Wire[] = [{ from: m('+'), to: b('5V') }, { from: m('−'), to: b('GND', 'H_PWR') }, { from: m('OUT'), to: b('2') }];

describe('the DHT11 module and the Uno', () => {
  it('lists the module’s three pins and every header pin on the Uno', () => {
    expect(module.map((s) => s.label)).toEqual(['+ pin', 'OUT pin', '− pin']);
    expect(board.some((s) => s.label === '2 pin' && s.net === 'D2')).toBe(true);
    expect(board.filter((s) => s.net === 'GND').length).toBeGreaterThanOrEqual(3);
  });

  it('works with + to 5V, − to GND and OUT to pin 2, with 5 V across the sensor', () => {
    const r = powerUp(JOB, RIGHT);
    expect(r.outcome).toBe('ok');
    expect(r.supply).toBeCloseTo(5, 1);
    expect(r.serial[0]).toBe('Humidity: 45.00%  Temperature: 23.00°C');
  });

  it('also works from 3.3 V, and from any GND pin', () => {
    expect(powerUp(JOB, [{ from: m('+'), to: b('3.3V') }, { from: m('−'), to: b('GND', 'H_DIG1') }, RIGHT[2]!]).outcome).toBe('ok');
  });

  it('cooks the sensor with + and − swapped', () => {
    const r = powerUp(JOB, [{ from: m('+'), to: b('GND', 'H_PWR') }, { from: m('−'), to: b('5V') }, RIGHT[2]!]);
    expect(r.outcome).toBe('reversed');
    expect(r.supply).toBeCloseTo(-5, 1);
  });

  it('prints the library’s failure line when OUT is on the wrong pin, and says which pin the sketch wants', () => {
    const r = powerUp(JOB, [RIGHT[0]!, RIGHT[1]!, { from: m('OUT'), to: b('3') }]);
    expect(r.outcome).toBe('no-read');
    expect(r.serial[0]).toBe('Failed to read from DHT sensor!');
    expect(r.why).toMatch(/goes to pin 3, but the sketch reads pin 2/);
  });

  it('explains a missing ground, a missing +, and VIN being dead on USB', () => {
    expect(powerUp(JOB, [RIGHT[0]!, RIGHT[2]!]).why).toMatch(/− isn’t wired/);
    expect(powerUp(JOB, [RIGHT[1]!, RIGHT[2]!]).why).toMatch(/\+ isn’t wired/);
    expect(powerUp(JOB, [{ from: m('+'), to: b('VIN') }, RIGHT[1]!, RIGHT[2]!]).why).toMatch(/VIN is only live/);
  });

  it('colour-codes wires by what the pin carries', () => {
    expect(wireColor(JOB, m('+'))).toBe('#e8413c');
    expect(wireColor(JOB, m('−'))).toBe('#1c1c1e');
    expect(wireColor(JOB, m('OUT'))).toBe('#ffd21f');
  });

  it('every wiring job has a goal that matters and three hints, and fails unwired', () => {
    for (const j of WIRING_JOBS) {
      expect(j.skill.length).toBeGreaterThan(25);
      expect(j.realLife.length).toBeGreaterThan(60);
      expect(j.hints).toHaveLength(3);
      expect(powerUp(j, []).outcome).toBe('no-read');
    }
  });
});

describe('the OLED on I²C', () => {
  const { module: om, board: ob } = wiringSpots(OLED_WIRING_JOB);
  const pin = (label: string) => om.find((s) => s.label === `${label} pin`)!.id;
  const to = (label: string, header?: string) => ob.find((s) => s.label === `${label} pin` && (!header || s.id.startsWith(`b:${header}.`)))!.id;
  const right = correctWires(OLED_WIRING_JOB);

  it('finds the screen at 0x3C with GND, VCC to 5V, SCL to A5 and SDA to A4', () => {
    const r = powerUp(OLED_WIRING_JOB, right);
    expect(r.outcome).toBe('ok');
    expect(r.supply).toBeCloseTo(5, 1);
    expect(r.serial).toContain('I2C device found at address 0x3C  !');
  });

  it('also works on the SDA and SCL pins by AREF: on the Uno R3 they are A4 and A5', () => {
    const wires = [right[0]!, right[1]!, { from: pin('SCL'), to: to('SCL') }, { from: pin('SDA'), to: to('SDA') }];
    expect(powerUp(OLED_WIRING_JOB, wires).outcome).toBe('ok');
  });

  it('says so when SDA and SCL are swapped, or one goes to a digital pin', () => {
    const swapped = [right[0]!, right[1]!, { from: pin('SCL'), to: to('A4') }, { from: pin('SDA'), to: to('A5') }];
    const r = powerUp(OLED_WIRING_JOB, swapped);
    expect(r.outcome).toBe('no-read');
    expect(r.serial).toContain('No I2C devices found');
    expect(r.why).toMatch(/swapped/);
    expect(powerUp(OLED_WIRING_JOB, [right[0]!, right[1]!, right[2]!, { from: pin('SDA'), to: to('4') }]).why).toMatch(/SDA goes to pin 4/);
  });

  it('also runs from 3.3 V (the module has its own regulator), and colours SDA blue', () => {
    expect(powerUp(OLED_WIRING_JOB, [right[0]!, { from: pin('VCC'), to: to('3.3V') }, right[2]!, right[3]!]).outcome).toBe('ok');
    expect(wireColor(OLED_WIRING_JOB, pin('SDA'))).toBe('#3a8bff');
  });
});
