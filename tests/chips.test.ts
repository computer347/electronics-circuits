/**
 * 74HC chips on the breadboard: placed across the gap, powered through pins 14 and 7, each
 * gate on its datasheet pins, and moved and turned round with all 14 legs.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CHIPS, dipPins, pinName } from '../src/breadboard/chips';
import { analyzeBoard, type BoardPart, type BoardState } from '../src/breadboard/model';
import { translateParts } from '../src/breadboard/move';
import { useBench } from '../src/breadboard/store';
import { partInfo } from '../src/desk/partInfo';
import { LED_VF } from '../src/sim';

const pins = dipPins(10)!;
const chip = (marking: string): BoardPart => ({ id: 'IC1', kind: 'dip', h1: pins[0]!, h2: pins[7]!, pins, marking });
const W = (id: string, h1: string, h2: string): BoardPart => ({ id, kind: 'wire', h1, h2 });
/** Power on pins 14 (f10) and 7 (e16); inputs 1 and 2 (e10, e11) to + or −; output pin 3 (e12) lights an LED. */
function board(marking: string, a: boolean, b: boolean, powered = true): BoardState {
  return {
    supply: { volts: 5, on: true },
    parts: [
      chip(marking),
      ...(powered ? [W('WV', 'T+:9', 'j10'), W('WG', 'a16', 'T-:13')] : []),
      W('WA', a ? 'T+:8' : 'T-:8', 'a10'), W('WB', b ? 'T+:10' : 'T-:10', 'a11'),
      { id: 'R1', kind: 'resistor', h1: 'b12', h2: 'b20', ohms: 330 },
      { id: 'LED1', kind: 'led', h1: 'c20', h2: 'c22', color: 'red' },
      W('WL', 'a22', 'T-:17'),
    ],
  };
}
const lit = (b: BoardState) => Math.abs(analyzeBoard(b).result.currents['LED1'] ?? 0) > 1e-3;

describe('74HC chips', () => {
  it('straddles the gap: pins 1–7 along row e, 8–14 back along row f', () => {
    expect(pins.slice(0, 7)).toEqual(['e10', 'e11', 'e12', 'e13', 'e14', 'e15', 'e16']);
    expect(pins.slice(7)).toEqual(['f16', 'f15', 'f14', 'f13', 'f12', 'f11', 'f10']);
    expect(dipPins(25)).toBeNull();
    expect(pinName(CHIPS['74HC00']!, 14)).toBe('VCC');
    expect(pinName(CHIPS['74HC00']!, 3)).toBe('1Y');
    expect(pinName(CHIPS['74HC00']!, 2)).toBe('1B');
  });

  it('runs gate 1 (pins 1, 2 → 3) of each quad chip to its truth table', () => {
    const table: Record<string, boolean[]> = { '74HC00': [true, true, true, false], '74HC08': [false, false, false, true], '74HC32': [false, true, true, true], '74HC86': [false, true, true, false] };
    for (const [m, want] of Object.entries(table)) {
      for (let i = 0; i < 4; i++) expect(lit(board(m, !!(i & 1), !!(i & 2))), `${m} ${i}`).toBe(want[i]);
    }
  });

  it('does nothing without its power pins, and says so on its card', () => {
    const b = board('74HC00', false, false, false);
    expect(lit(b)).toBe(false);
    const info = partInfo(b.parts[0]!, analyzeBoard(b));
    expect(info.state).toMatch(/not powered: pin 14 goes to \+, pin 7 to −/);
    const on = board('74HC00', false, false);
    expect(partInfo(on.parts[0]!, analyzeBoard(on)).state).toBe('powered');
  });

  it('feeds the LED from the supply through pin 14 (about 8 mA)', () => {
    const a = analyzeBoard(board('74HC00', false, false));
    expect(a.result.currents['LED1']! * 1000).toBeCloseTo((5 - LED_VF.red) / 380 * 1000, 0);
  });

  it('moves with all 14 legs, and turns round about its middle', () => {
    const moved = translateParts([chip('74HC00')], ['IC1'], 'e10', 'e13', 'single');
    expect(moved.valid).toBe(true);
    expect(moved.parts[0]!.pins![0]).toBe('e13');
    expect(moved.parts[0]!.pins![13]).toBe('f13');
    useBench.getState().load({ supply: { volts: 5, on: true }, parts: [chip('74HC00')] });
    useBench.getState().flipPart('IC1');
    const p = useBench.getState().parts[0]!;
    expect(p.pins![0]).toBe('f16');
    expect(p.pins![7]).toBe('e10');
  });
});

describe('placing a chip', () => {
  beforeEach(() => { useBench.getState().load({ supply: { volts: 5, on: true }, parts: [] }); });
  it('goes in with one click on pin 1’s column, as the chosen chip', () => {
    const s = useBench.getState();
    s.setChip('74HC86');
    s.setTool('dip');
    useBench.getState().clickHole('c4');
    const p = useBench.getState().parts[0]!;
    expect(p.kind).toBe('dip');
    expect(p.marking).toBe('74HC86');
    expect(p.pins![0]).toBe('e4');
    expect(p.id).toBe('IC1');
  });
  it('won’t go where it can’t fit', () => {
    useBench.getState().setTool('dip');
    useBench.getState().clickHole('c27');
    expect(useBench.getState().parts).toHaveLength(0);
    expect(useBench.getState().notice).toMatch(/seven columns/);
  });
});
