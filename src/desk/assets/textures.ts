/**
 * Canvas textures for the desk: wood, cork, paper, the notebook's task page, the meter's LCD
 * and the riso poster. Everything is drawn in code (no image files).
 */
import * as THREE from 'three';

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
export const levelCardTexture = (n: number, title: string, state: 'done' | 'here' | 'later') => once(`card${n}${state}`, () => canvas(256, 200, (g) => {
  paperGrain(g, 256, 200, 20 + n, state === 'here' ? '#fff7c2' : INK.paper);
  g.globalCompositeOperation = 'multiply';
  g.font = `72px ${FONT_DISPLAY}`; g.textBaseline = 'top';
  g.fillStyle = state === 'later' ? '#b9b0a2' : INK.blue; g.fillText(`0–${n}`, 18, 14);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = INK.ink; g.font = `bold 20px ${FONT_MONO}`;
  g.fillText(title, 18, 110);
  if (state === 'done') { g.fillStyle = INK.pink; g.font = `36px ${FONT_DISPLAY}`; g.fillText('✓', 206, 20); }
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

/** A ruled notebook page. */
function ruled(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  paperGrain(g, w, h, seed, '#f6f1e4');
  g.strokeStyle = 'rgba(0,120,191,0.18)'; g.lineWidth = 2;
  for (let y = 90; y < h; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(255,72,176,0.35)'; g.beginPath(); g.moveTo(70, 0); g.lineTo(70, h); g.stroke();
}

/**
 * The task, drawn: the circuit with the LED lit (the target), one sentence, and the step
 * pictures on the right page. Pictures first, a few words second.
 */
export const taskPagesTexture = (goal: string, level: string) => once(`task${level}`, () => canvas(1400, 960, (g) => {
  ruled(g, 1400, 960, 13);
  // spine shadow
  const sp = g.createLinearGradient(660, 0, 740, 0);
  sp.addColorStop(0, 'rgba(0,0,0,0)'); sp.addColorStop(0.5, 'rgba(60,40,20,0.25)'); sp.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sp; g.fillRect(660, 0, 80, 960);

  g.textBaseline = 'top';
  g.fillStyle = INK.blue; g.font = `64px ${FONT_DISPLAY}`; g.fillText(level, 100, 36);

  // Target picture: supply → resistor → LED (lit) → back, drawn in ink with the glow in pink.
  g.save(); g.translate(120, 180);
  g.strokeStyle = INK.ink; g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round';
  // loop
  g.beginPath(); g.moveTo(40, 70); g.lineTo(40, 20); g.lineTo(200, 20); g.stroke();
  // resistor zigzag
  g.beginPath(); g.moveTo(200, 20);
  for (let i = 0; i < 6; i++) g.lineTo(215 + i * 18, i % 2 ? 0 : 40);
  g.lineTo(330, 20); g.lineTo(460, 20); g.lineTo(460, 120); g.stroke();
  // LED triangle pointing down
  g.fillStyle = INK.pink; g.beginPath(); g.moveTo(420, 120); g.lineTo(500, 120); g.lineTo(460, 190); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(420, 190); g.lineTo(500, 190); g.stroke();
  g.beginPath(); g.moveTo(460, 190); g.lineTo(460, 330); g.lineTo(40, 330); g.lineTo(40, 170); g.stroke();
  // battery
  g.beginPath(); g.moveTo(0, 70); g.lineTo(80, 70); g.stroke();
  g.lineWidth = 12; g.beginPath(); g.moveTo(15, 110); g.lineTo(65, 110); g.stroke(); g.lineWidth = 7;
  g.beginPath(); g.moveTo(40, 110); g.lineTo(40, 170); g.stroke();
  g.fillStyle = INK.ink; g.font = `bold 34px ${FONT_MONO}`; g.fillText('+', 90, 40);
  // glow rays
  g.strokeStyle = INK.pink; g.lineWidth = 6;
  for (const [dx, dy] of [[70, -20], [85, 20], [70, 60]] as const) { g.beginPath(); g.moveTo(515, 150); g.lineTo(515 + dx, 150 + dy); g.stroke(); }
  g.restore();

  // One sentence.
  g.fillStyle = INK.ink; g.font = `bold 40px ${FONT_MONO}`;
  wrap(g, goal, 100, 600, 540, 50);

  // Right page: the four steps as pictures, the next one ringed.
  g.fillStyle = INK.blue; g.font = `52px ${FONT_DISPLAY}`; g.fillText('HOW', 800, 44);
  const steps: [string, string][] = [['read', 'this page'], ['look', 'at the board'], ['measure', 'with the meter'], ['go in', 'and clear it']];
  steps.forEach(([a, b], i) => {
    const y = 160 + i * 180;
    g.fillStyle = i === 0 ? INK.pink : INK.blue;
    g.globalAlpha = 0.9; g.beginPath(); g.arc(850, y + 40, 44, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.fillStyle = INK.paper; g.font = `48px ${FONT_DISPLAY}`; g.fillText(String(i + 1), 836, y + 12);
    g.fillStyle = INK.ink; g.font = `bold 40px ${FONT_MONO}`; g.fillText(a, 920, y + 4);
    g.font = `30px ${FONT_MONO}`; g.fillText(b, 920, y + 52);
  });
}));

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > w && line) { g.fillText(line, x, y); y += lh; line = word; } else line = t;
  }
  g.fillText(line, x, y);
}

/** Draw the meter's LCD into an existing canvas (it changes with every reading). */
export function drawLcd(g: CanvasRenderingContext2D, text: string, unit: string, active: boolean) {
  const w = g.canvas.width, h = g.canvas.height;
  g.fillStyle = active ? '#b9c7a3' : '#8f9a80'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(40,50,30,0.12)'; g.font = `bold ${h * 0.62}px ${FONT_MONO}`; g.textBaseline = 'middle'; g.textAlign = 'right';
  g.fillText('8.888', w - 90, h * 0.55);
  g.fillStyle = '#1d2418'; g.fillText(text, w - 90, h * 0.55);
  g.font = `bold ${h * 0.26}px ${FONT_MONO}`; g.fillText(unit, w - 14, h * 0.62);
  g.textAlign = 'left'; g.font = `bold ${h * 0.16}px ${FONT_MONO}`; g.fillText('DC', 14, h * 0.2);
}
