import { describe, expect, it } from 'vitest';
import { buildFlow } from '../src/breadboard/flow';
import { analyzeBoard, type BoardState } from '../src/breadboard/model';
import { describeStop, isStopEdge, lapText, summarizeLap } from '../src/breadboard/rideStops';
import { WORLD0 } from '../src/levels';

// Level 1, solved with 330 Ω: 21.2 mA, 7.0 V across R1, 2.0 V across LED1
const board: BoardState = { ...WORLD0[0]!.board, parts: [...WORLD0[0]!.board.parts, { id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g12', ohms: 330 }] };
const analysis = analyzeBoard(board);
const edges = buildFlow(board, analysis);
const edge = (id: string) => edges.find((e) => e.id === id)!;
const part = (id: string) => board.parts.find((p) => p.id === id);

describe('step-by-step ride', () => {
  it('stops at the supply, resistors and LEDs, not at wires or strips', () => {
    const stops = edges.filter(isStopEdge).map((e) => e.id).sort();
    expect(stops).toEqual(['LED1', 'R1', 'SUPPLY']);
  });

  it('explains the resistor with Ohm\'s law and the real numbers', () => {
    const { stop, entry } = describeStop(edge('R1'), part('R1'), analysis, 2, false);
    expect(stop.kicker).toBe('Stop 2 · Resistor');
    expect(stop.title).toBe('R1 · 330 Ω');
    expect(stop.body).toMatch(/loses 7 V of energy, which comes out as heat/);
    expect(Object.fromEntries(stop.figures)).toMatchObject({ Current: '21.2 mA', 'Voltage across': '7 V', "Ohm's law": '21.2 mA × 330 Ω = 7 V' });
    expect(entry).toMatchObject({ id: 'R1', kind: 'loss' });
  });

  it('explains the LED and the source', () => {
    const led = describeStop(edge('LED1'), part('LED1'), analysis, 3, false).stop;
    expect(led.body).toMatch(/gives up 2 V as red light/);
    const src = describeStop(edge('SUPPLY'), undefined, analysis, 1, false);
    expect(src.stop.title).toBe('Bench supply');
    expect(src.entry.kind).toBe('gain');
    expect(src.entry.volts).toBeCloseTo(9, 3);
    expect(describeStop(edge('SUPPLY'), undefined, analysis, 1, true).stop.body).toMatch(/lifts every bit of charge 9 V uphill/);
  });

  it('closes the lap with Kirchhoff\'s voltage law: 9 V in, 7 V + 2 V out', () => {
    const entries = ['SUPPLY', 'R1', 'LED1'].map((id) => describeStop(edge(id), part(id), analysis, 1, false).entry);
    const lap = summarizeLap(entries);
    expect(lap.gained).toBeCloseTo(9, 3);
    expect(lap.lost).toBeCloseTo(9, 3);
    expect(lap.losses.map((x) => x.id)).toEqual(['R1', 'LED1']);
    expect(lapText(lap)).toMatch(/Gained 9 V at the source, spent R1 7 V \+ LED1 2 V = 9 V.*Kirchhoff's voltage law/);
  });
});
