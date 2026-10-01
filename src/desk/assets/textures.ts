/**
 * Canvas textures for the desk: wood, cork, paper, the notebook's task page, the meter's LCD
 * and the riso poster. Everything is drawn in code (no image files).
 */
import * as THREE from 'three';
import type { TaskPage, TaskPicture } from '../taskPages';

export const INK = { paper: '#f1ece1', pink: '#ff48b0', blue: '#0078bf', yellow: '#ffe800', ink: '#1c0a3a' } as const;
export const FONT_DISPLAY = "'Anton', 'Impact', 'Arial Narrow', sans-serif";
export const FONT_MONO = "'Space Mono', ui-monospace, 'Courier New', monospace";

/** Small deterministic PRNG so textures look the same every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const cache = new Map<string, THREE.Texture>();
const once = (key: string, make: () => THREE.Texture) => {
  let t = cache.get(key);
  if (!t) { t = make(); cache.set(key, t); }
  return t;
};

/** Oak-ish desk top: long grain lines, a few knots, a worn lighter band along the front edge. */
export const woodTexture = () => once('wood', () => canvas(2048, 1024, (g) => {
  const r = rng(7);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#8a5a34'); grad.addColorStop(0.5, '#9a6a40'); grad.addColorStop(1, '#a8784a');
  g.fillStyle = grad; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 260; i++) {
    const y = r() * 1024, amp = 4 + r() * 14, f = 0.002 + r() * 0.004, ph = r() * 6;
    g.strokeStyle = `rgba(${60 + r() * 30},${32 + r() * 20},${16 + r() * 10},${0.08 + r() * 0.18})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    for (let x = 0; x <= 2048; x += 16) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  for (let k = 0; k < 4; k++) {
    const x = r() * 2048, y = r() * 1024;
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = `rgba(60,32,16,${0.25 - i * 0.02})`;
      g.beginPath(); g.ellipse(x, y, 10 + i * 9, 5 + i * 3, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  // Worn front edge: where wrists rest, the finish is lighter.
  const wear = g.createLinearGradient(0, 1024, 0, 900);
  wear.addColorStop(0, 'rgba(230,200,160,0.35)'); wear.addColorStop(1, 'rgba(230,200,160,0)');
  g.fillStyle = wear; g.fillRect(0, 900, 2048, 124);
}));

export const corkTexture = () => once('cork', () => canvas(512, 512, (g) => {
  const r = rng(3);
  g.fillStyle = '#b98a57'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const l = 90 + r() * 90;
    g.fillStyle = `rgba(${l + 40},${l},${l - 40},${0.35 + r() * 0.4})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3);
  }
}, [2, 1]));

export const wallTexture = () => once('wall', () => canvas(512, 512, (g) => {
  const r = rng(11);
  g.fillStyle = '#5f5446'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(255,240,220,${r() * 0.05})`;
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
}, [4, 2]));

/** A few paper fibres and a faint grain. */
function paperGrain(g: CanvasRenderingContext2D, w: number, h: number, seed: number, base: string = INK.paper) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 60; i++) {
    g.fillStyle = `rgba(80,60,30,${r() * 0.05})`;
    g.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
}

/** The riso poster on the wall: big overprinted "SIGNAL PATH" and a sine. */
export const posterTexture = () => once('poster', () => canvas(600, 840, (g) => {
  paperGrain(g, 600, 840, 5);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = INK.yellow; g.beginPath(); g.arc(380, 300, 210, 0, Math.PI * 2); g.fill();
  g.font = `180px ${FONT_DISPLAY}`; g.textBaseline = 'top';
  g.fillStyle = INK.pink; g.fillText('SIGNAL', 44, 120);
  g.fillStyle = INK.blue; g.fillText('SIGNAL', 52, 128);
  g.fillStyle = INK.pink; g.fillText('PATH', 44, 330);
  g.fillStyle = INK.blue; g.fillText('PATH', 52, 338);
  g.lineWidth = 10; g.strokeStyle = INK.pink; g.beginPath();
  for (let x = 40; x <= 560; x += 5) g.lineTo(x, 660 + Math.sin(x / 40) * 60);
  g.stroke();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = INK.ink; g.font = `bold 22px ${FONT_MONO}`;
  g.fillText('WORLD 0 · FOUNDATIONS', 44, 770);
}));

/** A level card pinned on the corkboard. */
export const levelCardTexture = (n: number, title: string, state: 'done' | 'here' | 'open' | 'later', world = 0) => once(`card${world}-${n}${state}`, () => canvas(256, 200, (g) => {
  paperGrain(g, 256, 200, 20 + n + world * 31, state === 'here' ? '#fff7c2' : INK.paper);
  g.globalCompositeOperation = 'multiply';
  g.font = `72px ${FONT_DISPLAY}`; g.textBaseline = 'top';
  g.fillStyle = state === 'later' ? '#b9b0a2' : INK.blue; g.fillText(`${world}–${n}`, 18, 14);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = INK.ink; g.font = `bold 20px ${FONT_MONO}`;
  g.fillText(title, 18, 110);
  if (state === 'done') { g.fillStyle = INK.pink; g.font = `36px ${FONT_DISPLAY}`; g.fillText('✓', 206, 20); }
  if (state === 'later') { g.fillStyle = '#9a9186'; g.font = `bold 18px ${FONT_MONO}`; g.fillText('locked', 18, 150); }
}));

/** A world's tab along the top of the corkboard. */
export const worldTabTexture = (n: number, name: string, on: boolean) => once(`tab${n}${on}`, () => canvas(256, 72, (g) => {
  g.fillStyle = on ? INK.pink : INK.paper; g.fillRect(0, 0, 256, 72);
  g.fillStyle = on ? INK.paper : INK.ink; g.font = `34px ${FONT_DISPLAY}`; g.textBaseline = 'middle';
  g.fillText(`WORLD ${n}`, 14, 38);
  g.font = `bold 15px ${FONT_MONO}`; g.fillText(name.toLowerCase(), 142, 40);
}));

/** The corkboard's last card: the free bench. */
export const freeBenchCardTexture = () => once('card-free', () => canvas(256, 200, (g) => {
  g.fillStyle = INK.blue; g.fillRect(0, 0, 256, 200);
  g.fillStyle = INK.paper; g.font = `46px ${FONT_DISPLAY}`; g.textBaseline = 'top';
  g.fillText('FREE', 18, 18); g.fillText('BENCH', 18, 66);
  g.font = `bold 18px ${FONT_MONO}`; g.fillText('build anything', 18, 150);
}));

/** The notebook cover: blue card with a white label. */
export const coverTexture = () => once('cover', () => canvas(512, 700, (g) => {
  g.fillStyle = '#23406e'; g.fillRect(0, 0, 512, 700);
  const r = rng(9);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * 512, r() * 700, 2, 2); }
  g.fillStyle = INK.paper; g.fillRect(90, 180, 332, 150);
  g.fillStyle = INK.ink; g.font = `58px ${FONT_DISPLAY}`; g.textBaseline = 'top';
  g.fillText('LAB BOOK', 118, 196);
  g.font = `bold 22px ${FONT_MONO}`; g.fillText('world 0', 120, 280);
}));

/**
 * The notebook's two-page spread for a level. Left: level and title, the target drawn as a
 * circuit, one big sentence, then the goal with its numbers and the story. Right: the part's
 * datasheet, a tip, and the four steps. Pictures first, a few words second.
 */
export const taskPagesTexture = (p: TaskPage) => once(`task:${p.label}`, () => canvas(2048, 1400, (g) => {
  ruledSpread(g, 2048, 1400);
  g.textBaseline = 'top';

  // ---- left page
  const L = 150;
  g.fillStyle = INK.blue; g.font = `78px ${FONT_DISPLAY}`; g.fillText(p.label, L, 60);
  g.fillStyle = INK.ink; g.font = `54px ${FONT_DISPLAY}`; g.fillText(p.title, L, 150);
  g.save(); g.translate(L + 40, 250); drawPicture(g, p.picture); g.restore();
  g.fillStyle = INK.ink; g.font = `bold 52px ${FONT_MONO}`;
  let y = wrap(g, p.headline, L, 720, 780, 62);
  g.font = `32px ${FONT_MONO}`; g.fillStyle = '#2b2140';
  y = wrap(g, p.goal, L, y + 36, 780, 44);
  g.font = `italic 27px ${FONT_MONO}`; g.fillStyle = '#5b5068';
  wrap(g, p.story, L, y + 30, 780, 38);

  // ---- right page
  const R = 1160;
  g.fillStyle = INK.blue; g.font = `64px ${FONT_DISPLAY}`; g.fillText('THE PARTS', R, 60);
  y = 160;
  if (p.datasheet) {
    g.fillStyle = INK.ink; g.font = `bold 36px ${FONT_MONO}`; g.fillText(p.datasheet.title, R, y);
    y += 64;
    for (const [k, v] of p.datasheet.rows) {
      g.font = `31px ${FONT_MONO}`; g.fillStyle = '#2b2140'; g.fillText(k, R, y);
      g.font = `bold 31px ${FONT_MONO}`; g.fillStyle = INK.ink; g.textAlign = 'right'; g.fillText(v, 1930, y); g.textAlign = 'left';
      g.strokeStyle = 'rgba(28,10,58,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(R, y + 46); g.lineTo(1930, y + 46); g.stroke();
      y += 58;
    }
  }
  // Tip, on a yellow overprint.
  y += 40;
  g.font = `bold 32px ${FONT_MONO}`;
  const lines = measureLines(g, p.tip, 700);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = INK.yellow; g.fillRect(R - 24, y - 18, 800, 90 + lines * 44);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = INK.pink; g.font = `44px ${FONT_DISPLAY}`; g.fillText('TIP', R, y);
  g.fillStyle = INK.ink; g.font = `bold 32px ${FONT_MONO}`;
  y = wrap(g, p.tip, R, y + 60, 740, 44);

  // What you walk away with, and where you'll meet it: the reason the level exists.
  if (p.skill) {
    y += 70;
    g.fillStyle = INK.blue; g.font = `44px ${FONT_DISPLAY}`; g.fillText('YOU’LL USE THIS', R, y);
    g.fillStyle = INK.ink; g.font = `bold 30px ${FONT_MONO}`;
    y = wrap(g, p.skill, R, y + 62, 760, 40);
    // Shrink the last paragraph if it would run into the steps.
    let size = 28;
    g.font = `${size}px ${FONT_MONO}`;
    while (size > 20 && y + 16 + measureLines(g, p.realLife, 760) * (size + 10) > 1140) { size -= 2; g.font = `${size}px ${FONT_MONO}`; }
    g.fillStyle = INK.ink;
    wrap(g, p.realLife, R, y + 16, 760, size + 10);
  }

  // The four steps, always the same.
  const steps: [string, string][] = [['read', 'this page'], ['build', 'or fix'], ['measure', 'with the meter'], ['go in', 'and clear it']];
  steps.forEach(([a, b], i) => {
    const sx = R + i * 200, sy = 1170;
    g.fillStyle = i === 0 ? INK.pink : INK.blue;
    g.beginPath(); g.arc(sx + 40, sy + 40, 38, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK.paper; g.font = `46px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.fillText(String(i + 1), sx + 40, sy + 14); g.textAlign = 'left';
    g.fillStyle = INK.ink; g.font = `bold 28px ${FONT_MONO}`; g.fillText(a, sx, sy + 96);
    g.font = `22px ${FONT_MONO}`; g.fillText(b, sx, sy + 132);
  });
}));

function ruledSpread(g: CanvasRenderingContext2D, w: number, h: number) {
  paperGrain(g, w, h, 13, '#f7f3e8');
  g.strokeStyle = 'rgba(0,120,191,0.13)'; g.lineWidth = 2;
  for (let y = 120; y < h; y += 58) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(255,72,176,0.3)';
  for (const x of [110, 1120]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  const sp = g.createLinearGradient(w / 2 - 70, 0, w / 2 + 70, 0);
  sp.addColorStop(0, 'rgba(0,0,0,0)'); sp.addColorStop(0.5, 'rgba(60,40,20,0.22)'); sp.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sp; g.fillRect(w / 2 - 70, 0, 140, h);
}

// ---- the target pictures: circuits in ink, what should glow in pink

function line(g: CanvasRenderingContext2D, pts: number[][]) {
  g.beginPath(); g.moveTo(pts[0]![0]!, pts[0]![1]!);
  for (const [x, y] of pts.slice(1)) g.lineTo(x!, y!);
  g.stroke();
}
/** Resistor zigzag from (x, y), horizontal (len 130) or vertical. */
function resistor(g: CanvasRenderingContext2D, x: number, y: number, vertical = false) {
  g.beginPath(); g.moveTo(x, y);
  for (let i = 0; i < 6; i++) {
    const t = 15 + i * 18, s = i % 2 ? -20 : 20;
    if (vertical) g.lineTo(x + s, y + t); else g.lineTo(x + t, y + s);
  }
  if (vertical) g.lineTo(x, y + 130); else g.lineTo(x + 130, y);
  g.stroke();
}
/** LED pointing down at (x, y) (anode on top), lit in pink with rays. */
function led(g: CanvasRenderingContext2D, x: number, y: number, lit = true) {
  g.fillStyle = lit ? INK.pink : 'transparent';
  g.beginPath(); g.moveTo(x - 38, y); g.lineTo(x + 38, y); g.lineTo(x, y + 64); g.closePath(); g.fill(); g.stroke();
  line(g, [[x - 38, y + 64], [x + 38, y + 64]]);
  if (lit) {
    g.save(); g.strokeStyle = INK.pink; g.lineWidth = 6;
    for (const [dx, dy] of [[60, -10], [72, 26], [58, 62]] as const) line(g, [[x + 46, y + 30], [x + 46 + dx * 0.8, y + 30 + dy * 0.8]]);
    g.restore();
  }
}
function battery(g: CanvasRenderingContext2D, x: number, y: number, label: string) {
  line(g, [[x - 40, y], [x + 40, y]]);
  g.lineWidth = 12; line(g, [[x - 22, y + 30], [x + 22, y + 30]]); g.lineWidth = 7;
  g.fillStyle = INK.ink; g.font = `bold 34px ${FONT_MONO}`; g.fillText('+', x + 48, y - 40);
  g.font = `bold 30px ${FONT_MONO}`; g.fillText(label, x - 150, y);
}

function drawPicture(g: CanvasRenderingContext2D, pic: TaskPicture) {
  g.strokeStyle = INK.ink; g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round';
  const top = 30, bot = 400, left = 60, right = 640;
  if (pic === 'led' || pic === 'two-leds') {
    battery(g, left, 190, pic === 'led' ? '' : '9 V');
    line(g, [[left, 190], [left, top], [240, top]]);
    resistor(g, 240, top);
    if (pic === 'led') {
      line(g, [[370, top], [right, top], [right, 150]]);
      led(g, right, 150);
      line(g, [[right, 214], [right, bot], [left, bot], [left, 220]]);
    } else {
      line(g, [[370, top], [right, top], [right, 80]]);
      led(g, right, 80);
      line(g, [[right, 144], [right, 230]]);
      led(g, right, 230);
      line(g, [[right, 294], [right, bot], [left, bot], [left, 220]]);
    }
  }
  if (pic === 'divider') {
    battery(g, left, 190, '9 V');
    line(g, [[left, 190], [left, top], [right, top], [right, 60]]);
    resistor(g, right, 60, true);
    line(g, [[right, 190], [right, 230]]);
    resistor(g, right, 230, true);
    line(g, [[right, 360], [right, bot], [left, bot], [left, 220]]);
    // the tap, and what it should read
    g.save(); g.strokeStyle = INK.pink; g.fillStyle = INK.pink; g.lineWidth = 7;
    line(g, [[right, 210], [right - 170, 210]]);
    g.beginPath(); g.arc(right - 180, 210, 12, 0, Math.PI * 2); g.fill();
    g.font = `64px ${FONT_DISPLAY}`; g.fillText('3.0 V', right - 390, 170);
    g.restore();
  }
  if (pic === 'fork') {
    // One supply, two branches side by side, each with its own resistor and LED.
    battery(g, left, 190, '9 V');
    line(g, [[left, 190], [left, top], [right, top]]);
    for (const x of [300, right]) {
      line(g, [[x, top], [x, 60]]);
      resistor(g, x, 60, true);
      line(g, [[x, 190], [x, 230]]);
      led(g, x, 230);
      line(g, [[x, 294], [x, bot]]);
    }
    line(g, [[right, bot], [left, bot], [left, 220]]);
    g.save(); g.fillStyle = INK.pink; g.font = `bold 30px ${FONT_MONO}`; g.fillText('I1 + I2', 120, top + 20); g.restore();
  }
  if (pic === 'button') {
    battery(g, left, 190, '9 V');
    line(g, [[left, 190], [left, top], [150, top]]);
    // the push button: a bar held above the gap, with its knob
    line(g, [[150, top], [175, top]]); line(g, [[245, top], [270, top]]);
    g.save(); g.strokeStyle = INK.pink; line(g, [[165, top + 22], [255, top + 22]]); line(g, [[210, top + 22], [210, top + 56]]); g.restore();
    resistor(g, 270, top);
    line(g, [[400, top], [right, top], [right, 150]]);
    led(g, right, 150);
    line(g, [[right, 214], [right, bot], [left, bot], [left, 220]]);
  }
  if (pic === 'cells') {
    // Three cells stacked, then the resistor and a blue LED.
    const cell = (y: number) => { line(g, [[left - 34, y], [left + 34, y]]); g.lineWidth = 12; line(g, [[left - 18, y + 26], [left + 18, y + 26]]); g.lineWidth = 7; };
    [60, 170, 280].forEach((y, i) => { cell(y); line(g, [[left, y + 26], [left, i < 2 ? y + 110 : bot]]); });
    g.fillStyle = INK.ink; g.font = `bold 26px ${FONT_MONO}`; g.fillText('3 x 1.5 V', left + 50, 190);
    line(g, [[left, 60], [left, top], [300, top]]);
    resistor(g, 300, top);
    line(g, [[430, top], [right, top], [right, 150]]);
    g.save(); g.fillStyle = '#3a8bff'; g.beginPath(); g.moveTo(right - 38, 150); g.lineTo(right + 38, 150); g.lineTo(right, 214); g.closePath(); g.fill(); g.stroke(); g.restore();
    line(g, [[right - 38, 214], [right + 38, 214]]);
    line(g, [[right, 214], [right, bot], [left, bot]]);
  }
  if (pic === 'bridge') {
    battery(g, left, 190, '9 V');
    line(g, [[left, 190], [left, top], [right, top]]);
    for (const x of [260, right]) { line(g, [[x, top], [x, 60]]); resistor(g, x, 60, true); line(g, [[x, 190], [x, 230]]); resistor(g, x, 230, true); line(g, [[x, 360], [x, bot]]); }
    line(g, [[right, bot], [left, bot], [left, 220]]);
    // the meter across the taps, reading zero
    g.save(); g.strokeStyle = INK.pink; g.lineWidth = 6;
    line(g, [[260, 210], [right, 210]]);
    g.beginPath(); g.arc((260 + right) / 2, 210, 40, 0, Math.PI * 2); g.fillStyle = INK.paper; g.fill(); g.stroke();
    g.fillStyle = INK.pink; g.font = `40px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('0 V', (260 + right) / 2, 212); g.textAlign = 'left'; g.textBaseline = 'top';
    g.restore();
  }
  if (pic === 'transistor') {
    // The LED and its resistor hang off the collector; the button feeds the base through R_B.
    const cx = 520;
    battery(g, left, 190, '9 V');
    line(g, [[left, 190], [left, top], [cx, top], [cx, 50]]);
    resistor(g, cx, 50, true);
    line(g, [[cx, 180], [cx, 196]]);
    led(g, cx, 196);
    line(g, [[cx, 260], [cx, 290], [470, 306]]);
    // NPN symbol: base bar, collector and emitter, the arrow on the emitter pointing out
    g.beginPath(); g.arc(486, 320, 50, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 9; line(g, [[466, 294], [466, 346]]); g.lineWidth = 7;
    line(g, [[470, 334], [cx, 352], [cx, bot]]);
    g.save(); g.fillStyle = INK.ink; g.beginPath(); g.moveTo(cx, 352); g.lineTo(497, 333); g.lineTo(492, 352); g.closePath(); g.fill(); g.restore();
    // base path: from the + rail, through the button, then R_B
    line(g, [[190, top], [190, 150]]);
    g.save(); g.strokeStyle = INK.pink; line(g, [[166, 162], [214, 162]]); line(g, [[190, 162], [190, 140]]); g.restore();
    line(g, [[190, 178], [190, 320], [230, 320]]);
    resistor(g, 230, 320);
    line(g, [[360, 320], [466, 320]]);
    line(g, [[cx, bot], [left, bot], [left, 220]]);
    g.save(); g.fillStyle = INK.pink; g.font = `bold 28px ${FONT_MONO}`;
    g.fillText('I_B', 380, 286); g.fillText('I_C = 200 × I_B', cx - 300, 236);
    g.fillStyle = INK.ink; g.font = `bold 26px ${FONT_MONO}`; g.fillText('Q1', 552, 300); g.fillText('R_B', 262, 362);
    g.restore();
  }
  if (pic === 'binary') {
    // Four lamps with their place values, showing 1101.
    const bits = [1, 1, 0, 1], worth = [8, 4, 2, 1];
    bits.forEach((b, i) => {
      const x = 110 + i * 150;
      g.save();
      g.beginPath(); g.arc(x, 150, 52, 0, Math.PI * 2);
      g.fillStyle = b ? '#ff3b30' : '#e8e2d6'; g.fill(); g.stroke();
      if (b) { g.globalAlpha = 0.25; g.beginPath(); g.arc(x, 150, 78, 0, Math.PI * 2); g.fillStyle = '#ff3b30'; g.fill(); }
      g.restore();
      g.fillStyle = INK.ink; g.font = `60px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.fillText(String(b), x, 230);
      g.fillStyle = INK.blue; g.font = `bold 30px ${FONT_MONO}`; g.fillText(String(worth[i]), x, 310);
      g.textAlign = 'left';
    });
    g.fillStyle = INK.pink; g.font = `bold 32px ${FONT_MONO}`; g.fillText('8 + 4 + 1 = 13', 200, 370);
  }
  if (pic === 'and' || pic === 'or') {
    battery(g, left, 190, '9 V');
    const sw = (x: number, y: number, label: string) => {
      line(g, [[x, y], [x + 20, y]]); line(g, [[x + 20, y], [x + 80, y - 30]]); line(g, [[x + 90, y], [x + 110, y]]);
      g.save(); g.fillStyle = INK.pink; g.font = `bold 28px ${FONT_MONO}`; g.fillText(label, x + 40, y - 70); g.restore();
    };
    if (pic === 'and') {
      line(g, [[left, 190], [left, top], [150, top]]);
      sw(150, top, 'A'); sw(260, top, 'B');
      line(g, [[370, top], [right, top], [right, 150]]);
    } else {
      line(g, [[left, 190], [left, top], [180, top]]);
      line(g, [[180, top], [180, top + 0]]);
      sw(180, top + 60, 'A'); sw(180, top + 170, 'B');
      line(g, [[180, top], [180, top + 170]]);
      line(g, [[290, top + 60], [380, top + 60]]); line(g, [[290, top + 170], [380, top + 170]]);
      line(g, [[380, top + 60], [380, top + 170]]);
      line(g, [[380, top + 60], [380, top], [right, top], [right, 150]]);
    }
    led(g, right, 150);
    line(g, [[right, 214], [right, bot], [left, bot], [left, 220]]);
    g.fillStyle = INK.ink; g.font = `bold 30px ${FONT_MONO}`; g.fillText(pic === 'and' ? 'A AND B' : 'A OR B', 380, 300);
  }
  if (pic === 'not' || pic === 'nand') {
    // Pull-up from + to the output, LED from the output to ground, transistor(s) below.
    const ox = 470;
    battery(g, left, 190, '9 V');
    line(g, [[left, 190], [left, top], [ox, top], [ox, 50]]);
    resistor(g, ox, 50, true);
    line(g, [[ox, 180], [ox, 210], [right, 210], [right, 230]]);
    led(g, right, 230);
    line(g, [[right, 294], [right, bot]]);
    const npn = (y: number) => {
      g.beginPath(); g.arc(ox - 20, y, 34, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 9; line(g, [[ox - 36, y - 20], [ox - 36, y + 20]]); g.lineWidth = 7;
      line(g, [[ox - 34, y - 8], [ox, y - 26]]); line(g, [[ox - 34, y + 8], [ox, y + 26]]);
      line(g, [[ox - 110, y], [ox - 36, y]]);
    };
    if (pic === 'not') {
      line(g, [[ox, 210], [ox, 264]]); npn(290); line(g, [[ox, 316], [ox, bot]]);
      g.save(); g.fillStyle = INK.pink; g.font = `bold 28px ${FONT_MONO}`; g.fillText('A', ox - 150, 300); g.restore();
    } else {
      line(g, [[ox, 210], [ox, 240]]); npn(266); line(g, [[ox, 292], [ox, 318]]); npn(344); line(g, [[ox, 370], [ox, bot]]);
      g.save(); g.fillStyle = INK.pink; g.font = `bold 28px ${FONT_MONO}`; g.fillText('A', ox - 150, 276); g.fillText('B', ox - 150, 354); g.restore();
    }
    line(g, [[right, bot], [left, bot], [left, 220]]);
    g.fillStyle = INK.ink; g.font = `bold 26px ${FONT_MONO}`; g.fillText('pull-up', ox + 14, 120);
    g.fillText(pic === 'not' ? 'out = NOT A' : 'out = NOT (A AND B)', 150, 380);
  }
  if (pic === 'rc') {
    battery(g, left, 190, '9 V');
    line(g, [[left, 190], [left, top], [140, top]]);
    // push button
    line(g, [[140, top], [160, top]]); line(g, [[160, top], [210, top - 26]]); line(g, [[210, top], [240, top]]);
    resistor(g, 240, top);
    line(g, [[370, top], [440, top], [440, 170]]);
    // capacitor
    g.lineWidth = 9; line(g, [[400, 170], [480, 170]]); line(g, [[400, 196], [480, 196]]); g.lineWidth = 7;
    line(g, [[440, 196], [440, bot], [left, bot], [left, 220]]);
    // the charge curve, and the 63 % point at about 1 s
    g.save(); g.translate(500, 80);
    g.strokeStyle = 'rgba(28,10,58,0.35)'; g.lineWidth = 3; line(g, [[0, 250], [200, 250]]); line(g, [[0, 250], [0, 0]]);
    g.strokeStyle = INK.pink; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 250);
    for (let t = 0; t <= 200; t += 5) g.lineTo(t, 250 - 220 * (1 - Math.exp(-t / 55)));
    g.stroke();
    g.fillStyle = INK.pink; g.beginPath(); g.arc(55, 250 - 220 * 0.632, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK.ink; g.font = `bold 26px ${FONT_MONO}`; g.fillText('1 s', 38, 262);
    g.restore();
  }
}

function measureLines(g: CanvasRenderingContext2D, text: string, w: number) {
  let line = '', n = 1;
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > w && line) { n++; line = word; } else line = t;
  }
  return n;
}

/** Word-wrap text; returns the y below the last line. */
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > w && line) { g.fillText(line, x, y); y += lh; line = word; } else line = t;
  }
  g.fillText(line, x, y);
  return y + lh;
}

/** Draw the meter's LCD into an existing canvas (it changes with every reading). */
export function drawLcd(g: CanvasRenderingContext2D, text: string, unit: string, active: boolean) {
  const w = g.canvas.width, h = g.canvas.height;
  g.fillStyle = active ? '#b9c7a3' : '#737c68'; g.fillRect(0, 0, w, h);
  if (!active) return;
  const right = w - 120;
  g.fillStyle = 'rgba(40,50,30,0.12)'; g.font = `bold ${h * 0.6}px ${FONT_MONO}`; g.textBaseline = 'middle'; g.textAlign = 'right';
  g.fillText('8.888', right, h * 0.55);
  g.fillStyle = '#1d2418'; g.fillText(text, right, h * 0.55);
  g.textAlign = 'left'; g.font = `bold ${h * 0.26}px ${FONT_MONO}`; g.fillText(unit, right + 10, h * 0.62);
  g.font = `bold ${h * 0.16}px ${FONT_MONO}`; g.fillText(/[VA]$/.test(unit) ? 'DC' : '', 14, h * 0.2);
}
