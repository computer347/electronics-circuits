/**
 * Node programs for a microcontroller, and how the board runs them. A program is two lanes of
 * nodes, the way every Arduino sketch is: `setup` runs once, `loop` runs forever. Each node is
 * one line of real Arduino code (the editor shows it under the node, and `sketch()` prints the
 * whole thing, ready to paste into the Arduino IDE).
 *
 * The board doesn't emulate the chip: a `Runner` walks the lanes in board time, driving pins and
 * an SSD1306 OLED on I²C (src/oled/gfx.ts). Nodes take no time except waits and `display()`,
 * which takes 25 ms to send the 1 KB buffer over I²C at 400 kHz.
 */
import { Gfx, powerUpNoise, splash, toPixels, W, H, type Ink } from '../oled/gfx';
import { printable } from '../oled/font';
import { ICONS, ICON_NAME, iconBytes, type IconId } from '../oled/icons';

export type Level = 'HIGH' | 'LOW';
/** A number, or the program's `count` variable. */
export type Num = number | 'count';
export type InkName = 'WHITE' | 'BLACK' | 'INVERSE';
export type ScrollDir = 'right' | 'left' | 'diagright' | 'diagleft' | 'stop';
export type PrintWhat = 'text' | 'count' | 'seconds' | 'millis';

export type ProgramNode =
  | { id: string; kind: 'pinMode'; pin: number; mode: 'OUTPUT' | 'INPUT' }
  | { id: string; kind: 'write'; pin: number; level: Level }
  | { id: string; kind: 'toggle'; pin: number }
  | { id: string; kind: 'wait'; ms: number }
  | { id: string; kind: 'oledBegin'; addr: '0x3C' | '0x3D' }
  | { id: string; kind: 'oledClear' }
  | { id: string; kind: 'oledShow' }
  | { id: string; kind: 'oledTextSize'; size: number }
  | { id: string; kind: 'oledTextColor'; color: InkName; bg: 'none' | 'BLACK' | 'WHITE' }
  | { id: string; kind: 'oledCursor'; x: Num; y: Num }
  | { id: string; kind: 'oledPrint'; what: PrintWhat; text: string; newline: boolean }
  | { id: string; kind: 'oledPixel'; x: Num; y: Num; color: InkName }
  | { id: string; kind: 'oledLine'; x0: Num; y0: Num; x1: Num; y1: Num; color: InkName }
  | { id: string; kind: 'oledRect'; x: Num; y: Num; w: Num; h: Num; r: number; fill: boolean; color: InkName }
  | { id: string; kind: 'oledCircle'; x: Num; y: Num; r: Num; fill: boolean; color: InkName }
  | { id: string; kind: 'oledTriangle'; x0: Num; y0: Num; x1: Num; y1: Num; x2: Num; y2: Num; fill: boolean; color: InkName }
  | { id: string; kind: 'oledIcon'; x: Num; y: Num; icon: IconId; color: InkName }
  | { id: string; kind: 'oledInvert'; on: boolean }
  | { id: string; kind: 'oledDim'; on: boolean }
  | { id: string; kind: 'oledRotate'; r: number }
  | { id: string; kind: 'oledWrap'; on: boolean }
  | { id: string; kind: 'oledScroll'; dir: ScrollDir }
  | { id: string; kind: 'countAdd'; by: number }
  | { id: string; kind: 'countWrap'; at: number }
  | { id: string; kind: 'countSet'; to: number };

export type NodeKind = ProgramNode['kind'];

export interface Program { setup: ProgramNode[]; loop: ProgramNode[] }

export interface BoardPins {
  /** Digital pins you can use. */
  pins: number[];
  /** Pins with something on the board already (the Uno's L LED is on 13). */
  onboard: Record<number, string>;
}

export const UNO_PINS: BoardPins = { pins: Array.from({ length: 14 }, (_, i) => i), onboard: { 13: 'the L LED' } };

// ---------------------------------------------------------------- what the editor offers

export type Group = 'pins' | 'screen' | 'text' | 'draw' | 'effects' | 'count';
export const GROUP_NAME: Record<Group, string> = {
  pins: 'Pins and time', screen: 'Screen', text: 'Text', draw: 'Drawing', effects: 'Screen effects', count: 'Counting',
};

export type ParamType = 'pin' | 'int' | 'num' | 'choice' | 'text' | 'bool' | 'wait';
export interface ParamSpec { key: string; label: string; type: ParamType; options?: readonly (string | number)[]; names?: readonly string[]; min?: number; max?: number }

const INKS = ['WHITE', 'BLACK', 'INVERSE'] as const;
const ink: ParamSpec = { key: 'color', label: 'colour', type: 'choice', options: INKS };
const xy = (x: string, y: string): ParamSpec[] => [{ key: x, label: x, type: 'num', min: -64, max: 255 }, { key: y, label: y, type: 'num', min: -64, max: 255 }];

/** What the palette offers, in plain words, with the parameters each node has. */
export const NODE_INFO: Record<NodeKind, { title: string; what: string; group: Group; params: ParamSpec[] }> = {
  pinMode: { title: 'Pin mode', what: 'Make a pin an output (it drives) or an input (it listens).', group: 'pins', params: [{ key: 'pin', label: 'pin', type: 'pin' }, { key: 'mode', label: 'mode', type: 'choice', options: ['OUTPUT', 'INPUT'] }] },
  write: { title: 'Set pin', what: 'Drive an output pin HIGH (5 V) or LOW (0 V).', group: 'pins', params: [{ key: 'pin', label: 'pin', type: 'pin' }, { key: 'level', label: 'level', type: 'choice', options: ['HIGH', 'LOW'] }] },
  toggle: { title: 'Flip pin', what: 'HIGH becomes LOW, LOW becomes HIGH.', group: 'pins', params: [{ key: 'pin', label: 'pin', type: 'pin' }] },
  wait: { title: 'Wait', what: 'Do nothing for a while, in milliseconds (1000 ms = 1 s).', group: 'pins', params: [{ key: 'ms', label: 'ms', type: 'wait' }] },

  oledBegin: { title: 'Start the screen', what: 'Wake the OLED at its I²C address and take 1 KB of RAM for its picture. Once, in setup.', group: 'screen', params: [{ key: 'addr', label: 'address', type: 'choice', options: ['0x3C', '0x3D'] }] },
  oledClear: { title: 'Clear', what: 'Blank the picture in the Arduino’s memory (the screen won’t change until Show).', group: 'screen', params: [] },
  oledShow: { title: 'Show', what: 'Send the picture to the screen. Nothing you draw appears until you do. Takes 25 ms.', group: 'screen', params: [] },

  oledTextSize: { title: 'Text size', what: '1 is 6 × 8 pixels a letter (21 across); 2 doubles it, and so on.', group: 'text', params: [{ key: 'size', label: 'size', type: 'choice', options: [1, 2, 3, 4] }] },
  oledTextColor: { title: 'Text colour', what: 'WHITE on the dark screen; BLACK on a WHITE background for highlighted text.', group: 'text', params: [{ key: 'color', label: 'colour', type: 'choice', options: INKS }, { key: 'bg', label: 'background', type: 'choice', options: ['none', 'BLACK', 'WHITE'] }] },
  oledCursor: { title: 'Cursor', what: 'Where the next text starts: x across (0–127), y down (0–63), from the top left.', group: 'text', params: xy('x', 'y') },
  oledPrint: { title: 'Print', what: 'Write text, or a number, at the cursor. The cursor moves on after it.', group: 'text', params: [{ key: 'what', label: 'print', type: 'choice', options: ['text', 'count', 'seconds', 'millis'], names: ['text', 'count', 'seconds running', 'milliseconds'] }, { key: 'text', label: 'text', type: 'text' }, { key: 'newline', label: 'new line after', type: 'bool' }] },

  oledPixel: { title: 'Pixel', what: 'One dot.', group: 'draw', params: [...xy('x', 'y'), ink] },
  oledLine: { title: 'Line', what: 'A straight line from one point to another.', group: 'draw', params: [...xy('x0', 'y0'), ...xy('x1', 'y1'), ink] },
  oledRect: { title: 'Rectangle', what: 'From its top-left corner, w wide and h high; filled or outline, square or rounded corners.', group: 'draw', params: [...xy('x', 'y'), { key: 'w', label: 'w', type: 'num', min: 0, max: 255 }, { key: 'h', label: 'h', type: 'num', min: 0, max: 255 }, { key: 'r', label: 'corner', type: 'int', min: 0, max: 32 }, { key: 'fill', label: 'filled', type: 'bool' }, ink] },
  oledCircle: { title: 'Circle', what: 'Around a centre, with a radius; filled or outline.', group: 'draw', params: [...xy('x', 'y'), { key: 'r', label: 'radius', type: 'num', min: 0, max: 64 }, { key: 'fill', label: 'filled', type: 'bool' }, ink] },
  oledTriangle: { title: 'Triangle', what: 'Three corners; filled or outline.', group: 'draw', params: [...xy('x0', 'y0'), ...xy('x1', 'y1'), ...xy('x2', 'y2'), { key: 'fill', label: 'filled', type: 'bool' }, ink] },
  oledIcon: { title: 'Icon', what: 'A 16 × 16 picture stored in the sketch as bytes (a bitmap).', group: 'draw', params: [...xy('x', 'y'), { key: 'icon', label: 'icon', type: 'choice', options: ICONS, names: ICONS.map((i) => ICON_NAME[i]) }, ink] },

  oledInvert: { title: 'Invert', what: 'The screen shows black for white and white for black. Instant: no Show needed.', group: 'effects', params: [{ key: 'on', label: 'inverted', type: 'bool' }] },
  oledDim: { title: 'Dim', what: 'Turn the brightness down (saves power, and the screen lasts longer).', group: 'effects', params: [{ key: 'on', label: 'dim', type: 'bool' }] },
  oledRotate: { title: 'Rotate', what: 'Turn what you draw next by 90° steps (1 and 3 make the screen 64 wide, 128 high).', group: 'effects', params: [{ key: 'r', label: 'turns', type: 'choice', options: [0, 1, 2, 3] }] },
  oledWrap: { title: 'Text wrap', what: 'On: text that reaches the edge carries on on the next line. Off: it runs off the edge.', group: 'effects', params: [{ key: 'on', label: 'wrap', type: 'bool' }] },
  oledScroll: { title: 'Scroll', what: 'The screen slides the whole picture by itself, round and round, until you stop it.', group: 'effects', params: [{ key: 'dir', label: 'direction', type: 'choice', options: ['right', 'left', 'diagright', 'diagleft', 'stop'], names: ['right', 'left', 'up-right', 'up-left', 'stop'] }] },

  countAdd: { title: 'Add to count', what: 'count is a number the program remembers: this adds to it (or takes away).', group: 'count', params: [{ key: 'by', label: 'by', type: 'int', min: -100, max: 100 }] },
  countWrap: { title: 'Start count again', what: 'When count reaches a limit, set it back to 0, so it goes round and round.', group: 'count', params: [{ key: 'at', label: 'at', type: 'int', min: 1, max: 1000 }] },
  countSet: { title: 'Set count', what: 'Set count to a number.', group: 'count', params: [{ key: 'to', label: 'to', type: 'int', min: -1000, max: 1000 }] },
};

export const WAITS = [0, 10, 20, 50, 100, 200, 250, 500, 750, 1000, 2000];

let seq = 0;
export const newNode = (kind: NodeKind, pin = 13): ProgramNode => {
  const id = `n${++seq}-${Date.now().toString(36)}`;
  switch (kind) {
    case 'pinMode': return { id, kind, pin, mode: 'OUTPUT' };
    case 'write': return { id, kind, pin, level: 'HIGH' };
    case 'toggle': return { id, kind, pin };
    case 'wait': return { id, kind, ms: 500 };
    case 'oledBegin': return { id, kind, addr: '0x3C' };
    case 'oledClear': return { id, kind };
    case 'oledShow': return { id, kind };
    case 'oledTextSize': return { id, kind, size: 1 };
    case 'oledTextColor': return { id, kind, color: 'WHITE', bg: 'none' };
    case 'oledCursor': return { id, kind, x: 0, y: 0 };
    case 'oledPrint': return { id, kind, what: 'text', text: 'Hello', newline: false };
    case 'oledPixel': return { id, kind, x: 64, y: 32, color: 'WHITE' };
    case 'oledLine': return { id, kind, x0: 0, y0: 0, x1: 127, y1: 63, color: 'WHITE' };
    case 'oledRect': return { id, kind, x: 10, y: 10, w: 40, h: 20, r: 0, fill: false, color: 'WHITE' };
    case 'oledCircle': return { id, kind, x: 64, y: 32, r: 10, fill: false, color: 'WHITE' };
    case 'oledTriangle': return { id, kind, x0: 64, y0: 10, x1: 44, y1: 50, x2: 84, y2: 50, fill: false, color: 'WHITE' };
    case 'oledIcon': return { id, kind, x: 0, y: 0, icon: 'heart', color: 'WHITE' };
    case 'oledInvert': return { id, kind, on: true };
    case 'oledDim': return { id, kind, on: true };
    case 'oledRotate': return { id, kind, r: 0 };
    case 'oledWrap': return { id, kind, on: false };
    case 'oledScroll': return { id, kind, dir: 'right' };
    case 'countAdd': return { id, kind, by: 1 };
    case 'countWrap': return { id, kind, at: 100 };
    case 'countSet': return { id, kind, to: 0 };
  }
};

// ---------------------------------------------------------------- the code it stands for

const C = (c: InkName) => `SSD1306_${c}`;
const N = (v: Num) => (v === 'count' ? 'count' : String(v));
const quote = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const SCROLL_CODE: Record<ScrollDir, string> = {
  right: 'display.startscrollright(0x00, 0x0F);', left: 'display.startscrollleft(0x00, 0x0F);',
  diagright: 'display.startscrolldiagright(0x00, 0x07);', diagleft: 'display.startscrolldiagleft(0x00, 0x07);', stop: 'display.stopscroll();',
};

/** The node as the line of Arduino code it is. */
export function codeOf(n: ProgramNode): string {
  switch (n.kind) {
    case 'pinMode': return `pinMode(${n.pin}, ${n.mode});`;
    case 'write': return `digitalWrite(${n.pin}, ${n.level});`;
    case 'toggle': return `digitalWrite(${n.pin}, !digitalRead(${n.pin}));`;
    case 'wait': return `delay(${n.ms});`;
    case 'oledBegin': return `display.begin(SSD1306_SWITCHCAPVCC, ${n.addr});`;
    case 'oledClear': return 'display.clearDisplay();';
    case 'oledShow': return 'display.display();';
    case 'oledTextSize': return `display.setTextSize(${n.size});`;
    case 'oledTextColor': return n.bg === 'none' ? `display.setTextColor(${C(n.color)});` : `display.setTextColor(${C(n.color)}, ${C(n.bg)});`;
    case 'oledCursor': return `display.setCursor(${N(n.x)}, ${N(n.y)});`;
    case 'oledPrint': {
      const arg = n.what === 'text' ? quote(n.text) : n.what === 'count' ? 'count' : n.what === 'seconds' ? 'millis() / 1000' : 'millis()';
      return `display.${n.newline ? 'println' : 'print'}(${arg});`;
    }
    case 'oledPixel': return `display.drawPixel(${N(n.x)}, ${N(n.y)}, ${C(n.color)});`;
    case 'oledLine': return `display.drawLine(${N(n.x0)}, ${N(n.y0)}, ${N(n.x1)}, ${N(n.y1)}, ${C(n.color)});`;
    case 'oledRect': return n.r > 0
      ? `display.${n.fill ? 'fill' : 'draw'}RoundRect(${N(n.x)}, ${N(n.y)}, ${N(n.w)}, ${N(n.h)}, ${n.r}, ${C(n.color)});`
      : `display.${n.fill ? 'fill' : 'draw'}Rect(${N(n.x)}, ${N(n.y)}, ${N(n.w)}, ${N(n.h)}, ${C(n.color)});`;
    case 'oledCircle': return `display.${n.fill ? 'fill' : 'draw'}Circle(${N(n.x)}, ${N(n.y)}, ${N(n.r)}, ${C(n.color)});`;
    case 'oledTriangle': return `display.${n.fill ? 'fill' : 'draw'}Triangle(${N(n.x0)}, ${N(n.y0)}, ${N(n.x1)}, ${N(n.y1)}, ${N(n.x2)}, ${N(n.y2)}, ${C(n.color)});`;
    case 'oledIcon': return `display.drawBitmap(${N(n.x)}, ${N(n.y)}, ${n.icon}_bmp, 16, 16, ${C(n.color)});`;
    case 'oledInvert': return `display.invertDisplay(${n.on});`;
    case 'oledDim': return `display.dim(${n.on});`;
    case 'oledRotate': return `display.setRotation(${n.r});`;
    case 'oledWrap': return `display.setTextWrap(${n.on});`;
    case 'oledScroll': return SCROLL_CODE[n.dir];
    case 'countAdd': return n.by >= 0 ? `count = count + ${n.by};` : `count = count - ${-n.by};`;
    case 'countWrap': return `if (count >= ${n.at}) count = 0;`;
    case 'countSet': return `count = ${n.to};`;
  }
}

const isOled = (n: ProgramNode) => n.kind.startsWith('oled');
const usesCount = (n: ProgramNode) => n.kind.startsWith('count') || Object.values(n).includes('count');
export const usesScreen = (p: Program) => [...p.setup, ...p.loop].some(isOled);

/** The whole program as an Arduino sketch, with the libraries, globals and bitmaps it needs. */
export function sketch(p: Program): string {
  const all = [...p.setup, ...p.loop];
  const lane = (ns: ProgramNode[]) => ns.map((n) => `  ${codeOf(n)}`).join('\n');
  const head: string[] = [];
  if (all.some(isOled)) head.push('#include <Wire.h>', '#include <Adafruit_GFX.h>', '#include <Adafruit_SSD1306.h>', '', '// 128 × 64 pixels, on I²C (Wire), no reset pin', 'Adafruit_SSD1306 display(128, 64, &Wire, -1);');
  if (all.some(usesCount)) head.push('int count = 0;');
  const icons = [...new Set(all.filter((n): n is Extract<ProgramNode, { kind: 'oledIcon' }> => n.kind === 'oledIcon').map((n) => n.icon))];
  for (const id of icons) {
    const hex = iconBytes(id).map((b) => `0x${b.toString(16).padStart(2, '0')}`);
    const rows = Array.from({ length: 8 }, (_, i) => `  ${hex.slice(i * 4, i * 4 + 4).join(', ')}`).join(',\n');
    head.push('', `// ${ICON_NAME[id]}, 16 × 16`, `static const unsigned char PROGMEM ${id}_bmp[] = {\n${rows}\n};`);
  }
  return `${head.length ? `${head.join('\n')}\n\n` : ''}void setup() {\n${lane(p.setup)}\n}\n\nvoid loop() {\n${lane(p.loop)}\n}\n`;
}

// ---------------------------------------------------------------- compiling

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
  /** Notes the console prints after the size (the screen's RAM). */
  notes: string[];
}

const DRAWS: NodeKind[] = ['oledPrint', 'oledPixel', 'oledLine', 'oledRect', 'oledCircle', 'oledTriangle', 'oledIcon', 'oledClear'];
const nums = (n: ProgramNode) => Object.entries(n).filter(([k, v]) => typeof v === 'number' && ['x', 'y', 'x0', 'y0', 'x1', 'y1', 'x2', 'y2'].includes(k)) as [string, number][];

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
  const loopMs = loopTime(p);
  const changes = p.loop.some((n) => n.kind === 'write' || n.kind === 'toggle');
  if (changes && loopMs === 0) problems.push({ level: 'warning', message: 'The loop never waits, so the pin flips thousands of times a second: an LED just looks half-lit. Add a Wait.' });
  // An empty loop is fine once setup has put a picture on the screen: it stays there.
  if (p.loop.length === 0 && !p.setup.some((n) => n.kind === 'oledShow')) problems.push({ level: 'warning', message: 'The loop is empty: after setup, the board does nothing.' });

  // The screen
  const notes: string[] = [];
  const screen = all.some(isOled);
  if (screen) {
    const begin = p.setup.find((n) => n.kind === 'oledBegin');
    if (!begin) problems.push({ level: 'warning', message: p.loop.some((n) => n.kind === 'oledBegin') ? 'Start the screen in setup: starting it again every loop resets it and flickers.' : 'Nothing starts the screen: add "Start the screen" to setup, or it stays dark.' });
    for (const n of p.loop) if (n.kind === 'oledBegin') problems.push({ node: n.id, level: 'warning', message: 'Start the screen once, in setup: every pass round the loop it resets the screen.' });
    if (all.some((n) => DRAWS.includes(n.kind)) && !all.some((n) => n.kind === 'oledShow')) {
      problems.push({ level: 'warning', message: 'Nothing is ever shown: drawing only changes the picture in the Arduino’s memory. Add "Show" after you draw.' });
    }
    for (const n of all) {
      if (n.kind === 'oledPrint' && n.what === 'text' && !printable(n.text)) problems.push({ node: n.id, level: 'warning', message: 'The built-in font only has plain English letters, digits and symbols: other characters come out as boxes.' });
      if (n.kind === 'oledTextColor' && n.color === 'BLACK' && n.bg === 'none' && !all.some((m) => (m.kind === 'oledRect' || m.kind === 'oledCircle' || m.kind === 'oledTriangle') && m.fill && m.color === 'WHITE') && !all.some((m) => m.kind === 'oledInvert' && m.on)) {
        problems.push({ node: n.id, level: 'warning', message: 'Black text with no background is invisible on the dark screen. Give it a WHITE background, or draw it over something white.' });
      }
      const off = nums(n).find(([k, v]) => (k.startsWith('x') ? v > 127 : v > 63) || v < -32);
      if (off && (n.kind === 'oledCursor' || n.kind === 'oledPixel')) problems.push({ node: n.id, level: 'warning', message: `${off[0]} = ${off[1]} is off the screen: it’s 128 wide (x 0–127) and 64 high (y 0–63).` });
    }
    const scrollAt = p.loop.findIndex((n) => n.kind === 'oledScroll' && n.dir !== 'stop');
    if (scrollAt >= 0 && p.loop.some((n, i) => n.kind === 'oledShow' && i !== scrollAt)) {
      problems.push({ level: 'warning', message: 'Showing a new picture while the screen scrolls garbles it: stop the scroll, show, then scroll again.' });
    }
    notes.push('The screen’s picture (128 × 64 = 8,192 pixels, 1 bit each) takes 1,024 bytes of RAM when it starts: half of the Uno’s 2,048.');
  }
  const text = all.some((n) => n.kind === 'oledPrint');
  const bytes = 444 + all.length * 18 + (all.some((n) => n.kind === 'wait') ? 280 : 0) + (screen ? 9200 : 0) + (text ? 1600 : 0);
  return { ok: !problems.some((x) => x.level === 'error'), problems, bytes, notes };
}

/** One pass of the loop, in ms: its waits, plus 25 ms for each Show. */
export function loopTime(p: Program): number {
  return p.loop.reduce((s, n) => s + (n.kind === 'wait' ? Math.max(0, n.ms) : n.kind === 'oledShow' ? SHOW_MS : 0), 0);
}

// ---------------------------------------------------------------- running

/** display(): 1,024 bytes plus overhead over I²C at 400 kHz. */
export const SHOW_MS = 25;
/** How fast the screen's own scroll slides the picture, pixels a second. */
export const SCROLL_PX_S = 16;

export interface PinChange { t: number; pin: number; level: 0 | 1 }

/** What the screen is showing from time `t` on. */
export interface Frame {
  t: number;
  /** The screen's own RAM (page layout). */
  ram: Uint8Array;
  on: boolean;
  invert: boolean;
  dim: boolean;
  scroll: { dir: Exclude<ScrollDir, 'stop'>; t0: number } | null;
}

export interface Printed { t: number; text: string; x: number; y: number; size: number }

const INK: Record<InkName, Ink> = { BLACK: 0, WHITE: 1, INVERSE: 2 };

/**
 * Runs a program in board time. `advanceTo(t)` runs every node due by then; waits and Show
 * move the clock on. A loop that takes no time at all runs once (its steady state).
 */
export class Runner {
  t = 0;
  level: Record<number, 0 | 1> = {};
  output = new Set<number>();
  pulled = new Set<number>();
  changes: PinChange[] = [];
  frames: Frame[] = [];
  printed: Printed[] = [];
  /** Things the board did that the player should hear about (wrong address…). */
  notes: string[] = [];
  count = 0;
  gfx: Gfx | null = null;
  addrOk = false;
  panel: Frame = { t: 0, ram: powerUpNoise(), on: false, invert: false, dim: false, scroll: null };
  /** Bumped whenever the panel changes, for whoever draws it. */
  version = 0;
  stalled = false;
  private lane: 'setup' | 'loop' = 'setup';
  private i = 0;
  private passStart = 0;
  private done = false;

  constructor(readonly program: Program, readonly record = true) {}

  private frame(patch: Partial<Frame>) {
    this.panel = { ...this.panel, ...patch, t: this.t };
    this.version++;
    if (this.record) this.frames.push(this.panel);
  }

  advanceTo(T: number) {
    const p = this.program;
    while (!this.done) {
      const nodes = this.lane === 'setup' ? p.setup : p.loop;
      if (this.i >= nodes.length) {
        if (this.lane === 'setup') { this.lane = 'loop'; this.i = 0; this.passStart = this.t; if (!p.loop.length) this.done = true; continue; }
        if (this.t === this.passStart) { this.stalled = true; this.done = true; break; }
        this.i = 0; this.passStart = this.t;
        continue;
      }
      if (this.t > T) break;
      this.exec(nodes[this.i]!);
      this.i++;
    }
  }

  private v(x: Num) { return x === 'count' ? this.count : x; }

  private exec(n: ProgramNode) {
    const g = this.gfx;
    switch (n.kind) {
      case 'pinMode': if (n.mode === 'OUTPUT') this.output.add(n.pin); else this.output.delete(n.pin); break;
      case 'write': case 'toggle': {
        const v: 0 | 1 = n.kind === 'write' ? (n.level === 'HIGH' ? 1 : 0) : ((this.level[n.pin] ?? 0) ? 0 : 1);
        if (!this.output.has(n.pin)) { if (v) this.pulled.add(n.pin); break; }
        if ((this.level[n.pin] ?? 0) !== v) { this.level[n.pin] = v; this.changes.push({ t: this.t, pin: n.pin, level: v }); }
        break;
      }
      case 'wait': this.t += Math.max(0, n.ms); break;
      case 'oledBegin': {
        // The library allocates its buffer and puts its splash picture in it; the screen only
        // wakes if something answers at that address (this module is 0x3C).
        this.gfx = new Gfx();
        this.gfx.buf.set(splash());
        this.addrOk = n.addr === '0x3C';
        if (this.addrOk) this.frame({ on: true });
        else if (!this.notes.some((x) => x.includes(n.addr))) this.notes.push(`Nothing answers at ${n.addr}: this screen is at 0x3C (its back says 0x78, the same address written the 8-bit way). It stays dark.`);
        break;
      }
      case 'oledShow':
        if (!g) { if (!this.notes.some((x) => x.startsWith('Show before'))) this.notes.push('Show before the screen was started does nothing: there’s no picture to send yet.'); break; }
        this.t += SHOW_MS;
        if (this.addrOk) this.frame({ ram: g.buf.slice() });
        break;
      case 'oledInvert': if (this.addrOk) this.frame({ invert: n.on }); break;
      case 'oledDim': if (this.addrOk) this.frame({ dim: n.on }); break;
      case 'oledScroll': if (this.addrOk) this.frame({ scroll: n.dir === 'stop' ? null : { dir: n.dir, t0: this.t } }); break;
      case 'countAdd': this.count += n.by; break;
      case 'countWrap': if (this.count >= n.at) this.count = 0; break;
      case 'countSet': this.count = n.to; break;
      default: {
        // Drawing goes into the buffer; before the screen starts there isn't one.
        if (!g) break;
        switch (n.kind) {
          case 'oledClear': g.clear(); break;
          case 'oledTextSize': g.size = Math.max(1, Math.round(n.size)); break;
          case 'oledTextColor': g.fg = INK[n.color]; g.bg = n.bg === 'none' ? g.fg : INK[n.bg]; break;
          case 'oledCursor': g.cx = this.v(n.x); g.cy = this.v(n.y); break;
          case 'oledPrint': {
            const s = n.what === 'text' ? n.text : n.what === 'count' ? String(this.count) : n.what === 'seconds' ? String(Math.floor(this.t / 1000)) : String(Math.floor(this.t));
            this.printed.push({ t: this.t, text: s, x: g.cx, y: g.cy, size: g.size });
            g.print(n.newline ? `${s}\n` : s);
            break;
          }
          case 'oledPixel': g.pixel(this.v(n.x), this.v(n.y), INK[n.color]); break;
          case 'oledLine': g.line(this.v(n.x0), this.v(n.y0), this.v(n.x1), this.v(n.y1), INK[n.color]); break;
          case 'oledRect': {
            const [x, y, w, h] = [this.v(n.x), this.v(n.y), this.v(n.w), this.v(n.h)];
            if (n.r > 0) (n.fill ? g.fillRoundRect(x, y, w, h, n.r, INK[n.color]) : g.roundRect(x, y, w, h, n.r, INK[n.color]));
            else (n.fill ? g.fillRect(x, y, w, h, INK[n.color]) : g.rect(x, y, w, h, INK[n.color]));
            break;
          }
          case 'oledCircle': (n.fill ? g.fillCircle(this.v(n.x), this.v(n.y), this.v(n.r), INK[n.color]) : g.circle(this.v(n.x), this.v(n.y), this.v(n.r), INK[n.color])); break;
          case 'oledTriangle': {
            const a = [this.v(n.x0), this.v(n.y0), this.v(n.x1), this.v(n.y1), this.v(n.x2), this.v(n.y2)] as const;
            if (n.fill) g.fillTriangle(...a, INK[n.color]); else g.triangle(...a, INK[n.color]);
            break;
          }
          case 'oledIcon': g.icon(this.v(n.x), this.v(n.y), n.icon, INK[n.color]); break;
          case 'oledRotate': g.rotation = ((Math.round(n.r) % 4) + 4) % 4; break;
          case 'oledWrap': g.wrap = n.on; break;
        }
      }
    }
  }
}

/** The screen as 0/1 pixels at time t (scroll and invert applied); all dark when it's off. */
export function framePixels(f: Frame, t: number): Uint8Array {
  if (!f.on) return new Uint8Array(W * H);
  let px = toPixels(f.ram);
  if (f.scroll) {
    const steps = Math.floor(((t - f.scroll.t0) / 1000) * SCROLL_PX_S);
    const dx = (f.scroll.dir === 'right' || f.scroll.dir === 'diagright' ? 1 : -1) * steps;
    const dy = f.scroll.dir.startsWith('diag') ? steps : 0;
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = px[((((y + dy) % H) + H) % H) * W + ((((x - dx) % W) + W) % W)]!;
    px = out;
  }
  if (f.invert) px = px.map((v) => 1 - v);
  return px;
}

export interface RunResult {
  changes: PinChange[];
  /** Pins that were never made outputs but were written HIGH: they only pull up (weak, faint). */
  pulledUp: number[];
  /** Length of one pass of the loop, in ms (0 if it never waits). */
  loopMs: number;
  frames: Frame[];
  printed: Printed[];
  notes: string[];
}

/** Run the program for `untilMs` of board time and record what it did. */
export function run(p: Program, untilMs: number): RunResult {
  const r = new Runner(p);
  r.advanceTo(untilMs);
  return { changes: r.changes.filter((c) => c.t <= untilMs), pulledUp: [...r.pulled], loopMs: loopTime(p), frames: r.frames, printed: r.printed, notes: r.notes };
}

/** What the screen shows at time t in a run: power-up dark, then its frames. */
export function screenAt(r: RunResult, t: number): Uint8Array {
  let f: Frame | null = null;
  for (const x of r.frames) { if (x.t <= t) f = x; else break; }
  return f ? framePixels(f, t) : new Uint8Array(W * H);
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

/** A node of a kind, with some of its settings changed: `makeNode('oledPrint', { text: 'Hi' })`. */
export const makeNode = <K extends NodeKind>(kind: K, patch: Partial<Omit<Extract<ProgramNode, { kind: K }>, 'id' | 'kind'>> = {}) =>
  ({ ...newNode(kind), ...patch }) as Extract<ProgramNode, { kind: K }>;
