/**
 * Coding jobs: a board on the desk, a program to write for it in nodes, and what the board
 * has to do once it's uploaded.
 */
import { boardComponents } from '../repair/repair';
import { solve } from '../sim';
import { compile, measureBlink, run, type Program } from './program';

export interface CodingJob {
  id: string;
  title: string;
  board: string;
  story: string;
  goal: string;
  skill: string;
  realLife: string;
  hints: string[];
  start: Program;
  /** Pass: `pin` blinks with these on and off times (ms). */
  check: { pin: number; on: [number, number]; off: [number, number] };
}

export const BLINK: CodingJob = {
  id: 'coding-blink',
  title: 'Blink',
  board: 'arduino-uno',
  story: 'The Uno from the repair job is fixed. The club wants a heartbeat: the little L LED should blink once a second, so they can see at a glance that the board is running.',
  goal: 'Make the L LED on pin 13 blink: on for half a second, off for half a second, forever.',
  skill: 'Write the loop every microcontroller program runs: set a pin as an output, drive it HIGH and LOW, and time it with waits.',
  realLife: 'It’s the first program anyone runs on a new board, and the same few lines blink the status light on routers, smoke alarms and 3D printers to say “I’m alive”.',
  hints: [
    'Setup runs once. Pin 13 has to be made an output there, or the board won’t drive it: add a Pin mode node, pin 13, OUTPUT.',
    'Loop runs forever, top to bottom and round again. The LED needs four steps: on, wait, off, wait.',
    'Set pin 13 HIGH, Wait 500 ms, Set pin 13 LOW, Wait 500 ms. Then Compile and Upload.',
  ],
  start: { setup: [], loop: [] },
  check: { pin: 13, on: [450, 550], off: [450, 550] },
};

export const CODING_JOBS: CodingJob[] = [BLINK];
export const codingJobById = (id: string) => CODING_JOBS.find((j) => j.id === id);

export interface CodingCheck { pass: boolean; message: string; on: number | null; off: number | null }

export function checkCoding(job: CodingJob, p: Program): CodingCheck {
  const c = compile(p);
  if (!c.ok) return { pass: false, message: c.problems.find((x) => x.level === 'error')!.message, on: null, off: null };
  const r = run(p, 6000);
  const { on, off } = measureBlink(r, job.check.pin);
  if (r.pulledUp.includes(job.check.pin)) return { pass: false, message: `The LED only glows faintly: pin ${job.check.pin} isn't an output, so HIGH just turns its pull-up on.`, on, off };
  if (on === null || off === null) {
    const lit = r.changes.some((x) => x.pin === job.check.pin && x.level === 1);
    // With no waits, a loop that writes both levels (or flips) flickers too fast to see.
    const mine = p.loop.filter((x) => (x.kind === 'write' || x.kind === 'toggle') && x.pin === job.check.pin);
    const flickers = r.loopMs === 0 && (mine.some((x) => x.kind === 'toggle') || new Set(mine.map((x) => (x.kind === 'write' ? x.level : ''))).size > 1);
    return { pass: false, message: flickers ? 'The LED flips too fast to see: the loop has no waits, so it just looks half-lit.' : lit ? 'The LED comes on and stays on: it never turns off.' : 'The LED never comes on.', on, off };
  }
  const inside = (x: number, [a, b]: [number, number]) => x >= a && x <= b;
  if (!inside(on, job.check.on) || !inside(off, job.check.off)) {
    return { pass: false, message: `It blinks, ${on} ms on and ${off} ms off. The club wants ${job.check.on[0]}–${job.check.on[1]} ms each.`, on, off };
  }
  return { pass: true, message: `Blinking: ${on} ms on, ${off} ms off, once a second.`, on, off };
}

/**
 * The L LED's current with pin 13 at a level, through the Uno's own circuit: pin 13 drives a
 * buffer, the buffer drives R_L (1 kΩ) and LED_L. About 3 mA when HIGH.
 */
export function unoLedAmps(pin13: 0 | 1): number {
  const comps = boardComponents('arduino-uno', true);
  comps.push({ kind: 'vsource', id: 'PIN13', a: 'D13', b: 'GND', volts: pin13 ? 5 : 0 });
  comps.push({ kind: 'vsource', id: 'BUF13', a: 'D13_BUF', b: 'GND', volts: pin13 ? 5 : 0 });
  const r = solve({ components: comps });
  return Math.max(0, r.currents['LED_L'] ?? 0);
}
