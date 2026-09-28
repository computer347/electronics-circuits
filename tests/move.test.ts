import { describe, expect, it } from 'vitest';
import { connectedGroup, holeAt, translateParts } from '../src/breadboard/move';
import { hole } from '../src/breadboard/layout';
import type { BoardPart } from '../src/breadboard/model';

const parts: BoardPart[] = [
  { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'j3' },
  { id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g8', ohms: 330 },
  { id: 'LED1', kind: 'led', h1: 'h8', h2: 'h10', color: 'red' },
  { id: 'W2', kind: 'wire', h1: 'j10', h2: 'T-:9' },
  { id: 'R9', kind: 'resistor', h1: 'a20', h2: 'a24', ohms: 1000 }, // separate island
];

describe('connectedGroup', () => {
  it('collects everything joined through strips, but not through rails', () => {
    expect(connectedGroup(parts, 'R1').sort()).toEqual(['LED1', 'R1', 'W1', 'W2']);
    expect(connectedGroup(parts, 'R9')).toEqual(['R9']);
  });
});

describe('translateParts', () => {
  it('moves one part by a hole offset', () => {
    const r = translateParts(parts, ['R9'], 'a20', 'b21', 'single');
    expect(r.valid).toBe(true);
    expect(r.parts.find((p) => p.id === 'R9')).toMatchObject({ h1: 'b21', h2: 'b25' });
  });

  it('rejects moves off the board', () => {
    const r = translateParts(parts, ['R9'], 'a20', 'a28', 'single');
    expect(r.valid).toBe(false);
  });

  it('rejects landing in a hole that is in use', () => {
    const r = translateParts(parts, ['R9'], 'a24', 'h10', 'single');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/in use/);
  });

  it('group move keeps rail legs plugged in and shifts the rest', () => {
    const ids = connectedGroup(parts, 'R1');
    const r = translateParts(parts, ids, 'g3', 'g5', 'group');
    expect(r.valid).toBe(true);
    const byId = Object.fromEntries(r.parts.map((p) => [p.id, p]));
    expect(byId.W1).toMatchObject({ h1: 'T+:3', h2: 'j5' });
    expect(byId.R1).toMatchObject({ h1: 'g5', h2: 'g10' });
    expect(byId.LED1).toMatchObject({ h1: 'h10', h2: 'h12' });
    expect(byId.W2).toMatchObject({ h1: 'j12', h2: 'T-:9' });
  });

  it('can move across the centre gap', () => {
    const r = translateParts(parts, ['R9'], 'a20', 'f20', 'single');
    // a -> f is 4 rows up plus the gap; there is a hole there
    expect(r.valid).toBe(true);
    expect(holeAt(hole('f20').x, hole('f20').z)).toBe('f20');
  });
});
