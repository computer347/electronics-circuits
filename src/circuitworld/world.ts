/**
 * The circuit as a place you can walk around, where **height is voltage** (1 V = 1 m).
 *
 * Every net the current passes through is a round **plaza** standing at its voltage. The parts
 * between nets are **links**: the supply is a stair that climbs from the floor (0 V) to the
 * supply voltage; a resistor is a ramp down by its drop; an LED is a door with a ledge behind
 * it; a push button is a drawbridge; a capacitor is a reservoir you can't cross; a loop that
 * never closes ends in a chasm. Parts off the main loop are side paths between the right two
 * plazas. The landscape is the solver's DC solution of the board as built, so it tells the
 * truth before the power is on: a backwards LED stands the whole supply in front of its door.
 *
 * Pure data, no three.js: the renderer draws it and the walker walks on it.
 */
import * as THREE from 'three';
import type { BoardAnalysis, BoardState } from '../breadboard/model';
import { buildMap, type CircuitMap, type Room } from './map';

/** Metres per volt. */
export const V_SCALE = 1;
export const PLAZA_R = 4.5;
const LINK_MIN = 10;
/** Extra link length per volt of rise or fall, so slopes stay walkable (about 1 : 1.3). */
const LINK_PER_VOLT = 1.3;
const DOOR_LEN = 9;
const GAP_LEN = 9;

export type LinkKind = 'stair' | 'ramp' | 'door' | 'bridge' | 'reservoir' | 'chasm';

export interface Plaza {
  index: number;
  /** The net this plaza is, or null for the floor under an open loop. */
  net: string | null;
  volts: number | undefined;
  height: number;
  center: [number, number];
  ground: boolean;
}

export interface Link {
  /** The part's id ('SUPPLY' for the supply, 'GAP' for a chasm). */
  id: string;
  kind: LinkKind;
  room?: Room;
  from: number;
  to: number;
  /** Centre line from the edge of one plaza to the edge of the other, x/z. */
  path: [number, number][];
  width: number;
  /** Floor height at the start and the end. */
  h0: number;
  h1: number;
  /** 'slope' rises or falls evenly; 'ledge' stays at h0 to the middle, then drops to h1. */
  profile: 'slope' | 'ledge';
  /** False when you can't get across: a closed door, a raised bridge, a reservoir, a chasm. */
  passable: boolean;
  /** Where along the path (0–1) the barrier or ledge is. */
  at: number;
  /** Not on the main loop: a side path. */
  side: boolean;
}

export interface World {
  plazas: Plaza[];
  links: Link[];
  /** Where you start: at the top of the supply's stair, looking down the loop. */
  spawn: { pos: [number, number, number]; yaw: number };
  map: CircuitMap;
  closed: boolean;
}

const h = (v: number | undefined) => Math.max(0, (v ?? 0) * V_SCALE);

/** Passage width for a resistor: narrower for more ohms, on a log scale (3 m at 100 Ω, 0.8 m at 100 kΩ). */
export function resistorWidth(ohms: number): number {
  const w = 3.2 - 0.8 * Math.log10(Math.max(1, ohms) / 100);
  return Math.max(0.8, Math.min(3.2, w));
}

function linkKind(room: Room): LinkKind {
  switch (room.kind) {
    case 'source': case 'battery': case 'generator': return 'stair';
    case 'led': case 'diode': case 'transistor': return 'door';
    case 'button': return 'bridge';
    case 'capacitor': return 'reservoir';
    default: return 'ramp';
  }
}

function linkWidth(kind: LinkKind, room?: Room): number {
  if (kind === 'ramp') return resistorWidth(room?.part?.ohms ?? 1000);
  if (kind === 'stair') return 3.2;
  return 3;
}

/**
 * Link lengths depend only on the circuit's shape and the supply, never on the present
 * voltages, so a fix inside (turning a door round) moves the heights but not the plazas.
 * Every ramp is long enough for the steepest drop it could ever have (the whole supply).
 */
function linkLength(kind: LinkKind, supplyVolts: number): number {
  if (kind === 'door') return DOOR_LEN;
  if (kind === 'chasm') return GAP_LEN;
  return LINK_MIN + supplyVolts * LINK_PER_VOLT;
}

export function buildWorld(board: BoardState, analysis: BoardAnalysis): World {
  const map = buildMap(board, analysis);
  const n = map.loop.length;

  // Plazas round the loop: the net after each part (the last is ground when the loop closes).
  const ringNets = map.corridors.slice(0, n);
  const plazas: Plaza[] = ringNets.map((c, i) => ({
    index: i, net: c.net, volts: c.v, height: h(c.v), center: [0, 0], ground: c.net === map.ground,
  }));
  // An open loop still needs a floor for the supply's stair to start from.
  let groundIdx = plazas.findIndex((p) => p.ground);
  if (!map.closed || groundIdx < 0) {
    plazas.push({ index: plazas.length, net: map.ground, volts: 0, height: 0, center: [0, 0], ground: true });
    groundIdx = plazas.length - 1;
  }

  // Ring edges in order: the supply's stair from the floor up to plaza 0, then each part down
  // to the next plaza, and a chasm where the loop never closes.
  type Edge = { room?: Room; kind: LinkKind; from: number; to: number };
  const edges: Edge[] = [{ room: map.loop[0], kind: 'stair', from: groundIdx, to: 0 }];
  for (let i = 1; i < n; i++) edges.push({ room: map.loop[i], kind: linkKind(map.loop[i]!), from: i - 1, to: i });
  if (!map.closed) edges.push({ kind: 'chasm', from: n - 1, to: groundIdx });

  // Lay the ring out on a circle: each plaza takes its diameter, each link its length.
  const lens = edges.map((e) => linkLength(e.kind, board.supply.volts));
  // Order of plazas round the ring: the stair's top (0), then down the loop, then the floor.
  const order: number[] = [];
  for (const e of edges.slice(1)) { if (!order.includes(e.from)) order.push(e.from); if (!order.includes(e.to)) order.push(e.to); }
  if (!order.length) order.push(0);
  if (!order.includes(groundIdx)) order.push(groundIdx);
  // Arc length before each plaza: plazas and the links between consecutive ones.
  const edgeBetween = (a: number, b: number) => edges.findIndex((e) => e.from === a && e.to === b);
  let arc = 0;
  const arcAt: number[] = [];
  order.forEach((p, k) => {
    arcAt[p] = arc + PLAZA_R;
    arc += PLAZA_R * 2;
    const next = order[(k + 1) % order.length]!;
    const ei = edgeBetween(p, next) >= 0 ? edgeBetween(p, next) : 0;
    arc += lens[ei] ?? LINK_MIN;
  });
  const radius = Math.max(arc / (2 * Math.PI), 8);
  for (const p of order) {
    const a = (arcAt[p]! / arc) * Math.PI * 2;
    plazas[p]!.center = [Math.cos(a) * radius, Math.sin(a) * radius];
  }

  const straight = (a: Plaza, b: Plaza): [number, number][] => {
    const dx = b.center[0] - a.center[0], dz = b.center[1] - a.center[1];
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    // Start a little inside each plaza so the floor is continuous.
    const e = PLAZA_R - 0.4;
    return [[a.center[0] + ux * e, a.center[1] + uz * e], [b.center[0] - ux * e, b.center[1] - uz * e]];
  };

  const links: Link[] = edges.map((e) => {
    const a = plazas[e.from]!, b = plazas[e.to]!;
    const room = e.room;
    const kind = e.kind;
    let passable = true;
    // A door opens only when current actually flows through it: backwards, or without
    // enough voltage to reach its forward drop, it stays shut.
    if (kind === 'door') passable = !room?.fault && room?.forward !== false && !!room?.lit;
    if (kind === 'bridge') passable = !!room?.part?.pressed;
    if (kind === 'reservoir' || kind === 'chasm') passable = false;
    return {
      id: kind === 'chasm' ? 'GAP' : room!.id, kind, room, from: e.from, to: e.to,
      path: straight(a, b), width: linkWidth(kind, room), h0: a.height, h1: b.height,
      profile: kind === 'door' ? 'ledge' : 'slope', passable, at: 0.5, side: false,
    };
  });

  // Side paths: parts not on the loop, between the plazas of the nets they join, bowed inward.
  // A net that only side parts reach (the far tap of a bridge) gets its own plaza inside the
  // ring, near the plazas it connects to, standing at its own voltage.
  const plazaOfNet = (net: string) => plazas.findIndex((p) => p.net === net);
  for (let pass = 0; pass < 3; pass++) {
    for (const room of map.side) {
      room.nets.forEach((nt, k) => {
        if (plazaOfNet(nt) >= 0) return;
        const others = map.side.filter((x) => x.nets.includes(nt)).flatMap((x) => x.nets).filter((x) => x !== nt).map(plazaOfNet).filter((i) => i >= 0);
        if (!others.length) return;
        const cx = others.reduce((s, i) => s + plazas[i]!.center[0], 0) / others.length;
        const cz = others.reduce((s, i) => s + plazas[i]!.center[1], 0) / others.length;
        const volts = k === 0 ? room.vIn : room.vOut;
        plazas.push({ index: plazas.length, net: nt, volts, height: h(volts), center: [cx * 0.3, cz * 0.3], ground: false });
      });
    }
  }
  for (const room of map.side) {
    const ia = plazaOfNet(room.nets[0]), ib = plazaOfNet(room.nets[1]);
    if (ia < 0 || ib < 0 || ia === ib) continue;
    const a = plazas[ia]!, b = plazas[ib]!;
    const mid: [number, number] = [(a.center[0] + b.center[0]) * 0.35, (a.center[1] + b.center[1]) * 0.35];
    const pts: [number, number][] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, u = 1 - t;
      pts.push([u * u * a.center[0] + 2 * u * t * mid[0] + t * t * b.center[0], u * u * a.center[1] + 2 * u * t * mid[1] + t * t * b.center[1]]);
    }
    // Trim to the plazas' edges.
    const trimmed = pts.filter((p) => Math.hypot(p[0] - a.center[0], p[1] - a.center[1]) > PLAZA_R - 0.6 && Math.hypot(p[0] - b.center[0], p[1] - b.center[1]) > PLAZA_R - 0.6);
    const kind = linkKind(room);
    links.push({
      id: room.id, kind, room, from: ia, to: ib, path: trimmed.length >= 2 ? trimmed : [pts[1]!, pts[7]!],
      width: linkWidth(kind, room), h0: a.height, h1: b.height, profile: kind === 'door' ? 'ledge' : 'slope',
      passable: kind === 'ramp' || kind === 'stair' || (kind === 'door' && !room.fault && !!room.lit) || (kind === 'bridge' && !!room.part?.pressed),
      at: 0.5, side: true,
    });
  }

  // Spawn at the top of the stair, on plaza 0, facing the next part down the loop.
  const top = plazas[0]!;
  const next = links[1] ?? links[0]!;
  const [sx, sz] = next.path[0]!;
  const yaw = Math.atan2(-(sz - top.center[1]), sx - top.center[0]);
  const back = 2.2;
  const dir = [Math.cos(yaw), -Math.sin(yaw)];
  return {
    plazas, links, map, closed: map.closed,
    spawn: { pos: [top.center[0] - dir[0]! * back, top.height, top.center[1] - dir[1]! * back], yaw },
  };
}

// ---------------------------------------------------------------- the floor

/** Distance along a polyline and sideways from it, for a point (x, z). */
export function onPath(path: [number, number][], x: number, z: number): { t: number; side: number; along: number; length: number } {
  let best = { t: 0, side: Infinity, along: 0 };
  let total = 0;
  const segs = path.slice(1).map((p, i) => { const a = path[i]!; const len = Math.hypot(p[0] - a[0], p[1] - a[1]); total += len; return { a, b: p, len }; });
  let acc = 0;
  for (const s of segs) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1];
    const u = s.len ? Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (s.len * s.len))) : 0;
    const px = s.a[0] + dx * u, pz = s.a[1] + dz * u;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.side) best = { t: 0, side: d, along: acc + u * s.len };
    acc += s.len;
  }
  return { t: total ? best.along / total : 0, side: best.side, along: best.along, length: total };
}

/** Floor height of a link at fraction t along it, or undefined where there's no floor (a gap). */
export function linkFloor(l: Link, t: number): number | undefined {
  if (!l.passable) {
    // A barrier or chasm: floor either side, nothing across the middle.
    const gap = l.kind === 'chasm' ? 0.28 : l.kind === 'reservoir' ? 0.18 : 0.04;
    if (Math.abs(t - l.at) < gap) return undefined;
  }
  if (l.profile === 'ledge') return t < l.at ? l.h0 : l.h1;
  return l.h0 + (l.h1 - l.h0) * t;
}

/** Every floor under the point (x, z), highest first. */
export function floorsAt(w: World, x: number, z: number): number[] {
  const out: number[] = [];
  for (const p of w.plazas) if (Math.hypot(x - p.center[0], z - p.center[1]) <= PLAZA_R) out.push(p.height);
  for (const l of w.links) {
    const o = onPath(l.path, x, z);
    // Only the part of the strip alongside the path (not beyond its ends).
    if (o.side > l.width / 2 || o.along < -0.01 || o.along > o.length + 0.01) continue;
    const f = linkFloor(l, o.t);
    if (f !== undefined) out.push(f);
  }
  return out.sort((a, b) => b - a);
}

/** A 3D point along a link at fraction t (on its floor, or at h0 where there's a gap). */
export function linkPoint(l: Link, t: number): THREE.Vector3 {
  let acc = 0;
  const segs = l.path.slice(1).map((p, i) => { const a = l.path[i]!; const len = Math.hypot(p[0] - a[0], p[1] - a[1]); const s = { a, b: p, len, from: acc }; acc += len; return s; });
  const target = t * acc;
  const seg = segs.find((s) => target <= s.from + s.len) ?? segs[segs.length - 1]!;
  const u = seg.len ? (target - seg.from) / seg.len : 0;
  const y = linkFloor(l, t) ?? l.h0;
  return new THREE.Vector3(seg.a[0] + (seg.b[0] - seg.a[0]) * u, y, seg.a[1] + (seg.b[1] - seg.a[1]) * u);
}

/** Heading of a link at fraction t, as a rotation about y (local +x along the path). */
export function linkYaw(l: Link, t: number): number {
  const a = linkPoint(l, Math.max(0, t - 0.02)), b = linkPoint(l, Math.min(1, t + 0.02));
  return Math.atan2(-(b.z - a.z), b.x - a.x);
}
