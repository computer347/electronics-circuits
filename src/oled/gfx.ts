/**
 * A 128 × 64 SSD1306 OLED and the Adafruit GFX drawing library that sketches use for it, in
 * plain TypeScript. The drawing routines follow GFX's own algorithms (its Bresenham line, its
 * midpoint circles, its scanline triangles, its 6 × 8 text cell), so a sketch lights the same
 * pixels here as on the real screen.
 *
 * Two memories, as on the real thing: the sketch draws into a buffer in the Arduino's RAM, and
 * `display()` copies it over I²C into the screen's own RAM, which is what you see. Until then
 * the screen keeps showing whatever it had (at power-up, random snow).
 */
import { glyph } from './font';
import { iconBytes, type IconId } from './icons';

export const W = 128, H = 64;
export type Ink = 0 | 1 | 2; // BLACK, WHITE, INVERSE
export const BLACK: Ink = 0, WHITE: Ink = 1, INVERSE: Ink = 2;

export class Gfx {
  /** SSD1306 page layout: byte x + (y >> 3) * 128, bit y & 7. */
  buf = new Uint8Array((W * H) / 8);
  rotation = 0;
  cx = 0; cy = 0; size = 1;
  fg: Ink = WHITE; bg: Ink = WHITE; // bg == fg: transparent background (GFX's convention)
  wrap = true;

  width() { return this.rotation & 1 ? H : W; }
  height() { return this.rotation & 1 ? W : H; }

  pixel(x: number, y: number, c: Ink) {
    x = Math.trunc(x); y = Math.trunc(y);
    switch (this.rotation) {
      case 1: [x, y] = [W - y - 1, x]; break;
      case 2: [x, y] = [W - x - 1, H - y - 1]; break;
      case 3: [x, y] = [y, H - x - 1]; break;
    }
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = x + (y >> 3) * W, bit = 1 << (y & 7);
    if (c === WHITE) this.buf[i]! |= bit; else if (c === BLACK) this.buf[i]! &= ~bit; else this.buf[i]! ^= bit;
  }

  clear() { this.buf.fill(0); }
  hline(x: number, y: number, w: number, c: Ink) { for (let i = 0; i < w; i++) this.pixel(x + i, y, c); }
  vline(x: number, y: number, h: number, c: Ink) { for (let i = 0; i < h; i++) this.pixel(x, y + i, c); }

  line(x0: number, y0: number, x1: number, y1: number, c: Ink) {
    if (x0 === x1) { if (y0 > y1) [y0, y1] = [y1, y0]; this.vline(x0, y0, y1 - y0 + 1, c); return; }
    if (y0 === y1) { if (x0 > x1) [x0, x1] = [x1, x0]; this.hline(x0, y0, x1 - x0 + 1, c); return; }
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
    if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
    const dx = x1 - x0, dy = Math.abs(y1 - y0), ystep = y0 < y1 ? 1 : -1;
    let err = Math.trunc(dx / 2);
    for (; x0 <= x1; x0++) {
      if (steep) this.pixel(y0, x0, c); else this.pixel(x0, y0, c);
      err -= dy;
      if (err < 0) { y0 += ystep; err += dx; }
    }
  }

  rect(x: number, y: number, w: number, h: number, c: Ink) {
    if (w <= 0 || h <= 0) return;
    this.hline(x, y, w, c); this.hline(x, y + h - 1, w, c);
    this.vline(x, y + 1, h - 2, c); this.vline(x + w - 1, y + 1, h - 2, c);
  }
  fillRect(x: number, y: number, w: number, h: number, c: Ink) { for (let i = 0; i < w; i++) this.vline(x + i, y, h, c); }

  circle(x0: number, y0: number, r: number, c: Ink) {
    let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
    this.pixel(x0, y0 + r, c); this.pixel(x0, y0 - r, c); this.pixel(x0 + r, y0, c); this.pixel(x0 - r, y0, c);
    while (x < y) {
      if (f >= 0) { y--; ddy += 2; f += ddy; }
      x++; ddx += 2; f += ddx;
      for (const [a, b] of [[x, y], [-x, y], [x, -y], [-x, -y], [y, x], [-y, x], [y, -x], [-y, -x]] as const) this.pixel(x0 + a, y0 + b, c);
    }
  }

  private circleHelper(x0: number, y0: number, r: number, corner: number, c: Ink) {
    let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
    while (x < y) {
      if (f >= 0) { y--; ddy += 2; f += ddy; }
      x++; ddx += 2; f += ddx;
      if (corner & 4) { this.pixel(x0 + x, y0 + y, c); this.pixel(x0 + y, y0 + x, c); }
      if (corner & 2) { this.pixel(x0 + x, y0 - y, c); this.pixel(x0 + y, y0 - x, c); }
      if (corner & 8) { this.pixel(x0 - y, y0 + x, c); this.pixel(x0 - x, y0 + y, c); }
      if (corner & 1) { this.pixel(x0 - y, y0 - x, c); this.pixel(x0 - x, y0 - y, c); }
    }
  }

  private fillCircleHelper(x0: number, y0: number, r: number, corners: number, delta: number, c: Ink) {
    let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r, px = x, py = y;
    delta++;
    while (x < y) {
      if (f >= 0) { y--; ddy += 2; f += ddy; }
      x++; ddx += 2; f += ddx;
      if (x < y + 1) {
        if (corners & 1) this.vline(x0 + x, y0 - y, 2 * y + delta, c);
        if (corners & 2) this.vline(x0 - x, y0 - y, 2 * y + delta, c);
      }
      if (y !== py) {
        if (corners & 1) this.vline(x0 + py, y0 - px, 2 * px + delta, c);
        if (corners & 2) this.vline(x0 - py, y0 - px, 2 * px + delta, c);
        py = y;
      }
      px = x;
    }
  }

  fillCircle(x0: number, y0: number, r: number, c: Ink) { this.vline(x0, y0 - r, 2 * r + 1, c); this.fillCircleHelper(x0, y0, r, 3, 0, c); }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: Ink) {
    r = Math.min(r, Math.trunc(Math.min(w, h) / 2));
    this.hline(x + r, y, w - 2 * r, c); this.hline(x + r, y + h - 1, w - 2 * r, c);
    this.vline(x, y + r, h - 2 * r, c); this.vline(x + w - 1, y + r, h - 2 * r, c);
    this.circleHelper(x + r, y + r, r, 1, c); this.circleHelper(x + w - r - 1, y + r, r, 2, c);
    this.circleHelper(x + w - r - 1, y + h - r - 1, r, 4, c); this.circleHelper(x + r, y + h - r - 1, r, 8, c);
  }
  fillRoundRect(x: number, y: number, w: number, h: number, r: number, c: Ink) {
    r = Math.min(r, Math.trunc(Math.min(w, h) / 2));
    this.fillRect(x + r, y, w - 2 * r, h, c);
    this.fillCircleHelper(x + w - r - 1, y + r, r, 1, h - 2 * r - 1, c);
    this.fillCircleHelper(x + r, y + r, r, 2, h - 2 * r - 1, c);
  }

  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Ink) {
    this.line(x0, y0, x1, y1, c); this.line(x1, y1, x2, y2, c); this.line(x2, y2, x0, y0, c);
  }
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Ink) {
    if (y0 > y1) { [y0, y1] = [y1, y0]; [x0, x1] = [x1, x0]; }
    if (y1 > y2) { [y2, y1] = [y1, y2]; [x2, x1] = [x1, x2]; }
    if (y0 > y1) { [y0, y1] = [y1, y0]; [x0, x1] = [x1, x0]; }
    if (y0 === y2) {
      let a = x0, b = x0;
      if (x1 < a) a = x1; else if (x1 > b) b = x1;
      if (x2 < a) a = x2; else if (x2 > b) b = x2;
      this.hline(a, y0, b - a + 1, c);
      return;
    }
    const dx01 = x1 - x0, dy01 = y1 - y0, dx02 = x2 - x0, dy02 = y2 - y0, dx12 = x2 - x1, dy12 = y2 - y1;
    let sa = 0, sb = 0, y = y0;
    const last = y1 === y2 ? y1 : y1 - 1;
    for (; y <= last; y++) {
      let a = x0 + Math.trunc(sa / dy01), b = x0 + Math.trunc(sb / dy02);
      sa += dx01; sb += dx02;
      if (a > b) [a, b] = [b, a];
      this.hline(a, y, b - a + 1, c);
    }
    sa = dx12 * (y - y1); sb = dx02 * (y - y0);
    for (; y <= y2; y++) {
      let a = x1 + Math.trunc(sa / dy12), b = x0 + Math.trunc(sb / dy02);
      sa += dx12; sb += dx02;
      if (a > b) [a, b] = [b, a];
      this.hline(a, y, b - a + 1, c);
    }
  }

  /** drawBitmap: rows of bytes, MSB leftmost; only set bits are drawn. */
  bitmap(x: number, y: number, bytes: number[], w: number, h: number, c: Ink) {
    const bw = (w + 7) >> 3;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bytes[j * bw + (i >> 3)]! & (0x80 >> (i & 7))) this.pixel(x + i, y + j, c);
  }
  icon(x: number, y: number, id: IconId, c: Ink) { this.bitmap(x, y, iconBytes(id), 16, 16, c); }

  /** One character in its 6 × 8 cell (× size), GFX's drawChar. */
  char(x: number, y: number, code: number, c: Ink, bg: Ink, size: number) {
    if (x >= this.width() || y >= this.height() || x + 6 * size - 1 < 0 || y + 8 * size - 1 < 0) return;
    const cols = glyph(code);
    for (let i = 0; i < 6; i++) {
      let line = i < 5 ? cols[i]! : 0;
      for (let j = 0; j < 8; j++, line >>= 1) {
        if (line & 1) { if (size === 1) this.pixel(x + i, y + j, c); else this.fillRect(x + i * size, y + j * size, size, size, c); }
        else if (bg !== c) { if (size === 1) this.pixel(x + i, y + j, bg); else this.fillRect(x + i * size, y + j * size, size, size, bg); }
      }
    }
  }

  write(ch: string) {
    if (ch === '\n') { this.cx = 0; this.cy += this.size * 8; return; }
    if (ch === '\r') return;
    if (this.wrap && this.cx + this.size * 6 > this.width()) { this.cx = 0; this.cy += this.size * 8; }
    this.char(this.cx, this.cy, ch.charCodeAt(0), this.fg, this.bg, this.size);
    this.cx += this.size * 6;
  }
  print(s: string) { for (const ch of s) this.write(ch); }
}

/** What the library leaves in the buffer at begin(): its splash picture (a flower and its name). */
export function splash(): Uint8Array {
  const g = new Gfx();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.fillCircle(64 + Math.round(Math.cos(a) * 9), 22 + Math.round(Math.sin(a) * 9), 6, WHITE);
  }
  g.fillCircle(64, 22, 4, BLACK);
  g.size = 1; g.cx = 40; g.cy = 44; g.print('adafruit');
  return g.buf;
}

/** The screen's own RAM at power-up: random snow (the same snow every time, here). */
export function powerUpNoise(seed = 7): Uint8Array {
  const out = new Uint8Array((W * H) / 8);
  let s = seed >>> 0;
  for (let i = 0; i < out.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; out[i] = s >>> 24; }
  return out;
}

/** A page-layout buffer as one 0/1 byte per pixel, row by row. */
export function toPixels(ram: Uint8Array): Uint8Array {
  const px = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = (ram[x + (y >> 3) * W]! >> (y & 7)) & 1;
  return px;
}

export const litCount = (px: Uint8Array) => px.reduce((n, v) => n + v, 0);

/**
 * Where `text` appears on the screen, in any size 1–4: the glyphs' pixels must match exactly
 * (their blank cell column and row may touch other things). `inverse` looks for dark text on a
 * lit background. Returns the first place found, or null.
 */
export function findText(px: Uint8Array, text: string, opts: { inverse?: boolean } = {}): { x: number; y: number; size: number } | null {
  if (!text) return null;
  for (let size = 1; size <= 4; size++) {
    const g = new Gfx();
    g.size = size; g.wrap = false; g.print(text);
    const tw = text.length * 6 * size - size, th = 7 * size;
    if (tw > W || th > H) break;
    const ref = toPixels(g.buf);
    const want = (i: number, j: number) => (ref[j * W + i]! ^ (opts.inverse ? 1 : 0));
    // Only a rough pre-check per position: the top-left glyph column, then the whole thing.
    for (let y = 0; y + th <= H; y++) {
      for (let x = 0; x + tw <= W; x++) {
        let ok = true;
        for (let j = 0; j < th && ok; j++) for (let i = 0; i < tw; i++) if (px[(y + j) * W + x + i] !== want(i, j)) { ok = false; break; }
        if (ok) return { x, y, size };
      }
    }
  }
  return null;
}

/** Whether a 16 × 16 icon is drawn anywhere on the screen, pixel for pixel (lit and dark). */
export function findIcon(px: Uint8Array, id: IconId): { x: number; y: number } | null {
  const bytes = iconBytes(id);
  const bit = (i: number, j: number) => ((bytes[j * 2 + (i >> 3)]! & (0x80 >> (i & 7))) ? 1 : 0);
  for (let y = 0; y + 16 <= H; y++) {
    for (let x = 0; x + 16 <= W; x++) {
      let ok = true;
      for (let j = 0; j < 16 && ok; j++) for (let i = 0; i < 16; i++) if (px[(y + j) * W + x + i] !== bit(i, j)) { ok = false; break; }
      if (ok) return { x, y };
    }
  }
  return null;
}
