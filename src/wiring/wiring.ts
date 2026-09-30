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
  /** The board pin the sketch reads (its net). */
  dataNet: string;
  /** The module's power pins and data pin (nets). */
  moduleNets: { vcc: string; gnd: string; data: string };
  /** Supply the module needs, volts. */
  supply: [number, number];
  /** What the serial monitor prints when it works. */
  okLine: string;
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
  dataNet: 'D2',
  moduleNets: { vcc: 'M_VCC', gnd: 'M_GND', data: 'M_DATA' },
  supply: [3, 5.5],
  okLine: 'Humidity: 45.00%  Temperature: 23.00°C',
};

export const WIRING_JOBS: WiringJob[] = [DHT11_JOB];
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
  const dataWire = wires.find((w) => netOf(w.from) === job.moduleNets.data);
  const dataTo = dataWire ? netOf(dataWire.to) : undefined;
  const fail = 'Failed to read from DHT sensor!';
  if (supply < -0.5) {
    return { supply, outcome: 'reversed', serial: [fail], why: `The module has ${supply.toFixed(1)} V across it: + and − are the wrong way round. It gets hot and dies. Unplug fast!` };
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
  else if (!dataWire) why = 'OUT isn’t wired: the sensor talks, but nothing is listening.';
  else if (dataTo !== job.dataNet) why = `OUT goes to ${dataTo === 'GND' ? 'ground' : dataTo === '5V' || dataTo === '3V3' ? 'a power pin' : `pin ${dataTo?.replace(/^D/, '')}`}, but the sketch reads pin ${job.dataNet.replace(/^D/, '')} (#define DHTPIN ${job.dataNet.replace(/^D/, '')}).`;
  if (why) return { supply, outcome: 'no-read', serial: [fail, fail], why };
  return { supply, outcome: 'ok', serial: [job.okLine, job.okLine.replace('23.00', '23.10')], why: '' };
}

/** Wire colours by what a pin carries, the way people colour-code: red power, black ground, yellow signal. */
export function wireColor(job: WiringJob, from: string): string {
  const net = wiringSpots(job).module.find((s) => s.id === from)?.net;
  return net === job.moduleNets.vcc ? '#e8413c' : net === job.moduleNets.gnd ? '#1c1c1e' : '#ffd21f';
}
