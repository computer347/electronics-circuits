import { describe, expect, it } from 'vitest';
import { checkCoding, CODING_JOBS, OLED_HELLO, OLED_PROGRESS, OLED_STATUS, OLED_UPTIME } from '../src/coding/jobs';
import { codeOf, compile, makeNode as m, run, screenAt, sketch, type Program } from '../src/coding/program';
import { findIcon, findText, Gfx, litCount, splash, toPixels, W } from '../src/oled/gfx';
import { iconBytes } from '../src/oled/icons';

const px = (g: Gfx) => toPixels(g.buf);
const at = (p: Uint8Array, x: number, y: number) => p[y * W + x];

describe('the GFX drawing routines', () => {
  it('draws lines the Bresenham way, end points included', () => {
    const g = new Gfx();
    g.line(0, 0, 9, 3, 1);
    const p = px(g);
    expect(litCount(p)).toBe(10);
    expect([at(p, 0, 0), at(p, 9, 3)]).toEqual([1, 1]);
    // GFX's error term starts at dx / 2: the first step down comes at x = 2
    expect([at(p, 1, 0), at(p, 2, 1)]).toEqual([1, 1]);
  });

  it('draws a radius-10 circle through its four extreme points, symmetric, and fills the disc', () => {
    const g = new Gfx();
    g.circle(30, 30, 10, 1);
    const p = px(g);
    for (const [x, y] of [[40, 30], [20, 30], [30, 40], [30, 20]]) expect(at(p, x!, y!)).toBe(1);
    for (let y = 18; y <= 42; y++) for (let x = 18; x <= 42; x++) expect(at(p, x, y)).toBe(at(p, 60 - x, y));
    const f = new Gfx();
    f.fillCircle(30, 30, 10, 1);
    // a filled disc of radius 10 is close to π r² pixels
    expect(Math.abs(litCount(px(f)) - Math.PI * 100)).toBeLessThan(40);
  });

  it('lays text in 6 × 8 cells: size 2 is 12 × 16, and the cursor moves on', () => {
    const g = new Gfx();
    g.size = 2; g.print('Hi');
    expect([g.cx, g.cy]).toEqual([24, 0]);
    g.print('\n');
    expect([g.cx, g.cy]).toEqual([0, 16]);
    expect(findText(px(g), 'Hi')).toEqual({ x: 0, y: 0, size: 2 });
  });

  it('wraps text at the edge only when wrap is on', () => {
    const g = new Gfx();
    g.print('x'.repeat(22));
    expect(g.cy).toBe(8); // 21 characters fit across 128 pixels
    const h = new Gfx();
    h.wrap = false; h.print('x'.repeat(22));
    expect(h.cy).toBe(0);
  });

  it('turns drawing with setRotation, and inverts with INVERSE', () => {
    const g = new Gfx();
    g.rotation = 1; g.pixel(0, 0, 1);
    expect(at(px(g), 127, 0)).toBe(1);
    g.rotation = 0; g.fillRect(0, 0, 4, 4, 1); g.fillRect(2, 2, 4, 4, 2);
    expect([at(px(g), 3, 3), at(px(g), 5, 5)]).toEqual([0, 1]);
  });

  it('fills triangles and rounded rectangles inside their outlines', () => {
    const g = new Gfx();
    g.fillTriangle(10, 10, 30, 10, 20, 30, 1);
    expect(at(px(g), 20, 15)).toBe(1);
    expect(at(px(g), 11, 25)).toBe(0);
    const r = new Gfx();
    r.fillRoundRect(0, 0, 20, 10, 4, 1);
    expect(at(px(r), 0, 0)).toBe(0); // the corner is rounded off
    expect(at(px(r), 10, 5)).toBe(1);
  });

  it('packs icons the way sketches store bitmaps, and finds them on the screen', () => {
    expect(iconBytes('heart')).toHaveLength(32);
    const g = new Gfx();
    g.icon(40, 20, 'wifi', 1);
    expect(findIcon(px(g), 'wifi')).toEqual({ x: 40, y: 20 });
    expect(findIcon(px(g), 'heart')).toBeNull();
  });
});

const hello = (): Program => ({
  setup: [m('oledBegin'), m('oledClear'), m('oledTextSize', { size: 2 }), m('oledCursor'), m('oledPrint', { text: 'Hello!' }), m('oledShow')],
  loop: [],
});

describe('the screen on the Uno', () => {
  it('writes each node as the Adafruit library call, and the sketch with its includes', () => {
    expect(codeOf(m('oledBegin'))).toBe('display.begin(SSD1306_SWITCHCAPVCC, 0x3C);');
    expect(codeOf(m('oledRect', { fill: true, w: 'count' }))).toBe('display.fillRect(10, 10, count, 20, SSD1306_WHITE);');
    expect(codeOf(m('oledPrint', { what: 'seconds', newline: true }))).toBe('display.println(millis() / 1000);');
    expect(codeOf(m('oledTextColor', { color: 'BLACK', bg: 'WHITE' }))).toBe('display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);');
    const s = sketch({ setup: [m('oledBegin'), m('oledIcon')], loop: [m('countAdd')] });
    expect(s).toContain('#include <Adafruit_SSD1306.h>');
    expect(s).toContain('Adafruit_SSD1306 display(128, 64, &Wire, -1);');
    expect(s).toContain('int count = 0;');
    expect(s).toContain('static const unsigned char PROGMEM heart_bmp[] = {');
  });

  it('shows nothing until display(): power-up snow, then the picture; display() takes 25 ms', () => {
    const p = hello();
    const r = run(p, 1000);
    expect(r.frames[0]!.t).toBe(0); // begin wakes the panel, showing its own RAM
    expect(findText(screenAt(r, 0), 'Hello!')).toBeNull();
    expect(r.frames[1]!.t).toBe(25);
    expect(findText(screenAt(r, 30), 'Hello!')).toEqual({ x: 0, y: 0, size: 2 });
  });

  it('leaves the library’s splash in the buffer if you show without clearing', () => {
    const r = run({ setup: [m('oledBegin'), m('oledShow')], loop: [] }, 100);
    expect([...r.frames[1]!.ram]).toEqual([...splash()]);
  });

  it('stays dark at the wrong I²C address, and says why', () => {
    const r = run({ ...hello(), setup: [m('oledBegin', { addr: '0x3D' }), ...hello().setup.slice(1)] }, 500);
    expect(litCount(screenAt(r, 400))).toBe(0);
    expect(r.notes[0]).toMatch(/Nothing answers at 0x3D/);
  });

  it('inverts and scrolls the whole screen without a display()', () => {
    const r = run({ setup: [...hello().setup, m('oledInvert'), m('oledScroll', { dir: 'right' })], loop: [] }, 3000);
    const s = screenAt(r, 30);
    expect(findText(s, 'Hello!', { inverse: true })).toEqual({ x: 0, y: 0, size: 2 });
    // 16 px a second: two seconds later it has moved 32 to the right
    expect(findText(screenAt(r, 2030), 'Hello!', { inverse: true })).toEqual({ x: 32, y: 0, size: 2 });
  });

  it('warns about a screen that’s never started or never shown, and notes the 1 KB buffer', () => {
    const c = compile({ setup: [m('oledPrint')], loop: [] });
    expect(c.problems.map((x) => x.message).join(' ')).toMatch(/Nothing starts the screen/);
    expect(c.problems.map((x) => x.message).join(' ')).toMatch(/Nothing is ever shown/);
    expect(compile(hello()).notes[0]).toMatch(/1,024 bytes of RAM/);
    expect(compile({ setup: [m('oledBegin'), m('oledTextColor', { color: 'BLACK' }), m('oledPrint'), m('oledShow')], loop: [] }).problems.some((x) => /invisible/.test(x.message))).toBe(true);
  });
});

describe('the screen jobs', () => {
  it('Hello: passes, and names the splash, the missing Show, the wrong text', () => {
    expect(checkCoding(OLED_HELLO, hello()).pass).toBe(true);
    expect(checkCoding(OLED_HELLO, { setup: [m('oledBegin'), m('oledShow')], loop: [] }).message).toMatch(/splash/);
    expect(checkCoding(OLED_HELLO, { setup: hello().setup.slice(0, 5), loop: [] }).message).toMatch(/random snow/);
    expect(checkCoding(OLED_HELLO, { setup: hello().setup.map((n) => (n.kind === 'oledPrint' ? { ...n, text: 'hello' } : n)), loop: [] }).message).toMatch(/says “hello”/);
    expect(checkCoding(OLED_HELLO, { setup: [], loop: [] }).message).toMatch(/nothing starts it/);
  });

  const uptime = (): Program => ({
    setup: [m('oledBegin')],
    loop: [m('oledClear'), m('oledCursor'), m('oledTextSize', { size: 2 }), m('oledPrint', { what: 'seconds' }), m('oledShow'), m('wait', { ms: 1000 })],
  });

  it('Uptime: passes with clear, cursor, print seconds, show, wait 1000; explains the usual slips', () => {
    expect(checkCoding(OLED_UPTIME, uptime())).toMatchObject({ pass: true });
    const without = (k: string) => ({ ...uptime(), loop: uptime().loop.filter((n) => n.kind !== k) });
    expect(checkCoding(OLED_UPTIME, without('oledClear')).message).toMatch(/pile up/);
    expect(checkCoding(OLED_UPTIME, without('oledCursor')).message).toMatch(/moves the cursor on/);
    expect(checkCoding(OLED_UPTIME, { ...uptime(), loop: uptime().loop.map((n) => (n.kind === 'oledPrint' ? { ...n, what: 'millis' as const } : n)) }).message).toMatch(/milliseconds/);
  });

  const bar = (wrap = true, clear = true): Program => ({
    setup: [m('oledBegin')],
    loop: [
      ...(clear ? [m('oledClear')] : []),
      m('oledRect', { x: 10, y: 28, w: 108, h: 10 }), m('oledRect', { x: 12, y: 30, w: 'count', h: 6, fill: true }),
      m('oledShow'), m('countAdd', { by: 2 }), ...(wrap ? [m('countWrap', { at: 104 })] : []), m('wait', { ms: 50 }),
    ],
  });

  it('Loading bar: passes when the fill grows and restarts inside a frame', () => {
    expect(checkCoding(OLED_PROGRESS, bar())).toMatchObject({ pass: true });
    expect(checkCoding(OLED_PROGRESS, bar(false)).message).toMatch(/never starts again/);
    expect(checkCoding(OLED_PROGRESS, bar(true, false)).message).toMatch(/without "Clear"/);
  });

  it('Status: passes with a bar, reverse title and an icon; catches white-on-white', () => {
    const ok: Program = {
      setup: [m('oledBegin'), m('oledClear'), m('oledRect', { x: 0, y: 0, w: 128, h: 12, fill: true }), m('oledTextColor', { color: 'BLACK', bg: 'WHITE' }),
        m('oledCursor', { x: 2, y: 2 }), m('oledPrint', { text: 'STATUS' }), m('oledIcon', { x: 56, y: 30 }), m('oledShow')],
      loop: [],
    };
    expect(checkCoding(OLED_STATUS, ok)).toMatchObject({ pass: true });
    expect(checkCoding(OLED_STATUS, { ...ok, setup: ok.setup.filter((n) => n.kind !== 'oledTextColor') }).message).toMatch(/white text on white/);
    expect(checkCoding(OLED_STATUS, { ...ok, setup: ok.setup.filter((n) => n.kind !== 'oledIcon') }).message).toMatch(/no icon/);
  });

  it('every screen job has the OLED, a real-life goal, and fails from its start', () => {
    for (const j of CODING_JOBS.filter((x) => x.module)) {
      expect(j.palette).toContain('screen');
      expect(checkCoding(j, j.start).pass).toBe(false);
    }
  });
});
