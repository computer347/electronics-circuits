/**
 * Node programs for a microcontroller, and how the board runs them. A program is two lanes of
 * nodes, the way every Arduino sketch is: `setup` runs once, `loop` runs forever. Each node is
 * one line of real Arduino code (the editor shows it under the node, and `sketch()` prints the
 * whole thing, ready to paste into the Arduino IDE).
 *
 * The board doesn't emulate the chip: `run()` walks the lanes and turns them into pin changes
 * over time, which is all a blink needs. (An instruction-level emulator can come later.)
 */

export type Level = 'HIGH' | 'LOW';

export type ProgramNode =
  | { id: string; kind: 'pinMode'; pin: number; mode: 'OUTPUT' | 'INPUT' }
  | { id: string; kind: 'write'; pin: number; level: Level }
  | { id: string; kind: 'toggle'; pin: number }
  | { id: string; kind: 'wait'; ms: number };

export type NodeKind = ProgramNode['kind'];

export interface Program { setup: ProgramNode[]; loop: ProgramNode[] }

export interface BoardPins {
  /** Digital pins you can use. */
  pins: number[];
  /** Pins with something on the board already (the Uno's L LED is on 13). */
  onboard: Record<number, string>;
}

export const UNO_PINS: BoardPins = { pins: Array.from({ length: 14 }, (_, i) => i), onboard: { 13: 'the L LED' } };

/** What the palette offers, in plain words, with the Arduino line it stands for. */
export const NODE_INFO: Record<NodeKind, { title: string; what: string }> = {
  pinMode: { title: 'Pin mode', what: 'Make a pin an output (it drives) or an input (it listens).' },
  write: { title: 'Set pin', what: 'Drive an output pin HIGH (5 V) or LOW (0 V).' },
  toggle: { title: 'Flip pin', what: 'HIGH becomes LOW, LOW becomes HIGH.' },
  wait: { title: 'Wait', what: 'Do nothing for a while, in milliseconds (1000 ms = 1 s).' },
};

/** The node as the line of Arduino code it is. */
export function codeOf(n: ProgramNode): string {
  switch (n.kind) {
    case 'pinMode': return `pinMode(${n.pin}, ${n.mode});`;
    case 'write': return `digitalWrite(${n.pin}, ${n.level});`;
    case 'toggle': return `digitalWrite(${n.pin}, !digitalRead(${n.pin}));`;
    case 'wait': return `delay(${n.ms});`;
  }
}

/** The whole program as an Arduino sketch. */
export function sketch(p: Program): string {
  const lane = (ns: ProgramNode[]) => ns.map((n) => `  ${codeOf(n)}`).join('\n');
  return `void setup() {\n${lane(p.setup)}\n}\n\nvoid loop() {\n${lane(p.loop)}\n}\n`;
}

export interface Problem {
  node?: string;
  /** Errors stop the upload; warnings don't. */
  level: 'error' | 'warning';
  message: string;
}

export interface CompileResult {
  ok: boolean;
  problems: Problem[];
  /** A plausible flash size, for the console. */
  bytes: number;
}

/** Check a program the way the compiler and a patient teacher would. */
export function compile(p: Program, board: BoardPins = UNO_PINS): CompileResult {
  const problems: Problem[] = [];
  const outputs = new Set<number>();
  for (const n of p.setup) if (n.kind === 'pinMode' && n.mode === 'OUTPUT') outputs.add(n.pin);
  const all = [...p.setup, ...p.loop];
  for (const n of all) {
    if ('pin' in n && !board.pins.includes(n.pin)) problems.push({ node: n.id, level: 'error', message: `There's no pin ${n.pin} on this board: it has ${board.pins[0]}–${board.pins[board.pins.length - 1]}.` });
    if (n.kind === 'wait' && (!Number.isFinite(n.ms) || n.ms < 0)) problems.push({ node: n.id, level: 'error', message: 'A wait can’t be negative.' });
  }
  for (const n of p.loop) if (n.kind === 'pinMode') problems.push({ node: n.id, level: 'warning', message: 'Pin mode only needs setting once: it belongs in setup, not every time round the loop.' });
  for (const n of all) {
    if ((n.kind === 'write' || n.kind === 'toggle') && !outputs.has(n.pin) && !p.loop.some((m) => m.kind === 'pinMode' && m.pin === n.pin && m.mode === 'OUTPUT')) {
      problems.push({ node: n.id, level: 'warning', message: `Pin ${n.pin} isn't set as an output. Writing HIGH to an input only turns on its weak pull-up: an LED on it glows faintly. Add "Pin mode ${n.pin} OUTPUT" to setup.` });
    }
  }
  const loopMs = p.loop.reduce((t, n) => t + (n.kind === 'wait' ? n.ms : 0), 0);
  const changes = p.loop.some((n) => n.kind === 'write' || n.kind === 'toggle');
  if (changes && loopMs === 0) problems.push({ level: 'warning', message: 'The loop never waits, so the pin flips thousands of times a second: an LED just looks half-lit. Add a Wait.' });
  if (p.loop.length === 0) problems.push({ level: 'warning', message: 'The loop is empty: after setup, the board does nothing.' });
  const bytes = 444 + all.length * 18 + (all.some((n) => n.kind === 'wait') ? 280 : 0);
  return { ok: !problems.some((x) => x.level === 'error'), problems, bytes };
}

export interface PinChange { t: number; pin: number; level: 0 | 1 }

export interface RunResult {
  changes: PinChange[];
  /** Pins that were never made outputs but were written HIGH: they only pull up (weak, faint). */
  pulledUp: number[];
  /** Length of one pass of the loop, in ms (0 if it never waits). */
  loopMs: number;
}

/**
 * Run the program for `untilMs` of board time and return every pin change. Nodes take no time
 * except waits (the chip really does run a digitalWrite in a few microseconds).
 */
export function run(p: Program, untilMs: number): RunResult {
  const level: Record<number, 0 | 1> = {};
  const output = new Set<number>();
  const pulled = new Set<number>();
  const changes: PinChange[] = [];
  let t = 0;
  const exec = (n: ProgramNode) => {
    switch (n.kind) {
      case 'pinMode': if (n.mode === 'OUTPUT') output.add(n.pin); else output.delete(n.pin); break;
      case 'write': case 'toggle': {
        const v: 0 | 1 = n.kind === 'write' ? (n.level === 'HIGH' ? 1 : 0) : ((level[n.pin] ?? 0) ? 0 : 1);
        if (!output.has(n.pin)) { if (v) pulled.add(n.pin); break; }
        if ((level[n.pin] ?? 0) !== v) { level[n.pin] = v; changes.push({ t, pin: n.pin, level: v }); }
        break;
      }
      case 'wait': t += Math.max(0, n.ms); break;
    }
  };
  for (const n of p.setup) exec(n);
  const loopMs = p.loop.reduce((s, n) => s + (n.kind === 'wait' ? Math.max(0, n.ms) : 0), 0);
  if (p.loop.length && loopMs > 0) {
    while (t < untilMs) for (const n of p.loop) { if (t >= untilMs) break; exec(n); }
  } else if (p.loop.length) {
    // A loop with no wait: run it once for its steady state.
    for (const n of p.loop) exec(n);
  }
  return { changes: changes.filter((c) => c.t <= untilMs), pulledUp: [...pulled], loopMs };
}

/** A pin's level at time t, from a run. */
export function levelAt(r: RunResult, pin: number, t: number): 0 | 1 {
  let v: 0 | 1 = 0;
  for (const c of r.changes) { if (c.pin !== pin) continue; if (c.t <= t) v = c.level; else break; }
  return v;
}

export interface BlinkMeasure {
  /** Time HIGH and LOW in one steady cycle, in ms (null if it doesn't blink). */
  on: number | null;
  off: number | null;
}

/** Measure a pin's blink over a run, the way a scope would: the last full on and off times. */
export function measureBlink(r: RunResult, pin: number): BlinkMeasure {
  const c = r.changes.filter((x) => x.pin === pin);
  let on: number | null = null, off: number | null = null;
  for (let i = 1; i < c.length; i++) {
    const d = c[i]!.t - c[i - 1]!.t;
    if (c[i - 1]!.level === 1) on = d; else off = d;
  }
  return { on, off };
}

let seq = 0;
export const newNode = (kind: NodeKind, pin = 13): ProgramNode => {
  const id = `n${++seq}-${Date.now().toString(36)}`;
  switch (kind) {
    case 'pinMode': return { id, kind, pin, mode: 'OUTPUT' };
    case 'write': return { id, kind, pin, level: 'HIGH' };
    case 'toggle': return { id, kind, pin };
    case 'wait': return { id, kind, ms: 500 };
  }
};
