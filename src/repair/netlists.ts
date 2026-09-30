/**
 * The electrical side of the boards on the mat. A 3D board (src/parts3d/boards.tsx) is only its
 * looks; this says which copper each part's pads sit on, what the parts are electrically, and
 * where power comes in, so the probes read what they would on the real board. Each netlist is
 * the board's real circuit, cut down to the parts a repair can touch (the microcontrollers are
 * left out: they draw a little current and don't change what the meter reads).
 *
 * Pads: two-pad parts have pad 1 at their local −x end and pad 2 at +x (an LED's anode is pad 1).
 */
import type { LedColor } from '../sim';
import { ARDUINO_UNO, type BoardDef, type Placed } from '../parts3d/boards';

export type ElectricalPart =
  | { kind: 'resistor'; nets: [string, string]; ohms: number }
  | { kind: 'led'; nets: [string, string]; color: LedColor; vf: number; maxAmps: number }
  | { kind: 'capacitor'; nets: [string, string]; farads: number }
  /** A regulator on the board: holds `out` at `vout` from `in`. Three pads: in, gnd, out. */
  | { kind: 'regulator'; nets: [string, string, string]; vout: number; dropout: number };

export interface HeaderPin {
  /** Header and pin number: "H_PWR.4" (the 5V pin). */
  id: string;
  header: string;
  index: number;
  label: string;
  net: string;
}

export interface BoardNetlist {
  board: string;
  /** Where the power comes in when the cable's plugged in. */
  power: { net: string; volts: number; cable: string };
  parts: Record<string, ElectricalPart>;
  pins: HeaderPin[];
}

const pins = (header: string, labels: string[], net: (label: string) => string): HeaderPin[] =>
  labels.map((label, index) => ({ id: `${header}.${index}`, header, index, label, net: net(label) }));

/** Pin names that are ground, supply rails, or a pin of their own. */
const pinNet = (l: string) => (l === 'GND' ? 'GND' : l === '5V' || l === 'IOREF' ? '5V' : l === '3.3V' ? '3V3' : l === '' ? `NC` : l);

/**
 * Arduino Uno R3, powered from USB. The power LED is ON: 5 V → R_ON (1 kΩ) → LED_ON → GND,
 * about 3 mA. RESET is pulled up to 5 V by 10 kΩ. The 3.3 V pin comes from a small LDO.
 * Pin 13's LED sits behind a buffer; with the sketch not running it's dark.
 */
export const UNO_NETLIST: BoardNetlist = {
  board: 'arduino-uno',
  power: { net: '5V', volts: 5, cable: 'USB' },
  parts: {
    R_ON: { kind: 'resistor', nets: ['5V', 'ON_A'], ohms: 1000 },
    LED_ON: { kind: 'led', nets: ['ON_A', 'GND'], color: 'green', vf: 2.0, maxAmps: 0.02 },
    R_L: { kind: 'resistor', nets: ['D13_BUF', 'L_A'], ohms: 1000 },
    LED_L: { kind: 'led', nets: ['L_A', 'GND'], color: 'yellow', vf: 2.0, maxAmps: 0.02 },
    R_RST: { kind: 'resistor', nets: ['5V', 'RESET'], ohms: 10000 },
    C_OUT: { kind: 'capacitor', nets: ['5V', 'GND'], farads: 47e-6 },
    C1: { kind: 'capacitor', nets: ['5V', 'GND'], farads: 100e-9 },
    C2: { kind: 'capacitor', nets: ['5V', 'GND'], farads: 100e-9 },
    C5: { kind: 'capacitor', nets: ['5V', 'GND'], farads: 100e-9 },
    C6: { kind: 'capacitor', nets: ['5V', 'GND'], farads: 100e-9 },
  },
  pins: [
    ...pins('H_PWR', ['', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN'], pinNet),
    ...pins('H_DIG1', ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '11', '10', '9', '8'], (l) => (l === '13' ? 'D13' : pinNet(l))),
    ...pins('H_DIG2', ['7', '6', '5', '4', '3', '2', '1', '0'], (l) => `D${l}`),
    ...pins('H_AN', ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], pinNet),
  ],
};

/** The 3.3 V pin's LDO, always fitted: in, gnd, out. */
export const UNO_LDO: ElectricalPart = { kind: 'regulator', nets: ['5V', 'GND', '3V3'], vout: 3.3, dropout: 1 };

export const NETLISTS: Record<string, { def: BoardDef; net: BoardNetlist; fixed?: Record<string, ElectricalPart> }> = {
  'arduino-uno': { def: ARDUINO_UNO, net: UNO_NETLIST, fixed: { U_LDO: UNO_LDO } },
};

// ---------------------------------------------------------------- where the pads are

export interface PadSpot {
  /** "R_ON.1", or a header pin's id. */
  id: string;
  net: string;
  /** Board millimetres, on the board's top face. */
  at: [number, number];
  /** What a hover says: "R_ON pad 1 · 5V side" or "5V pin". */
  label: string;
  part?: string;
}

/** Half the distance between a two-pad part's pad centres, by package. */
function padHalf(p: Placed): number {
  const size = (p.props?.size as string | undefined) ?? '0603';
  const len = size === '0402' ? 1.0 : size === '0805' ? 2.0 : 1.6;
  return p.kind === 'elec' ? 1.1 * ((p.props?.scale as number | undefined) ?? 0.8) * 2 : len * 0.4;
}

const rotate = (x: number, z: number, deg: number): [number, number] => {
  const t = (deg * Math.PI) / 180;
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
};

/** Every probe-able spot on a board: both pads of each electrical part, and every header pin. */
export function padSpots(def: BoardDef, net: BoardNetlist): PadSpot[] {
  const out: PadSpot[] = [];
  const byId = new Map(def.parts.map((p) => [p.id, p]));
  for (const [id, e] of Object.entries(net.parts)) {
    const p = byId.get(id);
    if (!p || e.kind === 'regulator') continue;
    const h = padHalf(p);
    ([-1, 1] as const).forEach((k, i) => {
      const [dx, dz] = rotate(k * h, 0, p.rot ?? 0);
      out.push({ id: `${id}.${i + 1}`, net: e.nets[i]!, at: [p.at[0] + dx, p.at[1] + dz], label: `${id} pad ${i + 1}`, part: id });
    });
  }
  for (const pin of net.pins) {
    const h = byId.get(pin.header);
    if (!h || pin.net === 'NC') continue;
    const [dx, dz] = rotate(pin.index * 2.54, 0, h.rot ?? 0);
    out.push({ id: pin.id, net: pin.net, at: [h.at[0] + dx, h.at[1] + dz], label: `${pin.label} pin` });
  }
  return out;
}
