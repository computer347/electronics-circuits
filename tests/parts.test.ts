import { describe, expect, it } from 'vitest';
import { formatSI } from '../src/lib/units';
import { CATALOGUE } from '../src/parts/catalogue';
import { ARDUINO_UNO, BOARDS, tooltip } from '../src/parts3d/boards';
import { MODELS } from '../src/parts3d/registry';

describe('parts catalogue', () => {
  it('gives every part a model, a job and at least one fact', () => {
    for (const p of CATALOGUE) {
      expect(MODELS[p.model], p.id).toBeDefined();
      expect(p.job.length, p.id).toBeGreaterThan(10);
      expect(p.facts.length, p.id).toBeGreaterThan(0);
    }
    expect(new Set(CATALOGUE.map((p) => p.id)).size).toBe(CATALOGUE.length);
  });

  it('includes the microcontroller boards the course needs', () => {
    const ids = CATALOGUE.map((p) => p.id);
    for (const id of ['arduino-uno', 'esp32-devkit', 'esp-01', 'blue-pill']) expect(ids).toContain(id);
  });
});

describe('boards', () => {
  it('has unique part ids on every board, all inside the outline', () => {
    for (const b of BOARDS) {
      expect(new Set(b.parts.map((p) => p.id)).size, b.id).toBe(b.parts.length);
      for (const p of b.parts) {
        expect(Math.abs(p.at[0]), `${b.id} ${p.id}`).toBeLessThanOrEqual(b.w / 2 + 6);
        expect(Math.abs(p.at[1]), `${b.id} ${p.id}`).toBeLessThanOrEqual(b.d / 2 + 6);
      }
    }
  });

  it('writes tooltips like the reference: value, tolerance and the range', () => {
    const r = ARDUINO_UNO.parts.find((p) => p.id === 'R_ON')!;
    expect(tooltip(r, formatSI)).toBe('Resistor 0603 · power LED · 1 kΩ ±5 % · 950 Ω–1.05 kΩ');
    const led = ARDUINO_UNO.parts.find((p) => p.id === 'LED_ON')!;
    expect(tooltip(led, formatSI)).toBe('Power LED (ON)');
  });
});
