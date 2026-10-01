/**
 * The procedural PCB: what's printed and etched on a board, worked out from its parts.
 *
 * - Footprints: every placed part kind has its real pad pattern (0603 pads, SOT-23, SOIC-8,
 *   QFP rings, through-hole headers…), sized from datasheet land patterns and lined up with
 *   the 3D models' legs.
 * - Nets: which pads are joined. A board can name them (`BoardDef.nets`); otherwise plausible
 *   ones are made: a ground net and a supply net through the chips and decoupling, then each
 *   passive's free pad tied to its nearest neighbour.
 * - Routing: each net is joined pad to pad (a minimum spanning tree), in right-angled runs.
 *   Some hops dive to the bottom layer through vias. Power nets are drawn wider.
 * - `generateBoard(seed)` makes a whole random board: an MCU with its decoupling, a crystal,
 *   resistors and LEDs, a regulator, headers on the edges and a USB socket.
 *
 * Pure data (no canvas): tests check it; `pcbArt.ts` draws it.
 */
import type { BoardDef, Placed, PlacedKind } from './boards';

/** A pad in board millimetres. Through-hole pads have a drill. */
export interface Pad { id: string; part: string; x: number; z: number; w: number; d: number; round?: boolean; drill?: number }
export interface Trace { net: string; pts: [number, number][]; width: number; layer: 'top' | 'bottom' }
export interface Via { x: number; z: number; net: string }
export interface PcbLayout { pads: Pad[]; traces: Trace[]; vias: Via[]; nets: Record<string, string[]>; gnd: string }

/** Small seeded random numbers (mulberry32): the same seed always draws the same board. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHIP_LEN: Record<string, number> = { '0402': 1.0, '0603': 1.6, '0805': 2.0 };

/** A part's pads in its own frame (x along its length, z across), before rotation. */
export function footprint(p: Placed): { x: number; z: number; w: number; d: number; round?: boolean; drill?: number }[] {
  const q = (p.props ?? {}) as Record<string, number | string | undefined>;
  switch (p.kind as PlacedKind) {
    case 'chipR': case 'chipC': case 'chipLed': {
      const l = CHIP_LEN[(q.size as string) ?? '0603'] ?? 1.6;
      const pw = l * 0.5, pd = l * 0.55;
      return [{ x: -l * 0.5, z: 0, w: pw, d: pd }, { x: l * 0.5, z: 0, w: pw, d: pd }];
    }
    case 'sot23': return [{ x: -0.95, z: 1.33, w: 0.6, d: 0.8 }, { x: 0.95, z: 1.33, w: 0.6, d: 0.8 }, { x: 0, z: -1.33, w: 0.6, d: 0.8 }];
    case 'sot223': return [...[-2.3, 0, 2.3].map((x) => ({ x, z: 3.1, w: 0.9, d: 1.8 })), { x: 0, z: -3.1, w: 3.3, d: 1.8 }];
    case 'soic8': return [-1.905, -0.635, 0.635, 1.905].flatMap((x) => [{ x, z: 2.78, w: 0.6, d: 1.4 }, { x, z: -2.78, w: 0.6, d: 1.4 }]);
    case 'qfp': {
      const n = Number(q.n ?? 32), size = Number(q.size ?? 7), per = n / 4;
      const pitch = (size - 1.2) / (per - 1), r = size / 2 + 0.75;
      const out: { x: number; z: number; w: number; d: number }[] = [];
      for (let i = 0; i < per; i++) {
        const o = -((per - 1) * pitch) / 2 + i * pitch;
        out.push({ x: o, z: r, w: pitch * 0.55, d: 1.3 }, { x: o, z: -r, w: pitch * 0.55, d: 1.3 }, { x: r, z: o, w: 1.3, d: pitch * 0.55 }, { x: -r, z: o, w: 1.3, d: pitch * 0.55 });
      }
      return out;
    }
    case 'crystal': return [{ x: -4.9, z: 0, w: 2.2, d: 3.6 }, { x: 4.9, z: 0, w: 2.2, d: 3.6 }];
    case 'header': case 'headerF': {
      const n = Number(q.n ?? 8);
      return Array.from({ length: n }, (_, i) => ({ x: i * 2.54, z: 0, w: 1.7, d: 1.7, round: true, drill: 1.0 }));
    }
    case 'elec': {
      const k = Number(q.scale ?? 0.8);
      return [{ x: -2.5 * k, z: 0, w: 1.6, d: 1.6, round: true, drill: 0.8 }, { x: 2.5 * k, z: 0, w: 1.6, d: 1.6, drill: 0.8 }];
    }
    case 'button': {
      const w = Number(q.w ?? 6) / 2 + 0.6;
      return [[-w, -1.6], [w, -1.6], [-w, 1.6], [w, 1.6]].map(([x, z]) => ({ x: x!, z: z!, w: 1.2, d: 1.0 }));
    }
    case 'usbB': return [...[-1.25, 1.25].flatMap((z) => [{ x: -4, z, w: 1.6, d: 1.6, round: true, drill: 0.9 }, { x: -6, z, w: 1.6, d: 1.6, round: true, drill: 0.9 }]), { x: 2, z: -6, w: 2.4, d: 2.4, round: true, drill: 2.2 }, { x: 2, z: 6, w: 2.4, d: 2.4, round: true, drill: 2.2 }];
    case 'microUsb': return [...[-1.3, -0.65, 0, 0.65, 1.3].map((x) => ({ x, z: -3.2, w: 0.4, d: 1.3 })), { x: -3.3, z: 0, w: 1.6, d: 2.0 }, { x: 3.3, z: 0, w: 1.6, d: 2.0 }];
    case 'usbA': return [...[-3.5, -1, 1, 3.5].map((z) => ({ x: 4, z, w: 1.0, d: 2.2 })), { x: -2, z: -6.5, w: 2, d: 2.5 }, { x: -2, z: 6.5, w: 2, d: 2.5 }];
    case 'dcJack': return [{ x: -6, z: 0, w: 3.2, d: 1.6, drill: 1.0 }, { x: 0, z: 0, w: 3.2, d: 1.6, drill: 1.0 }, { x: -3, z: 4.7, w: 1.6, d: 3.2, drill: 1.0 }];
    case 'wroom': return Array.from({ length: 13 }, (_, i) => -6 + i * 1.27).flatMap((z) => [{ x: -9, z: z + 3, w: 1.6, d: 0.9 }, { x: 9, z: z + 3, w: 1.6, d: 0.9 }]);
    case 'transducer': return [{ x: -1.27, z: 0, w: 1.6, d: 1.6, round: true, drill: 0.8 }, { x: 1.27, z: 0, w: 1.6, d: 1.6, round: true, drill: 0.8 }];
    case 'dhtBody': return [-2.54, 0, 2.54, 5.08].map((x) => ({ x: x - 1.27, z: 0, w: 1.6, d: 1.6, round: true, drill: 0.8 }));
    case 'display': case 'jumper': return [];
    case 'qfn': {
      const n = Number(q.n ?? 32), size = Number(q.size ?? 5), per = n / 4;
      const pitch = (size - 0.8) / (per - 1), r = size / 2;
      const out: { x: number; z: number; w: number; d: number }[] = [{ x: 0, z: 0, w: size * 0.6, d: size * 0.6 }];
      for (let i = 0; i < per; i++) {
        const o = -((per - 1) * pitch) / 2 + i * pitch;
        out.push({ x: o, z: r, w: pitch * 0.5, d: 0.8 }, { x: o, z: -r, w: pitch * 0.5, d: 0.8 }, { x: r, z: o, w: 0.8, d: pitch * 0.5 }, { x: -r, z: o, w: 0.8, d: pitch * 0.5 });
      }
      return out;
    }
    case 'tsop48': return [-1, 1].flatMap((k) => Array.from({ length: 24 }, (_, i) => ({ x: k * 9.7, z: -5.75 + i * 0.5, w: 1.3, d: 0.28 })));
    case 'dip28': return Array.from({ length: 28 }, (_, i) => (i < 14
      ? { x: 16.51 - i * 2.54, z: -3.81, w: i === 0 ? 1.7 : 1.7, d: 1.7, round: i !== 0, drill: 0.9 }
      : { x: -16.51 + (i - 14) * 2.54, z: 3.81, w: 1.7, d: 1.7, round: true, drill: 0.9 }));
    case 'resonator': return [-1.2, 0, 1.2].map((x) => ({ x, z: 0, w: 0.6, d: 1.9 }));
    case 'elecSmd': return [{ x: -2.3, z: 0, w: 2.4, d: 1.6 }, { x: 2.3, z: 0, w: 2.4, d: 1.6 }];
    case 'xtal3225': return [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]].map(([x, z]) => ({ x: x!, z: z!, w: 1.2, d: 1.0 }));
  }
  return [];
}

const rot = (x: number, z: number, deg: number): [number, number] => {
  const t = (deg * Math.PI) / 180;
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
};

/** Every pad on the board, in board millimetres. Pad ids are "PART.n" (1-based). */
export function boardPads(def: BoardDef): Pad[] {
  const out: Pad[] = [];
  for (const p of def.parts) {
    footprint(p).forEach((f, i) => {
      const [dx, dz] = rot(f.x, f.z, p.rot ?? 0);
      const turned = Math.round(((p.rot ?? 0) % 180) / 90) % 2 !== 0;
      out.push({ id: `${p.id}.${i + 1}`, part: p.id, x: p.at[0] + dx, z: p.at[1] + dz, w: turned ? f.d : f.w, d: turned ? f.w : f.d, round: f.round, drill: f.drill });
    });
  }
  return out;
}

const dist = (a: Pad, b: Pad) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const isPassive = (k: PlacedKind) => k === 'chipR' || k === 'chipC' || k === 'chipLed' || k === 'elec' || k === 'elecSmd';

/**
 * Plausible nets when a board doesn't name its own: ground and supply through every chip and
 * decoupling capacitor, then each passive's other pad, and a few chip pins, to their nearest
 * free neighbour. Deterministic for a board.
 */
export function autoNets(def: BoardDef, pads = boardPads(def)): Record<string, string[]> {
  const r = rng([...def.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 17));
  const byPart = new Map<string, Pad[]>();
  for (const p of pads) byPart.set(p.part, [...(byPart.get(p.part) ?? []), p]);
  const used = new Set<string>();
  const nets: Record<string, string[]> = { GND: [], VCC: [] };
  const take = (net: string, pad: Pad | undefined) => { if (pad && !used.has(pad.id)) { used.add(pad.id); (nets[net] ??= []).push(pad.id); } };
  for (const part of def.parts) {
    const ps = byPart.get(part.id) ?? [];
    if (part.kind === 'chipC' || part.kind === 'elec' || part.kind === 'elecSmd') { take('VCC', ps[0]); take('GND', ps[1]); }
    if (part.kind === 'qfp' || part.kind === 'soic8') {
      // A couple of supply and ground pins on every chip.
      const k = Math.max(1, Math.floor(ps.length / 8));
      for (let i = 0; i < k; i++) { take('GND', ps[(i * 7 + 3) % ps.length]); take('VCC', ps[(i * 7 + 5) % ps.length]); }
    }
    if (part.kind === 'header' || part.kind === 'headerF') { take('GND', ps[1]); }
    if (part.kind === 'sot223') { take('GND', ps[0]); take('VCC', ps[3]); }
  }
  let n = 0;
  const free = () => pads.filter((p) => !used.has(p.id));
  for (const part of def.parts) {
    const ps = (byPart.get(part.id) ?? []).filter((p) => !used.has(p.id));
    // Passives get both ends wired; chips and headers have a handful of their pins used.
    const want = isPassive(part.kind) ? ps : ps.filter(() => r() < 0.35);
    for (const p of want) {
      if (used.has(p.id)) continue;
      const others = free().filter((o) => o.part !== p.part);
      if (!others.length) break;
      const near = others.reduce((m, o) => (dist(p, o) < dist(p, m) ? o : m));
      if (dist(p, near) > 22) continue;
      const name = `N${++n}`;
      take(name, p); take(name, near);
    }
  }
  return Object.fromEntries(Object.entries(nets).filter(([, v]) => v.length >= 2));
}

/** Route every net: pads joined by a minimum spanning tree of right-angled runs. */
export function route(def: BoardDef, nets: Record<string, string[]>, pads = boardPads(def)): PcbLayout {
  const r = rng([...def.id].reduce((h, c) => (h * 131 + c.charCodeAt(0)) >>> 0, 5));
  const byId = new Map(pads.map((p) => [p.id, p]));
  const traces: Trace[] = [];
  const vias: Via[] = [];
  const gnd = 'GND';
  for (const [net, ids] of Object.entries(nets)) {
    const ps = ids.map((id) => byId.get(id)).filter((p): p is Pad => !!p);
    if (ps.length < 2) continue;
    // Ground mostly goes to the pour through vias, not long traces.
    if (net === gnd) {
      for (const p of ps) {
        const vx = p.x + (p.x > 0 ? -1.4 : 1.4), vz = p.z + (r() < 0.5 ? 1.2 : -1.2);
        traces.push({ net, pts: [[p.x, p.z], [vx, vz]], width: 0.4, layer: 'top' });
        vias.push({ x: vx, z: vz, net });
      }
      continue;
    }
    const width = net === 'VCC' || net.startsWith('5V') || net.startsWith('3V') ? 0.6 : 0.25;
    // Prim's minimum spanning tree.
    const inTree = [ps[0]!];
    const rest = ps.slice(1);
    while (rest.length) {
      let bi = 0, bj = 0, bd = Infinity;
      inTree.forEach((a, i) => rest.forEach((b, j) => { const d = dist(a, b); if (d < bd) { bd = d; bi = i; bj = j; } }));
      const a = inTree[bi]!, b = rest.splice(bj, 1)[0]!;
      inTree.push(b);
      const xFirst = r() < 0.5;
      const corner: [number, number] = xFirst ? [b.x, a.z] : [a.x, b.z];
      if (bd > 14 && r() < 0.45) {
        // A longer run hops to the bottom layer: a short stub, a via, then (hidden) the rest.
        const va: [number, number] = [a.x + (corner[0] - a.x) * 0.15, a.z + (corner[1] - a.z) * 0.15];
        const vb: [number, number] = [b.x + (corner[0] - b.x) * 0.15, b.z + (corner[1] - b.z) * 0.15];
        traces.push({ net, pts: [[a.x, a.z], va], width, layer: 'top' }, { net, pts: [vb, [b.x, b.z]], width, layer: 'top' });
        traces.push({ net, pts: [va, corner, vb], width, layer: 'bottom' });
        vias.push({ x: va[0], z: va[1], net }, { x: vb[0], z: vb[1], net });
      } else {
        traces.push({ net, pts: [[a.x, a.z], corner, [b.x, b.z]], width, layer: 'top' });
      }
    }
  }
  return { pads, traces, vias, nets, gnd };
}

/** The whole layout for a board: its own nets if it names them, else plausible ones. */
export function layoutBoard(def: BoardDef): PcbLayout {
  const pads = boardPads(def);
  return route(def, def.nets ?? autoNets(def, pads), pads);
}

// ---------------------------------------------------------------- whole random boards

const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;

/** The footprint's extent in board mm, for keeping parts apart. */
export function partBox(p: Placed): { x0: number; x1: number; z0: number; z1: number } {
  const pads = footprint(p);
  const xs = pads.map((f) => [f.x - f.w / 2, f.x + f.w / 2]).flat(), zs = pads.map((f) => [f.z - f.d / 2, f.z + f.d / 2]).flat();
  const q = (p.props ?? {}) as Record<string, number | undefined>;
  const body = p.kind === 'qfp' ? Number(q.size ?? 7) / 2 : p.kind === 'crystal' ? 5.5 : p.kind === 'tsop48' ? 6 : p.kind === 'elecSmd' ? 3.3 : p.kind === 'dip28' ? 5 : 1;
  const x0 = Math.min(-body, ...xs), x1 = Math.max(body, ...xs), z0 = Math.min(-body, ...zs), z1 = Math.max(body, ...zs);
  const turned = Math.round(((p.rot ?? 0) % 180) / 90) % 2 !== 0;
  const [a0, a1, b0, b1] = turned ? [z0, z1, x0, x1] : [x0, x1, z0, z1];
  return { x0: p.at[0] + a0, x1: p.at[0] + a1, z0: p.at[1] + b0, z1: p.at[1] + b1 };
}

const overlaps = (a: ReturnType<typeof partBox>, b: ReturnType<typeof partBox>, gap = 0.8) =>
  a.x0 - gap < b.x1 && b.x0 - gap < a.x1 && a.z0 - gap < b.z1 && b.z0 - gap < a.z1;

/**
 * A random but believable board: an MCU in the middle with decoupling caps by its corners, a
 * crystal beside it, a 3.3 V regulator and its caps near a USB socket on the left edge, rows of
 * resistors and LEDs, and pin headers along the long edges. Same seed, same board.
 */
export function generateBoard(seed: number): BoardDef {
  const r = rng(seed);
  const w = Math.round(46 + r() * 30), d = Math.round(30 + r() * 20);
  const colors = ['#1f6b34', '#1d4fb3', '#141414', '#00879a', '#7a1f2b', '#3d2a6b'];
  const parts: Placed[] = [];
  let ri = 0, ci = 0, li = 0, ui = 0;
  const tryPlace = (p: Placed) => {
    const b = partBox(p);
    if (b.x0 < -w / 2 + 1 || b.x1 > w / 2 - 1 || b.z0 < -d / 2 + 1 || b.z1 > d / 2 - 1) return false;
    if (parts.some((o) => overlaps(partBox(o), b))) return false;
    parts.push(p);
    return true;
  };
  // Headers along the long edges.
  const hn = Math.floor((w - 12) / 2.54);
  tryPlace({ id: 'J1', kind: 'header', at: [-(hn - 1) * 1.27, -d / 2 + 2.2], name: 'Pin header', props: { n: hn } });
  tryPlace({ id: 'J2', kind: 'header', at: [-(hn - 1) * 1.27, d / 2 - 2.2], name: 'Pin header', props: { n: hn } });
  // USB on the left edge, regulator beside it.
  tryPlace({ id: 'J3', kind: 'microUsb', at: [-w / 2 + 3.5, 0], rot: 90, name: 'Micro-USB socket' });
  tryPlace({ id: `U${++ui}`, kind: 'sot223', at: [-w / 2 + 11, -4], name: '3.3 V regulator', props: { marking: 'AMS1117' } });
  // The MCU, with its crystal and decoupling.
  const qn = pick(r, [32, 48] as const);
  const qs = qn === 32 ? 7 : 7.5;
  const mx = Math.round((r() - 0.3) * 8);
  tryPlace({ id: `U${++ui}`, kind: 'qfp', at: [mx, 0], rot: pick(r, [0, 45] as const), name: 'Microcontroller', props: { n: qn, size: qs, marking: [pick(r, ['STM32', 'ATMEGA', 'RP2040', 'ESP32']), 'MCU'] } });
  tryPlace({ id: 'Y1', kind: 'crystal', at: [mx + 10, -3], rot: 90, name: 'Crystal', props: { mhz: pick(r, ['8.000', '12.000', '16.000']) } });
  for (const [dx, dz] of [[-6, -5], [6, 5], [-6, 5], [6, -5]]) tryPlace({ id: `C${++ci}`, kind: 'chipC', at: [mx + dx!, dz!], rot: 90, name: 'Decoupling capacitor 100 nF', value: { amount: 100e-9, unit: 'F', tol: 0.1 }, props: { size: '0603' } });
  // Resistors and LEDs scattered on a grid where they fit.
  for (let tries = 0; tries < 220 && ri + li < 14; tries++) {
    const x = Math.round((r() - 0.5) * (w - 8)), z = Math.round((r() - 0.5) * (d - 10));
    const led = r() < 0.3;
    const p: Placed = led
      ? { id: `D${++li}`, kind: 'chipLed', at: [x, z], rot: pick(r, [0, 90] as const), name: 'LED', props: { size: '0603', color: pick(r, ['#39d86a', '#ff3b30', '#3a8bff', '#ffb000']) } }
      : { id: `R${++ri}`, kind: 'chipR', at: [x, z], rot: pick(r, [0, 90] as const), name: 'Resistor 0603', value: { amount: pick(r, [100, 330, 1000, 4700, 10000, 22000]), unit: 'Ω', tol: 0.05 }, props: { size: '0603', code: '' } };
    if (!tryPlace(p)) { if (led) li--; else ri--; }
  }
  // Codes printed on the resistors, from their values.
  for (const p of parts) if (p.kind === 'chipR' && p.value) p.props = { ...p.props, code: resistorCode(p.value.amount) };
  const holes: [number, number][] = [[-w / 2 + 3, -d / 2 + 3], [w / 2 - 3, -d / 2 + 3], [-w / 2 + 3, d / 2 - 3], [w / 2 - 3, d / 2 - 3]].filter(([x, z]) => !parts.some((p) => overlaps(partBox(p), { x0: x! - 2, x1: x! + 2, z0: z! - 2, z1: z! + 2 }, 0))) as [number, number][];
  return { id: `gen-${seed}`, name: `Generated board #${seed}`, w, d, color: pick(r, colors), holes, parts };
}

/** The three-digit code printed on an SMD resistor: 4700 Ω → "472". */
export function resistorCode(ohms: number): string {
  if (ohms < 10) return `${ohms}R`.replace('.', 'R');
  const exp = Math.floor(Math.log10(ohms)) - 1;
  return `${Math.round(ohms / 10 ** exp)}${exp}`;
}
