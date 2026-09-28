import { describe, expect, it } from 'vitest';
import { NetlistError, parseNetlist, parseValue } from '../src/sim';

describe('parseValue', () => {
  it.each([
    ['330', 330],
    ['4.7k', 4700],
    ['100u', 100e-6],
    ['100µF', 100e-6],
    ['1M', 1e6],
    ['2.2meg', 2.2e6],
    ['10mA', 0.01],
    ['1e-3', 0.001],
    ['-5', -5],
  ])('%s -> %d', (text, expected) => {
    expect(parseValue(text)).toBeCloseTo(expected, 12);
  });

  it('rejects garbage', () => {
    expect(() => parseValue('abc')).toThrow();
  });
});

describe('parseNetlist', () => {
  it('parses every component type and ignores comments', () => {
    const c = parseNetlist(`
      * a comment
      V1 vcc 0 dc 9
      R1 vcc a 330   # inline comment
      LED1 a b green imax=20m
      D1 b c vf=0.3
      C1 c 0 10u v0=1
      S1 c d open
      W1 d 0
      I1 0 d 1m
    `);
    expect(c.components.map((x) => x.kind)).toEqual([
      'vsource', 'resistor', 'diode', 'diode', 'capacitor', 'switch', 'wire', 'isource',
    ]);
    const led = c.components[2]!;
    expect(led.kind === 'diode' && led.vf).toBe(2.2);
    expect(led.kind === 'diode' && led.maxAmps).toBeCloseTo(0.02);
  });

  it('reports the line number of an error', () => {
    try {
      parseNetlist('V1 a 0 5\nX1 a 0 1');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(NetlistError);
      expect((e as NetlistError).line).toBe(2);
    }
  });

  it('rejects duplicate names and zero resistors', () => {
    expect(() => parseNetlist('R1 a 0 1k\nR1 a 0 2k')).toThrow(/duplicate/);
    expect(() => parseNetlist('R1 a 0 0')).toThrow(/greater than 0/);
  });
});
