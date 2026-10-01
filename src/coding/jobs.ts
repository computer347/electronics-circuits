/**
 * Coding jobs: a board on the desk, a program to write for it in nodes, and what the board
 * has to do once it's uploaded.
 */
import { boardComponents } from '../repair/repair';
import { solve } from '../sim';
import { findIcon, findText, litCount, splash, toPixels, powerUpNoise, W } from '../oled/gfx';
import { ICONS } from '../oled/icons';
import { compile, makeNode, measureBlink, run, screenAt, type Group, type Program, type RunResult } from './program';

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
  check?: { pin: number; on: [number, number]; off: [number, number] };
  /** Or a judge of its own (the screen jobs). */
  judge?: (p: Program) => CodingCheck;
  /** Free play: never judged. */
  free?: boolean;
  /** What else is on the mat, wired to the board: the OLED. */
  module?: 'oled-096';
  /** Which groups of nodes the palette offers. */
  palette: Group[];
  /** The result card: its title, and the one-star rule. */
  done: { title: string; rule: string };
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
  palette: ['pins'],
  done: { title: 'It’s alive', rule: 'Blinks once a second' },
};

// ---------------------------------------------------------------- the OLED jobs

const SCREEN: Group[] = ['screen', 'text', 'draw', 'effects', 'count', 'pins'];
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * The things that go wrong before anything you drew can show, in the order a person would
 * check them, judged by what the screen shows at time t. Null when the screen shows the
 * sketch's own picture.
 */
function screenTrouble(p: Program, r: RunResult, t: number): string | null {
  const begun = [...p.setup, ...p.loop].some((n) => n.kind === 'oledBegin');
  if (!begun) return 'The screen stays dark: nothing starts it. Put "Start the screen" at the top of setup.';
  if (r.notes.some((x) => x.startsWith('Nothing answers'))) return r.notes.find((x) => x.startsWith('Nothing answers'))!;
  const ram = r.frames.filter((f) => f.t <= t && f.on).pop()?.ram;
  if (ram && same(ram, powerUpNoise())) {
    return 'The screen shows random snow: that’s its own memory at power-up. Nothing was ever sent to it: add "Show" after you draw.';
  }
  if (ram && same(ram, splash())) return 'That flower is the library’s splash picture: it’s in the buffer from the start. "Clear" before you draw, then "Show".';
  return null;
}

const screenOf = (r: RunResult, t: number) => screenAt(r, t);

export const OLED_HELLO: CodingJob = {
  id: 'oled-hello',
  title: 'Hello, screen',
  board: 'arduino-uno',
  module: 'oled-096',
  story: 'The club has wired a little 0.96" OLED to the Uno (GND, VCC, SCL to A5, SDA to A4). Before it can show anything useful, it has to show something.',
  goal: 'Make the screen say “Hello!”: start it, clear it, print the text and show it.',
  skill: 'Drive a graphics screen from a sketch: start it at its I²C address, draw into the picture in memory, then send it with display().',
  realLife: 'Thermostats, 3D printers, smart plugs and fitness bands all have a screen like this one on the same two I²C wires. Every one of them is “draw into a buffer, then send it”.',
  hints: [
    'Setup: "Start the screen" (address 0x3C, the usual one for these modules). Then "Clear", or the library’s splash picture is still in the buffer.',
    'Then "Text size" 2 (big and readable), "Cursor" 0, 0 (the top left), and "Print" with the text Hello!',
    'Nothing appears until you "Show": it sends the picture over I²C. Setup: Start, Clear, Text size 2, Cursor 0 0, Print "Hello!", Show. The loop can stay empty.',
  ],
  start: { setup: [], loop: [] },
  palette: SCREEN,
  done: { title: 'Hello yourself', rule: 'The screen says Hello!' },
  judge: (p) => {
    const c = compile(p);
    if (!c.ok) return fail(c.problems.find((x) => x.level === 'error')!.message);
    const r = run(p, 3000);
    const trouble = screenTrouble(p, r, 3000);
    if (trouble) return fail(trouble);
    const px = screenOf(r, 3000);
    if (findText(px, 'Hello!')) return pass('The screen says Hello!');
    if (findText(px, 'Hello!', { inverse: true })) return pass('The screen says Hello! (dark on light).');
    const said = r.printed.filter((x) => x.t <= 3000).map((x) => x.text).join('');
    if (said && said !== 'Hello!') return fail(`The screen says “${said}”. The club asked for “Hello!”, exactly: capital H, and the !.`);
    if (said) return fail(litCount(px) ? 'The text runs off the edge, or something is drawn over it: start it at the cursor 0, 0.' : 'The text was printed but the screen is blank: is the text colour BLACK? Or was it cleared again before Show?');
    return fail('The screen doesn’t say Hello! yet: add a "Print" with the text Hello!');
  },
};

export const OLED_UPTIME: CodingJob = {
  id: 'oled-uptime',
  title: 'Uptime clock',
  board: 'arduino-uno',
  module: 'oled-096',
  story: 'The greenhouse controller reboots itself now and then, and nobody notices. The club wants the screen to show how long it’s been running, so a reboot is obvious.',
  goal: 'Show how many seconds the board has been running, as a number that counts up every second.',
  skill: 'Update a screen in the loop: clear, draw the new value at a fixed place, show, wait. Redraw the whole picture each time.',
  realLife: 'Every live reading on a screen (a clock, a temperature, a speed) is this loop. Forget the clear and the digits pile up; forget the cursor and they march off the edge.',
  hints: [
    'Setup only starts the screen. The loop draws a fresh picture every time round: "Clear" first, so the old number goes.',
    'Then "Cursor" 0, 0 every time (each print moves the cursor on), "Text size" 2, and "Print" set to seconds running.',
    'Then "Show", and "Wait" 1000 ms. Loop: Clear, Cursor 0 0, Text size 2, Print seconds, Show, Wait 1000.',
  ],
  start: { setup: [], loop: [] },
  palette: SCREEN,
  done: { title: 'Counting up', rule: 'The seconds count up on the screen' },
  judge: (p) => {
    const c = compile(p);
    if (!c.ok) return fail(c.problems.find((x) => x.level === 'error')!.message);
    const r = run(p, 9000);
    const trouble = screenTrouble(p, r, 9000);
    if (trouble) return fail(trouble);
    const prints = p.loop.filter((n) => n.kind === 'oledPrint');
    if (!prints.length) return fail(p.setup.some((n) => n.kind === 'oledPrint') ? 'The number is printed once, in setup, so it never changes: printing belongs in the loop.' : 'Nothing prints the time: add a "Print" set to seconds running, in the loop.');
    if (!prints.some((n) => n.kind === 'oledPrint' && (n.what === 'seconds' || n.what === 'millis' || n.what === 'count'))) return fail('The loop prints text, not the time: set the Print to seconds running.');
    if (!p.loop.some((n) => n.kind === 'oledClear')) return fail('The numbers pile up on top of each other: "Clear" at the top of the loop, so each second starts from a blank picture.');
    if (!p.loop.some((n) => n.kind === 'oledCursor')) return fail('Each print moves the cursor on, so every second the number lands further along, and soon off the screen: set the "Cursor" at the top of the loop.');
    if (!p.loop.some((n) => n.kind === 'oledShow')) return fail('The loop draws the new number but never shows it: add "Show" after the Print.');
    for (const t of [2500, 4500, 7500]) {
      const want = String(Math.floor(t / 1000));
      const px = screenOf(r, t);
      // The last number printed before the screen's last picture is what it shows: it has to be
      // the seconds, whole (2050 starts with a 2, but it's milliseconds).
      const shownAt = r.frames.filter((f) => f.t <= t).pop()?.t ?? 0;
      const last = r.printed.filter((x) => x.t <= shownAt).pop();
      if (last?.text !== want || (!findText(px, want) && !findText(px, want, { inverse: true }))) {
        return fail(last ? `After ${want} s the screen shows ${last.text}: ${Number(last.text) > Number(want) * 10 ? 'that’s milliseconds. Print seconds running instead.' : 'it isn’t keeping up. One pass of the loop should take a second: Wait 1000.'}` : `After ${want} s nothing is on the screen.`);
      }
    }
    return pass('The screen counts the seconds up, once a second.');
  },
};

export const OLED_PROGRESS: CodingJob = {
  id: 'oled-progress',
  title: 'Loading bar',
  board: 'arduino-uno',
  module: 'oled-096',
  story: 'The club’s data logger takes a few seconds to start, and people unplug it thinking it has hung. A loading bar that fills up would stop that.',
  goal: 'Draw a bar outline that stays put, and a filled bar inside it that grows a little every time round the loop, then starts again from empty.',
  skill: 'Animate with a variable: change a number each pass of the loop and draw with it, and wrap it round so it repeats.',
  realLife: 'Progress bars, battery gauges, volume meters and signal-strength bars are all one rectangle whose width is a number the program keeps changing.',
  hints: [
    'Setup starts the screen. In the loop: "Clear", then a "Rectangle" outline, say x 10, y 28, w 108, h 10. That’s the frame.',
    'Then a filled "Rectangle" inside it, x 12, y 30, h 6, and its width set to count. Then "Show", and a short "Wait" (50 ms).',
    'count has to grow: "Add to count" by 2, then "Start count again" at 104, so the fill restarts when it reaches the end of the frame.',
  ],
  start: { setup: [], loop: [] },
  palette: SCREEN,
  done: { title: 'Loading…', rule: 'The bar fills up and starts again' },
  judge: (p) => {
    const c = compile(p);
    if (!c.ok) return fail(c.problems.find((x) => x.level === 'error')!.message);
    const r = run(p, 20000);
    const trouble = screenTrouble(p, r, 20000);
    if (trouble) return fail(trouble);
    const shows = r.frames.filter((f) => f.t > 500 && f.on);
    if (shows.length < 10) return fail('The picture hardly changes: the loop has to draw and "Show" every pass.');
    const lit = shows.map((f) => litCount(toPixels(f.ram)));
    let run1 = 0, best = 0, drops = 0;
    for (let i = 1; i < lit.length; i++) {
      if (lit[i]! > lit[i - 1]!) { run1++; best = Math.max(best, run1); } else if (lit[i]! < lit[i - 1]!) { drops++; run1 = 0; }
    }
    const usesCount = p.loop.some((n) => n.kind === 'oledRect' && n.w === 'count');
    if (best < 8) return fail(usesCount ? 'The bar doesn’t grow: count never changes. Add "Add to count" in the loop.' : 'The bar doesn’t grow: set the filled rectangle’s width to count, and add to count every pass.');
    if (drops === 0) return fail(p.loop.some((n) => n.kind === 'oledClear') ? 'The bar grows past the end and never starts again: add "Start count again" at the width of the frame.' : 'The bar only ever grows: without "Clear" at the top of the loop, the old picture never goes away.');
    // the frame: a long straight line that's there in every picture
    const outlined = shows.every((f) => {
      const px = toPixels(f.ram);
      for (let y = 0; y < 64; y++) { let n = 0; for (let x = 0; x < W; x++) { n = px[y * W + x] ? n + 1 : 0; if (n >= 60) return true; } }
      return false;
    });
    if (!outlined) return fail('The fill grows and restarts, but there’s no frame round it: draw a Rectangle outline (not filled), long enough for the whole bar.');
    return pass('The bar fills up inside its frame, then starts again.');
  },
};

export const OLED_STATUS: CodingJob = {
  id: 'oled-status',
  title: 'Status screen',
  board: 'arduino-uno',
  module: 'oled-096',
  story: 'The club’s weather station needs a proper front screen: a title bar across the top, like a phone’s, and a picture under it so you can tell what it’s showing from across the room.',
  goal: 'Draw a white bar across the top with dark text in it (any title), and an icon under it.',
  skill: 'Lay out a screen: filled shapes for bars, highlighted text (black on white), and bitmaps stored in the sketch.',
  realLife: 'Menus and title bars on every small screen are drawn this way: a filled rectangle with the text in reverse on it, and icons that are just bytes in the program.',
  hints: [
    'Setup: start, clear. Then a filled WHITE "Rectangle" across the top: x 0, y 0, w 128, h 12.',
    '"Text colour" BLACK with a WHITE background, "Cursor" 2, 2, and "Print" a title, like STATUS. Dark text on the white bar.',
    'Then an "Icon" under the bar, say at 56, 30, in WHITE, and "Show". (Text colour back to WHITE if you print more.)',
  ],
  start: { setup: [], loop: [] },
  palette: SCREEN,
  done: { title: 'Looking sharp', rule: 'A title bar with dark text, and an icon' },
  judge: (p) => {
    const c = compile(p);
    if (!c.ok) return fail(c.problems.find((x) => x.level === 'error')!.message);
    const r = run(p, 3000);
    const trouble = screenTrouble(p, r, 3000);
    if (trouble) return fail(trouble);
    const px = screenOf(r, 3000);
    let top = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < W; x++) top += px[y * W + x]!;
    if (top < 0.6 * 8 * W) return fail('There’s no bar across the top: draw a filled WHITE Rectangle at 0, 0, the full 128 wide and about 12 high.');
    const titles = r.printed.filter((x) => x.t <= 3000 && x.y < 12 && x.text.trim());
    if (!titles.some((x) => findText(px, x.text, { inverse: true }))) return fail(titles.length ? 'The title doesn’t show on the bar: white text on white is invisible. Text colour BLACK, with a WHITE background.' : 'The bar has no title: set the cursor inside it and print one.');
    if (!ICONS.some((id) => findIcon(px, id))) return fail(p.setup.concat(p.loop).some((n) => n.kind === 'oledIcon') ? 'The icon doesn’t show: is it on the screen (x 0–112, y 0–48) and WHITE, and not under the bar?' : 'There’s no icon yet: add an "Icon" under the bar.');
    return pass('A title bar in reverse, and an icon under it.');
  },
};

export const OLED_SANDBOX: CodingJob = {
  id: 'oled-sandbox',
  title: 'Screen sandbox',
  board: 'arduino-uno',
  module: 'oled-096',
  story: 'A free bench: the Uno and its screen, every node there is, and no client waiting.',
  goal: 'Try anything: text, shapes, icons, counting, invert, dim, rotate, scroll. “Show the code” gives you the real sketch.',
  skill: 'Explore what a graphics library can do, and read the Arduino code each node writes.',
  realLife: 'The nodes are the Adafruit SSD1306 library’s real calls: the sketch the bench shows runs as it is on a real Uno with a real screen.',
  hints: [
    'Start the screen in setup, draw in the loop, and Show after drawing. Clear at the top of the loop for animation.',
    'count makes things move: set a shape’s x to count, Add to count, Start count again at 128.',
    'Invert, Dim and Scroll act on the whole screen at once, without a Show.',
  ],
  start: {
    setup: [makeNode('oledBegin'), makeNode('oledClear'), makeNode('oledTextSize', { size: 2 }), makeNode('oledCursor'), makeNode('oledPrint', { text: 'Hi there' }), makeNode('oledCircle', { x: 100, y: 44, r: 12 }), makeNode('oledShow')],
    loop: [],
  },
  free: true,
  palette: SCREEN,
  done: { title: 'Sandbox', rule: '' },
};

export const CODING_JOBS: CodingJob[] = [BLINK, OLED_HELLO, OLED_UPTIME, OLED_PROGRESS, OLED_STATUS, OLED_SANDBOX];
export const codingJobById = (id: string) => CODING_JOBS.find((j) => j.id === id);

export interface CodingCheck { pass: boolean; message: string; on: number | null; off: number | null }

const pass = (message: string): CodingCheck => ({ pass: true, message, on: null, off: null });
const fail = (message: string): CodingCheck => ({ pass: false, message, on: null, off: null });

export function checkCoding(job: CodingJob, p: Program): CodingCheck {
  if (job.free) return fail('Free play: nothing to pass here.');
  if (job.judge) return job.judge(p);
  if (!job.check) return fail('This job has no check.');
  const check = job.check;
  const c = compile(p);
  if (!c.ok) return { pass: false, message: c.problems.find((x) => x.level === 'error')!.message, on: null, off: null };
  const r = run(p, 6000);
  const { on, off } = measureBlink(r, check.pin);
  if (r.pulledUp.includes(check.pin)) return { pass: false, message: `The LED only glows faintly: pin ${check.pin} isn't an output, so HIGH just turns its pull-up on.`, on, off };
  if (on === null || off === null) {
    const lit = r.changes.some((x) => x.pin === check.pin && x.level === 1);
    // With no waits, a loop that writes both levels (or flips) flickers too fast to see.
    const mine = p.loop.filter((x) => (x.kind === 'write' || x.kind === 'toggle') && x.pin === check.pin);
    const flickers = r.loopMs === 0 && (mine.some((x) => x.kind === 'toggle') || new Set(mine.map((x) => (x.kind === 'write' ? x.level : ''))).size > 1);
    return { pass: false, message: flickers ? 'The LED flips too fast to see: the loop has no waits, so it just looks half-lit.' : lit ? 'The LED comes on and stays on: it never turns off.' : 'The LED never comes on.', on, off };
  }
  const inside = (x: number, [a, b]: [number, number]) => x >= a && x <= b;
  if (!inside(on, check.on) || !inside(off, check.off)) {
    return { pass: false, message: `It blinks, ${on} ms on and ${off} ms off. The club wants ${check.on[0]}–${check.on[1]} ms each.`, on, off };
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
