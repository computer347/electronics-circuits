/**
 * Wiring jobs: a module and a board on the mat, and jumper wires from the module's pins to
 * the board's header, by pin name. Plain data and pure functions; WiringBench.tsx draws it.
 *
 * The wired-up pair is solved as one circuit (the board's own netlist, the module's, and the
 * wires), so what happens follows from the electricity: the module only works with 3–5.5 V
 * between its + and −, powered backwards it cooks, and the program only hears it on the pin
 * its sketch reads.
 */
import { boardComponents } from '../repair/repair';
import { NETLISTS, padSpots, type PadSpot } from '../repair/netlists';
import { solve, type Component } from '../sim';

export interface WiringJob {
  id: string;
  title: string;
  board: string;
  module: string;
  /** Where the module lies on the mat, relative to the board (mm). */
  moduleAt: [number, number];
  story: string;
  goal: string;
  skill: string;
  realLife: string;
  hints: string[];
  /** The sketch already on the board, which reads the module. */
  sketch: string;
  /** The module's power pins (nets). */
  moduleNets: { vcc: string; gnd: string };
  /**
   * Its signal pins: which board nets they work on, what to say when one goes elsewhere
   * ("…, but the sketch reads pin 2"), and the jumper colour.
   */
  signals: { net: string; label: string; wants: string[]; explain: string; missing: string; color: string }[];
  /** What to say when two signals are on each other's pins (I²C's SDA and SCL). */
  swapped?: string;
  /** Supply the module needs, volts. */
  supply: [number, number];
  /** What the serial monitor prints when it works, and when it can't see the module. */
  okLines: string[];
  failLines: string[];
  baud: number;
  /** The result card: its title and the one-star rule. */
  done: { title: string; rule: string; line: string };
}

export interface Wire { from: string; to: string }

export const DHT11_JOB: WiringJob = {
  id: 'wiring-dht11',
  title: 'Hook up the sensor',
  board: 'arduino-uno',
  module: 'dht11',
  moduleAt: [62, 6],
  story: 'The club wants the greenhouse temperature on their Uno. The DHT11 module and the sketch are ready; nobody has wired it up yet.',
  goal: 'Wire the DHT11 to the Uno: + to power, − to ground, OUT to the pin the sketch reads. Then power up and watch the serial monitor.',
  skill: 'Hook a sensor module to a microcontroller by its pin names: power, ground, and signal to the pin the program reads.',
  realLife: 'Nearly every module you can buy (motion sensors, distance sensors, displays) goes on with the same three wires. Read the labels and the sketch, never guess.',
  hints: [
    'Three wires. The module’s + is its power: it wants 3–5.5 V, so the Uno’s 5V pin. Its − goes to any GND pin.',
    'Which pin does the sketch read? Look for #define DHTPIN in the code. OUT goes to that pin on the digital header.',
    '+ → 5V, − → GND, OUT → pin 2 (the digital header counts down from 7 on the right: 7 6 5 4 3 2 1 0).',
  ],
  sketch: `#include <DHT.h>\n#define DHTPIN 2\nDHT dht(DHTPIN, DHT11);\n\nvoid setup() {\n  Serial.begin(9600);\n  dht.begin();\n}\n\nvoid loop() {\n  delay(2000);\n  float h = dht.readHumidity();\n  float t = dht.readTemperature();\n  if (isnan(h) || isnan(t)) {\n    Serial.println("Failed to read from DHT sensor!");\n    return;\n  }\n  Serial.print("Humidity: "); Serial.print(h);\n  Serial.print("%  Temperature: "); Serial.print(t); Serial.println("°C");\n}\n`,
  moduleNets: { vcc: 'M_VCC', gnd: 'M_GND' },
  signals: [{ net: 'M_DATA', label: 'OUT', wants: ['D2'], explain: 'but the sketch reads pin 2 (#define DHTPIN 2).', missing: 'OUT isn’t wired: the sensor talks, but nothing is listening.', color: '#ffd21f' }],
  supply: [3, 5.5],
  okLines: ['Humidity: 45.00%  Temperature: 23.00°C', 'Humidity: 45.00%  Temperature: 23.10°C'],
  failLines: ['Failed to read from DHT sensor!', 'Failed to read from DHT sensor!'],
  baud: 9600,
  done: { title: 'Reading the greenhouse', rule: 'The sketch reads the sensor', line: 'Humidity: 45.00%  Temperature: 23.00°C' },
};

/**
 * The OLED on I²C: two signal wires shared by every I²C device. The sketch on the board is the
 * standard I²C scanner, which asks every address “anyone there?” and prints who answers: the
 * first thing to run when a screen stays dark.
 */
export const OLED_WIRING_JOB: WiringJob = {
  id: 'wiring-oled',
  title: 'Hook up the screen',
  board: 'arduino-uno',
  module: 'oled-096',
  moduleAt: [56, -4],
  story: 'The club bought a 0.96" OLED for the greenhouse Uno. It talks I²C: two wires for data, plus power. The Uno is running the I²C scanner, to check the screen answers before anyone writes a line of drawing code.',
  goal: 'Wire the OLED to the Uno: GND, VCC, SCL and SDA. Then power up: the scanner should find it at 0x3C.',
  skill: 'Wire an I²C device: power and ground, SDA to SDA and SCL to SCL, then prove it answers with a scanner before writing any code for it.',
  realLife: 'Screens, clocks, pressure sensors and motor drivers all share the same two I²C wires, each at its own address. When one stays silent, the scanner is the first thing anyone runs.',
  hints: [
    'GND to any GND on the Uno, VCC to 5V. The module has its own 3.3 V regulator, so 5 V is fine (3.3V works too).',
    'On the Uno, SDA is A4 and SCL is A5. The pins marked SDA and SCL up by AREF are the same two wires, so either place works.',
    'GND → GND, VCC → 5V, SCL → A5 (or SCL), SDA → A4 (or SDA). SDA is data, SCL is the clock: swap them and nothing answers.',
  ],
  sketch: `#include <Wire.h>\n\nvoid setup() {\n  Wire.begin();\n  Serial.begin(9600);\n  Serial.println("I2C Scanner");\n}\n\nvoid loop() {\n  int found = 0;\n  Serial.println("Scanning...");\n  for (byte address = 1; address < 127; address++) {\n    Wire.beginTransmission(address);\n    if (Wire.endTransmission() == 0) {\n      Serial.print("I2C device found at address 0x");\n      if (address < 16) Serial.print("0");\n      Serial.print(address, HEX);\n      Serial.println("  !");\n      found++;\n    }\n  }\n  if (found == 0) Serial.println("No I2C devices found");\n  else Serial.println("done");\n  delay(5000);\n}\n`,
  moduleNets: { vcc: 'M_VCC', gnd: 'M_GND' },
  signals: [
    { net: 'M_SCL', label: 'SCL', wants: ['A5'], explain: 'but the Uno’s I²C clock is A5 (also marked SCL, by AREF).', missing: 'SCL isn’t wired: without the clock line the screen never hears its address.', color: '#ffd21f' },
    { net: 'M_SDA', label: 'SDA', wants: ['A4'], explain: 'but the Uno’s I²C data line is A4 (also marked SDA, by AREF).', missing: 'SDA isn’t wired: the scanner calls, but the screen’s answer has no way back.', color: '#3a8bff' },
  ],
  swapped: 'SDA and SCL are swapped: the Uno sends its clock down the data line, and nothing answers. SDA (data) goes to A4, SCL (clock) to A5.',
  supply: [3, 5.5],
  okLines: ['Scanning...', 'I2C device found at address 0x3C  !', 'done'],
  failLines: ['Scanning...', 'No I2C devices found'],
  baud: 9600,
  done: { title: 'It answers', rule: 'The scanner finds the screen at 0x3C', line: 'I2C device found at address 0x3C  !' },
};

export const WIRING_JOBS: WiringJob[] = [DHT11_JOB, OLED_WIRING_JOB];

/** The right wires for a job: power to 5V, ground to the power header's GND, each signal to its pin. */
export function correctWires(job: WiringJob): Wire[] {
  const { module, board } = wiringSpots(job);
  const to = (net: string) => (board.find((s) => s.net === net && s.id.includes('H_PWR')) ?? board.find((s) => s.net === net))!.id;
  const from = (net: string) => module.find((s) => s.net === net)!.id;
  return [
    { from: from(job.moduleNets.gnd), to: to('GND') },
    { from: from(job.moduleNets.vcc), to: to('5V') },
    ...job.signals.map((s) => ({ from: from(s.net), to: board.find((b) => b.net === s.wants[0] && !b.id.includes('H_DIG'))?.id ?? to(s.wants[0]!) })),
  ];
}
export const wiringJobById = (id: string) => WIRING_JOBS.find((j) => j.id === id);

/** Spots on each side: the module's pins (ids prefixed "m:") and the board's header pins ("b:"). */
export function wiringSpots(job: WiringJob): { module: PadSpot[]; board: PadSpot[] } {
  const m = NETLISTS[job.module]!, b = NETLISTS[job.board]!;
  const pinsOnly = (s: PadSpot[]) => s.filter((x) => !x.part);
  return {
    module: pinsOnly(padSpots(m.def, m.net)).map((s) => ({ ...s, id: `m:${s.id}`, at: [s.at[0] + job.moduleAt[0], s.at[1] + job.moduleAt[1]] as [number, number] })),
    board: pinsOnly(padSpots(b.def, b.net)).map((s) => ({ ...s, id: `b:${s.id}` })),
  };
}

/** The whole thing as the solver sees it: board (on USB), module, and the wires. */
export function wiringCircuit(job: WiringJob, wires: Wire[]): Component[] {
  const { module, board } = wiringSpots(job);
  const m = NETLISTS[job.module]!;
  const comps = boardComponents(job.board, true);
  for (const [id, e] of Object.entries(m.net.parts)) if (e.kind === 'resistor') comps.push({ kind: 'resistor', id: `M.${id}`, a: e.nets[0], b: e.nets[1], ohms: e.ohms });
  for (const [id, e] of Object.entries(m.fixed ?? {})) if (e.kind === 'resistor') comps.push({ kind: 'resistor', id: `M.${id}`, a: e.nets[0], b: e.nets[1], ohms: e.ohms });
  wires.forEach((w, i) => {
    const a = module.find((s) => s.id === w.from)?.net, b = board.find((s) => s.id === w.to)?.net;
    if (a && b) comps.push({ kind: 'wire', id: `W${i}`, a, b });
  });
  return comps;
}

export interface WiringResult {
  /** Volts between the module's + and −. */
  supply: number;
  /** 'ok': the sketch reads it; 'no-read': it prints the library's failure line; 'reversed': cooked. */
  outcome: 'ok' | 'no-read' | 'reversed';
  /** Serial monitor lines, the way the sketch would print them. */
  serial: string[];
  /** What went wrong, in plain words (empty when it works). */
  why: string;
}

/** Power it up: what happens with these wires. */
export function powerUp(job: WiringJob, wires: Wire[]): WiringResult {
  const r = solve({ components: wiringCircuit(job, wires) });
  const v = (n: string) => r.nodeVoltages[n] ?? 0;
  const supply = v(job.moduleNets.vcc) - v(job.moduleNets.gnd);
  const { board, module } = wiringSpots(job);
  const netOf = (id: string) => board.find((s) => s.id === id)?.net ?? module.find((s) => s.id === id)?.net;
  const fail = job.failLines;
  if (supply < -0.5) {
    return { supply, outcome: 'reversed', serial: [fail[fail.length - 1]!], why: `The module has ${supply.toFixed(1)} V across it: + and − are the wrong way round. It gets hot and dies. Unplug fast!` };
  }
  let why = '';
  if (supply < job.supply[0]) {
    const plus = wires.find((w) => netOf(w.from) === job.moduleNets.vcc);
    const to = plus ? board.find((s) => s.id === plus.to) : undefined;
    why = !plus ? 'The module’s + isn’t wired to anything, so it has no power.'
      : !wires.some((w) => netOf(w.from) === job.moduleNets.gnd) ? 'The module’s − isn’t wired: without a ground its power has nowhere to return to.'
      : to?.net === 'VIN' ? 'VIN is only live when the barrel jack is plugged in. On USB it’s dead: use the 5V pin.'
      : `The module only gets ${supply.toFixed(1)} V; it needs ${job.supply[0]}–${job.supply[1]} V.`;
  } else if (supply > job.supply[1]) why = `${supply.toFixed(1)} V is too much for it (${job.supply[1]} V at most).`;
  else {
    const to = job.signals.map((s) => { const w = wires.find((x) => netOf(x.from) === s.net); return w ? netOf(w.to) : undefined; });
    const [a, b] = job.signals;
    if (job.swapped && a && b && to[0] && b.wants.includes(to[0]) && to[1] && a.wants.includes(to[1])) why = job.swapped;
    else {
      job.signals.some((s, i) => {
        if (!to[i]) why = s.missing;
        else if (!s.wants.includes(to[i]!)) why = `${s.label} goes to ${describeNet(to[i]!)}, ${s.explain}`;
        return !!why;
      });
    }
  }
  if (why) return { supply, outcome: 'no-read', serial: fail, why };
  return { supply, outcome: 'ok', serial: job.okLines, why: '' };
}

/** A board net the way you'd say it: pin 3, A0, ground, a power pin. */
const describeNet = (n: string) => (n === 'GND' ? 'ground' : n === '5V' || n === '3V3' || n === 'VIN' ? 'a power pin' : /^D\d+$/.test(n) ? `pin ${n.slice(1)}` : n);

/** Wire colours by what a pin carries, the way people colour-code: red power, black ground, yellow/blue signals. */
export function wireColor(job: WiringJob, from: string): string {
  const net = wiringSpots(job).module.find((s) => s.id === from)?.net;
  return net === job.moduleNets.vcc ? '#e8413c' : net === job.moduleNets.gnd ? '#1c1c1e' : job.signals.find((s) => s.net === net)?.color ?? '#ffd21f';
}
