/**
 * Logic chips for the breadboard: 14-pin DIPs from the 74HC family, straddling the centre gap.
 * Seen from above with the notch on the left, pins 1–7 run left to right along row e and
 * pins 8–14 come back right to left along row f, so pin 14 (VCC) sits above pin 1 and
 * pin 7 (GND) is bottom right. Every chip here has VCC on 14 and GND on 7.
 */
import type { GateFn } from '../sim';
import type { HoleId } from './layout';

export interface ChipDef {
  id: string;
  /** What it is, in plain words. */
  name: string;
  /** Each gate: its function, its input pins, its output pin. */
  gates: { fn: GateFn; inputs: number[]; output: number }[];
}

/** The quad 2-input pinout shared by the '00, '08, '32 and '86: gates on 1-2→3, 4-5→6, 9-10→8, 12-13→11. */
const quad = (fn: GateFn) => [
  { fn, inputs: [1, 2], output: 3 }, { fn, inputs: [4, 5], output: 6 },
  { fn, inputs: [9, 10], output: 8 }, { fn, inputs: [12, 13], output: 11 },
];

export const CHIPS: Record<string, ChipDef> = {
  '74HC00': { id: '74HC00', name: 'quad 2-input NAND', gates: quad('NAND') },
  '74HC08': { id: '74HC08', name: 'quad 2-input AND', gates: quad('AND') },
  '74HC32': { id: '74HC32', name: 'quad 2-input OR', gates: quad('OR') },
  '74HC86': { id: '74HC86', name: 'quad 2-input XOR', gates: quad('XOR') },
  '74HC04': {
    id: '74HC04', name: 'hex inverter (NOT)',
    gates: [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]].map(([i, o]) => ({ fn: 'NOT' as GateFn, inputs: [i!], output: o! })),
  },
};

export const VCC_PIN = 14;
export const GND_PIN = 7;
export const DEFAULT_CHIP = '74HC00';

/** A DIP's 14 holes with pin 1 in column `col` of row e (index 0 is pin 1). Null if it won't fit. */
export function dipPins(col: number, cols = 30): HoleId[] | null {
  if (col < 1 || col + 6 > cols) return null;
  const bottom = Array.from({ length: 7 }, (_, i) => `e${col + i}`);
  const top = Array.from({ length: 7 }, (_, i) => `f${col + 6 - i}`);
  return [...bottom, ...top];
}

/** The column of a main-area hole ("e12" → 12), or null for a rail. */
export const colOf = (h: HoleId): number | null => { const m = /^[a-j](\d+)$/.exec(h); return m ? Number(m[1]) : null; };

/** What each pin does on this chip, for labels and the part card: "1A", "1Y", "VCC"… */
export function pinName(chip: ChipDef, pin: number): string {
  if (pin === VCC_PIN) return 'VCC';
  if (pin === GND_PIN) return 'GND';
  const g = chip.gates.findIndex((x) => x.output === pin);
  if (g >= 0) return `${g + 1}Y`;
  for (let k = 0; k < chip.gates.length; k++) {
    const i = chip.gates[k]!.inputs.indexOf(pin);
    if (i >= 0) return `${k + 1}${'AB'[i]}`;
  }
  return 'NC';
}
