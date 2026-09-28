/**
 * The flow graph: every path current takes on the board, with its signed current and
 * each source's share. Parts and the supply are edges between their leg holes; the
 * strips inside the board are split into segments between the holes that have legs in
 * them, with the current in each segment found by adding up what flows in along the strip.
 */

import { DIODE_KEY } from '../sim';
import { HOLES, hole, type HoleId } from './layout';
import { SUPPLY_ID, type BoardAnalysis, type BoardPartKind, type BoardState } from './model';
import { partPoints, polylineLength, SUPPLY_HOLES, supplyPoints, type V3 } from './paths';

export interface FlowEdge {
  id: string;
  kind: 'part' | 'strip' | 'supply';
  label: string;
  partId?: string;
  /** For part edges: what kind of part (the ride stops at components, not wires). */
  partKind?: BoardPartKind;
  from: HoleId;
  to: HoleId;
  points: V3[];
  length: number;
  /** Conventional current from `from` to `to` (A). Electrons move the other way. */
  amps: number;
  /** Each source's share of `amps` (same sign convention). */
  shares: Record<string, number>;
}

/** Below this the solver's leakage (GMIN) dominates: treat as no current. */
export const MIN_AMPS = 1e-7;

export const SOURCE_PALETTE = ['#39ff88', '#3ad7ff', '#ffb000', '#ff5cf0', '#f5f5ff'];

/** Colour for each source key: the bench supply first, then batteries in board order. */
export function sourceColors(board: BoardState): Record<string, string> {
  const out: Record<string, string> = { [SUPPLY_ID]: SOURCE_PALETTE[0]! };
  let i = 1;
  for (const p of board.parts) if (p.kind === 'battery' || p.kind === 'generator') out[p.id] = SOURCE_PALETTE[i++ % SOURCE_PALETTE.length]!;
  out[DIODE_KEY] = '#ff2e88';
  return out;
}

const PART_LABEL: Record<string, string> = { resistor: 'resistor', led: 'LED', wire: 'jumper wire', button: 'push button', battery: 'battery', capacitor: 'capacitor', generator: 'function generator' };

export function buildFlow(board: BoardState, analysis: BoardAnalysis): FlowEdge[] {
  const r = analysis.result;
  if (!r.ok) return [];
  const contrib = analysis.contributions;
  const keys = contrib?.keys ?? [];
  const sharesOf = (id: string): Record<string, number> => {
    const c = contrib?.currents[id];
    if (!c) return { [id]: r.currents[id] ?? 0 };
    return Object.fromEntries(keys.map((k) => [k, c[k] ?? 0]));
  };

  const edges: FlowEdge[] = [];
  // current (per key) injected INTO each hole's strip by the things plugged into it
  const inject = new Map<HoleId, Record<string, number>>();
  const addInj = (h: HoleId, shares: Record<string, number>, sign: number) => {
    const m = inject.get(h) ?? {};
    for (const [k, v] of Object.entries(shares)) m[k] = (m[k] ?? 0) + sign * v;
    inject.set(h, m);
  };

  const pushEdge = (e: Omit<FlowEdge, 'length'>) => {
    edges.push({ ...e, length: polylineLength(e.points) });
    // current a->b through the edge leaves the strip at `from` and enters it at `to`
    addInj(e.from, e.shares, -1);
    addInj(e.to, e.shares, +1);
  };

  if (board.supply.on && r.currents[SUPPLY_ID] !== undefined) {
    pushEdge({
      id: SUPPLY_ID, kind: 'supply', label: `Bench supply · ${board.supply.volts} V`,
      from: SUPPLY_HOLES.plus, to: SUPPLY_HOLES.minus, points: supplyPoints(),
      amps: r.currents[SUPPLY_ID]!, shares: sharesOf(SUPPLY_ID),
    });
  }
  for (const p of board.parts) {
    const amps = r.currents[p.id];
    if (amps === undefined) continue; // burnt LED: open circuit
    pushEdge({
      id: p.id, kind: 'part', partId: p.id, partKind: p.kind, label: `${p.id} · ${PART_LABEL[p.kind]}`,
      from: p.h1, to: p.h2, points: partPoints(p), amps, shares: sharesOf(p.id),
    });
  }

  // strip segments between holes that have something plugged in
  const byStrip = new Map<string, HoleId[]>();
  for (const h of inject.keys()) {
    const s = hole(h).strip;
    byStrip.set(s, [...(byStrip.get(s) ?? []), h]);
  }
  for (const [strip, holes] of byStrip) {
    if (holes.length < 2) continue;
    const rail = strip.length === 2 && (strip.endsWith('+') || strip.endsWith('-'));
    const ordered = HOLES.filter((h) => h.strip === strip && holes.includes(h.id))
      .sort((a, b) => (rail ? a.x - b.x : a.z - b.z));
    const running: Record<string, number> = {};
    for (let i = 0; i < ordered.length - 1; i++) {
      const A = ordered[i]!, B = ordered[i + 1]!;
      for (const [k, v] of Object.entries(inject.get(A.id) ?? {})) running[k] = (running[k] ?? 0) + v;
      const shares = { ...running };
      const amps = Object.values(shares).reduce((s, v) => s + v, 0);
      edges.push({
        id: `${strip}:${A.id}-${B.id}`, kind: 'strip',
        label: rail ? `${strip} rail` : `strip ${strip.startsWith('L') ? 'a–e' : 'f–j'} · column ${strip.slice(1)}`,
        from: A.id, to: B.id,
        points: [[A.x, 0.03, A.z], [B.x, 0.03, B.z]],
        length: Math.hypot(B.x - A.x, B.z - A.z), amps, shares,
      });
    }
  }
  return edges;
}

/** Direction electrons travel along an edge: +1 means from -> to. */
export const electronDir = (e: FlowEdge, conventional = false) => (conventional ? 1 : -1) * Math.sign(e.amps);
