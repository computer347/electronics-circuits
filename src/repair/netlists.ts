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
import { ARDUINO_UNO, DHT11, OLED_096, type BoardDef } from '../parts3d/boards';
import { boardPads } from '../parts3d/pcbgen';

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
  /** Where the power comes in when the cable's plugged in (modules have none: they're powered by wires). */
  power?: { net: string; volts: number; cable: string };
  parts: Record<string, ElectricalPart>;
  pins: HeaderPin[];
}

const pins = (header: string, labels: string[], net: (label: string) => string): HeaderPin[] =>
  labels.map((label, index) => ({ id: `${header}.${index}`, header, index, label, net: net(label) }));

/**
 * Pin names that are ground, supply rails, or a pin of their own. On the Uno R3 the SDA and SCL
 * pins by AREF are the same wires as A4 and A5 (the ATmega328P's I²C pins).
 */
const pinNet = (l: string) => (l === 'GND' ? 'GND' : l === '5V' || l === 'IOREF' ? '5V' : l === '3.3V' ? '3V3' : l === '' ? `NC` : l === 'SDA' ? 'A4' : l === 'SCL' ? 'A5' : l);

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

/**
 * DHT11 module: the sensor between + and −, drawing about 1 mA, and the 10 kΩ pull-up the data
 * line needs, from OUT to +. Its nets are its own (M_…) until wires join them to a board.
 */
export const DHT11_NETLIST: BoardNetlist = {
  board: 'dht11',
  parts: { R_PULL: { kind: 'resistor', nets: ['M_VCC', 'M_DATA'], ohms: 10000 } },
  pins: pins('H1', ['+', 'OUT', '−'], (l) => (l === '+' ? 'M_VCC' : l === 'OUT' ? 'M_DATA' : 'M_GND')),
};
export const DHT11_SENSOR: ElectricalPart = { kind: 'resistor', nets: ['M_VCC', 'M_GND'], ohms: 5000 };

/**
 * 0.96" OLED module: GND, VCC, SCL, SDA. It has its own 3.3 V regulator (so 3.3–5 V in), the
 * I²C pull-ups (4.7 kΩ from SCL and SDA up to VCC), and the panel draws about 20 mA lit.
 */
export const OLED_NETLIST: BoardNetlist = {
  board: 'oled-096',
  parts: {},
  pins: pins('H1', ['GND', 'VCC', 'SCL', 'SDA'], (l) => (l === 'GND' ? 'M_GND' : l === 'VCC' ? 'M_VCC' : `M_${l}`)),
};
export const OLED_FIXED: Record<string, ElectricalPart> = {
  PANEL: { kind: 'resistor', nets: ['M_VCC', 'M_GND'], ohms: 250 },
  PULL_SCL: { kind: 'resistor', nets: ['M_VCC', 'M_SCL'], ohms: 4700 },
  PULL_SDA: { kind: 'resistor', nets: ['M_VCC', 'M_SDA'], ohms: 4700 },
};

export const NETLISTS: Record<string, { def: BoardDef; net: BoardNetlist; fixed?: Record<string, ElectricalPart> }> = {
  'arduino-uno': { def: ARDUINO_UNO, net: UNO_NETLIST, fixed: { U_LDO: UNO_LDO } },
  dht11: { def: DHT11, net: DHT11_NETLIST, fixed: { SENSOR: DHT11_SENSOR } },
  'oled-096': { def: OLED_096, net: OLED_NETLIST, fixed: OLED_FIXED },
};

// Boards with a real circuit draw their copper from it.
ARDUINO_UNO.nets = pcbNets(UNO_NETLIST);
DHT11.nets = pcbNets(DHT11_NETLIST);

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

/**
 * Every probe-able spot on a board: both pads of each electrical part, and every header pin.
 * Positions come from the PCB generator's footprints, so a probe lands on the copper drawn.
 */
export function padSpots(def: BoardDef, net: BoardNetlist): PadSpot[] {
  const out: PadSpot[] = [];
  const pads = new Map(boardPads(def).map((p) => [p.id, p]));
  for (const [id, e] of Object.entries(net.parts)) {
    if (e.kind === 'regulator') continue;
    [0, 1].forEach((i) => {
      const pad = pads.get(`${id}.${i + 1}`);
      if (pad) out.push({ id: `${id}.${i + 1}`, net: e.nets[i]!, at: [pad.x, pad.z], label: `${id} pad ${i + 1}`, part: id });
    });
  }
  for (const pin of net.pins) {
    const pad = pads.get(`${pin.header}.${pin.index + 1}`);
    if (!pad || pin.net === 'NC') continue;
    out.push({ id: pin.id, net: pin.net, at: [pad.x, pad.z], label: `${pin.label} pin` });
  }
  return out;
}

/** A netlist as PCB nets (pad ids by net name), so the copper drawn is the real circuit. */
export function pcbNets(net: BoardNetlist): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (n: string, pad: string) => { if (n !== 'NC') (out[n] ??= []).push(pad); };
  for (const [id, e] of Object.entries(net.parts)) if (e.kind !== 'regulator') e.nets.forEach((n, i) => add(n, `${id}.${i + 1}`));
  for (const pin of net.pins) add(pin.net, `${pin.header}.${pin.index + 1}`);
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v.length >= 2));
}
