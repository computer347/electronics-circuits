import { describe, expect, it } from 'vitest';
import { solve } from '../src/sim';
import { toCircuit, type Schematic } from '../src/schematic/model';

const divider: Schematic = {
  parts: [
    { kind: 'vsource', id: 'V1', p1: [0, 0], p2: [0, 4], volts: 9 },
    { kind: 'wire', id: 'W1', p1: [0, 0], p2: [3, 0] },
    { kind: 'resistor', id: 'R1', p1: [3, 0], p2: [3, 2], ohms: 1000 },
    { kind: 'resistor', id: 'R2', p1: [3, 2], p2: [3, 4], ohms: 2000 },
    { kind: 'wire', id: 'W2', p1: [3, 4], p2: [0, 4] },
    { kind: 'wire', id: 'W3', p1: [3, 2], p2: [5, 2] },
  ],
  grounds: [[0, 4]],
  labels: [{ at: [5, 2], name: 'out' }],
};

describe('schematic -> circuit', () => {
  it('joins parts that share grid points, merges wires, names ground and labels', () => {
    const { circuit, nodeAt } = toCircuit(divider);
    expect(circuit.components.map((c) => c.id)).toEqual(['V1', 'R1', 'R2']);
    const r2 = circuit.components.find((c) => c.id === 'R2')!;
    expect(r2.a).toBe('out');
    expect(r2.b).toBe('0');
    expect(nodeAt([0, 4])).toBe('0');
    expect(nodeAt([3, 2])).toBe('out');
    expect(nodeAt([9, 9])).toBeUndefined();
    expect(solve(circuit).nodeVoltages.out).toBeCloseTo(6, 6);
  });

  it('finds junctions where three or more part ends meet', () => {
    const { junctions } = toCircuit(divider);
    expect(junctions).toEqual([[3, 2]]);
  });

  it('can keep wires as components (for the electron view)', () => {
    const { circuit } = toCircuit(divider, { mergeWires: false });
    expect(circuit.components.filter((c) => c.kind === 'wire')).toHaveLength(3);
    expect(solve(circuit).nodeVoltages[toCircuit(divider, { mergeWires: false }).nodeAt([5, 2])!]).toBeCloseTo(6, 4);
  });

  it('a wire drawn across the battery is detected as a short', () => {
    const shorted: Schematic = {
      ...divider,
      parts: [...divider.parts, { kind: 'wire', id: 'W9', p1: [0, 0], p2: [0, 4] }],
    };
    const r = solve(toCircuit(shorted).circuit);
    expect(r.ok).toBe(false);
    expect(r.faults.map((f) => f.kind)).toContain('short-circuit');
  });
});
