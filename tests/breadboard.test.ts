import { describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardState } from '../src/breadboard/model';
import { colorBands } from '../src/breadboard/colorCode';
import { HOLES, hole } from '../src/breadboard/layout';

const ledCircuit = (extra: Partial<BoardState> = {}): BoardState => ({
  supply: { volts: 9, on: true },
  parts: [
    { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'j3' },
    { id: 'R1', kind: 'resistor', h1: 'f3', h2: 'f8', ohms: 330 },
    { id: 'LED1', kind: 'led', h1: 'g8', h2: 'g10', color: 'red' },
    { id: 'W2', kind: 'wire', h1: 'j10', h2: 'T-:9' },
  ],
  ...extra,
});

describe('breadboard layout', () => {
  it('has 300 main holes and 100 rail holes', () => {
    expect(HOLES).toHaveLength(400);
  });
  it('joins a–e and f–j in each column, but not across the gap', () => {
    expect(hole('a5').strip).toBe(hole('e5').strip);
    expect(hole('f5').strip).toBe(hole('j5').strip);
    expect(hole('e5').strip).not.toBe(hole('f5').strip);
    expect(hole('a5').strip).not.toBe(hole('a6').strip);
  });
});

describe('breadboard circuits', () => {
  it('LED + 330 ohm on 9 V: 21.2 mA through the LED', () => {
    const a = analyzeBoard(ledCircuit());
    expect(a.result.ok).toBe(true);
    expect(a.result.currents.LED1).toBeCloseTo(7 / 330, 5);
    expect(a.newlyBurnt).toEqual([]);
    expect(a.voltageAt('g8')).toBeCloseTo(2.0, 3);
  });

  it('a resistor with both legs in the same column does nothing', () => {
    const board = ledCircuit();
    board.parts[1] = { id: 'R1', kind: 'resistor', h1: 'f3', h2: 'h3', ohms: 330 };
    const a = analyzeBoard(board);
    expect(a.shortedParts).toContain('R1');
    expect(Math.abs(a.result.currents.LED1 ?? 0)).toBeLessThan(1e-9); // LED leg on column 8 is now unpowered
  });

  it('top and bottom rails are separate until jumpered', () => {
    const board: BoardState = {
      supply: { volts: 5, on: true },
      parts: [{ id: 'R1', kind: 'resistor', h1: 'B+:1', h2: 'B-:1', ohms: 1000 }],
    };
    expect(Math.abs(analyzeBoard(board).result.currents.R1 ?? 0)).toBeLessThan(1e-9);
    board.parts.push({ id: 'W1', kind: 'wire', h1: 'T+:1', h2: 'B+:2' }, { id: 'W2', kind: 'wire', h1: 'T-:1', h2: 'B-:2' });
    expect(analyzeBoard(board).result.currents.R1).toBeCloseTo(0.005, 6);
  });

  it('an LED straight across the rails burns out', () => {
    const board: BoardState = {
      supply: { volts: 5, on: true },
      parts: [{ id: 'LED1', kind: 'led', h1: 'T+:4', h2: 'T-:4', color: 'green' }],
    };
    expect(analyzeBoard(board).newlyBurnt).toEqual(['LED1']);
  });

  it('a burnt LED is an open circuit', () => {
    const board = ledCircuit();
    board.parts[2] = { ...board.parts[2]!, burnt: true };
    expect(Math.abs(analyzeBoard(board).result.currents.R1!)).toBeLessThan(1e-9);
  });

  it('push button only conducts while pressed', () => {
    const board = ledCircuit();
    board.parts.push({ id: 'SW1', kind: 'button', h1: 'j3', h2: 'j4', pressed: false });
    // Supply now goes T+ -> column 4 (lower) -> jumper up to column 4 (upper) -> button -> column 3 -> R1
    board.parts[0] = { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'a4' };
    board.parts.push({ id: 'W3', kind: 'wire', h1: 'e4', h2: 'i4' });
    expect(Math.abs(analyzeBoard(board).result.currents.LED1 ?? 0)).toBeLessThan(1e-9);
    board.parts[4] = { ...board.parts[4]!, pressed: true };
    expect(analyzeBoard(board).result.currents.LED1).toBeCloseTo(7 / 330, 4);
  });

  it('a wire across the rails is a short circuit', () => {
    const board = ledCircuit();
    board.parts.push({ id: 'W9', kind: 'wire', h1: 'T+:20', h2: 'T-:20' });
    const a = analyzeBoard(board);
    expect(a.result.ok).toBe(false);
    expect(a.result.faults.map((f) => f.kind)).toContain('short-circuit');
  });
});

describe('resistor colour code', () => {
  it.each([
    [330, ['orange', 'orange', 'brown', 'gold']],
    [4700, ['yellow', 'violet', 'red', 'gold']],
    [10_000, ['brown', 'black', 'orange', 'gold']],
    [1_000_000, ['brown', 'black', 'green', 'gold']],
    [47, ['yellow', 'violet', 'black', 'gold']],
    [2.2, ['red', 'red', 'gold', 'gold']],
  ])('%d ohm', (ohms, names) => {
    expect(colorBands(ohms).names).toEqual(names);
  });
});

import { useBench } from '../src/breadboard/store';

describe('bench interactions', () => {
  it('places a resistor with two clicks and removes it again', () => {
    const s = useBench.getState();
    s.clear();
    s.setTool('resistor');
    s.setOhms(470);
    s.clickHole('a1');
    expect(useBench.getState().pending).toBe('a1');
    s.clickHole('a5');
    const parts = useBench.getState().parts;
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ kind: 'resistor', h1: 'a1', h2: 'a5', ohms: 470 });
    useBench.getState().removeSelected();
    expect(useBench.getState().parts).toHaveLength(0);
  });

  it('clicking the same hole twice cancels placement', () => {
    const s = useBench.getState();
    s.clear();
    s.setTool('wire');
    s.clickHole('c3');
    s.clickHole('c3');
    expect(useBench.getState().pending).toBeNull();
    expect(useBench.getState().parts).toHaveLength(0);
  });

  it('probes go red first, then black', () => {
    const s = useBench.getState();
    s.clear();
    s.setTool('probe');
    s.clickHole('a1');
    s.clickHole('b2');
    expect(useBench.getState().probes).toEqual({ red: 'a1', black: 'b2' });
  });
});
