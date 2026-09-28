import { create } from 'zustand';
import type { LedColor } from '../sim';
import type { HoleId } from './layout';
import type { BoardPart, BoardPartKind, BoardState } from './model';
import { connectedGroup, occupiedHoles, translateParts, type MoveMode } from './move';

export type Tool = 'select' | BoardPartKind | 'probe';

const WIRE_COLORS = ['#e8413c', '#2f6fe0', '#f2c230', '#39c46a', '#e8e8e8', '#ff8a2a'];

interface BenchStore extends BoardState {
  tool: Tool;
  ohms: number;
  ledColor: LedColor;
  /** First hole clicked while placing a two-legged part. */
  pending: HoleId | null;
  hover: HoleId | null;
  selected: string | null;
  probes: { red: HoleId | null; black: HoleId | null };
  showStrips: boolean;
  /** Parts being dragged to a new spot (they follow the hovered hole). */
  moving: { ids: string[]; anchor: HoleId; mode: MoveMode } | null;
  /** Right-click menu for a part, at screen coordinates. */
  menu: { partId: string; x: number; y: number; anchor: HoleId } | null;
  /** Short message shown in the HUD (e.g. why a move can't be dropped). */
  notice: string | null;

  setTool: (t: Tool) => void;
  setOhms: (o: number) => void;
  setLedColor: (c: LedColor) => void;
  setVolts: (v: number) => void;
  toggleSupply: () => void;
  setHover: (h: HoleId | null) => void;
  clickHole: (h: HoleId) => void;
  select: (id: string | null) => void;
  removeSelected: () => void;
  togglePress: (id: string, pressed: boolean) => void;
  markBurnt: (ids: string[]) => void;
  replaceLed: (id: string) => void;
  setShowStrips: (v: boolean) => void;
  updatePart: (id: string, patch: Partial<BoardPart>) => void;
  flipPart: (id: string) => void;
  openMenu: (partId: string, x: number, y: number, anchor: HoleId) => void;
  closeMenu: () => void;
  startMove: (partId: string, anchor: HoleId, mode: MoveMode) => void;
  cancelMove: () => void;
  setNotice: (n: string | null) => void;
  load: (b: BoardState) => void;
  clear: () => void;
}

let counters: Record<string, number> = {};
const nextId = (kind: BoardPartKind, parts: BoardPart[]) => {
  const prefix = { resistor: 'R', led: 'LED', wire: 'W', button: 'SW' }[kind];
  let n = counters[prefix] ?? 0;
  do { n++; } while (parts.some((p) => p.id === `${prefix}${n}`));
  counters[prefix] = n;
  return `${prefix}${n}`;
};

export const useBench = create<BenchStore>((set, get) => ({
  supply: { volts: 9, on: true },
  parts: [],
  tool: 'select',
  ohms: 330,
  ledColor: 'red',
  pending: null,
  hover: null,
  selected: null,
  probes: { red: null, black: null },
  showStrips: true,
  moving: null,
  menu: null,
  notice: null,

  setTool: (tool) => set({ tool, pending: null, notice: null, moving: null }),
  setOhms: (ohms) => set({ ohms }),
  setLedColor: (ledColor) => set({ ledColor }),
  setVolts: (volts) => set((s) => ({ supply: { ...s.supply, volts } })),
  toggleSupply: () => set((s) => ({ supply: { ...s.supply, on: !s.supply.on } })),
  setHover: (hover) => set({ hover }),

  clickHole: (h) => {
    const s = get();
    if (s.moving) {
      const r = translateParts(s.parts, s.moving.ids, s.moving.anchor, h, s.moving.mode);
      if (!r.valid) return set({ notice: r.reason ?? "Can't drop there." });
      return set({ parts: r.parts, moving: null, notice: null });
    }
    if (s.tool === 'select') return set({ selected: null });
    if (s.tool === 'probe') {
      // first click places red, second black, then alternate
      const { red, black } = s.probes;
      if (!red || (red && black)) return set({ probes: { red: h, black: red && black ? null : black } });
      return set({ probes: { red, black: h } });
    }
    if (occupiedHoles(s.parts).has(h)) return set({ notice: 'That hole already has a leg in it.' });
    if (!s.pending) return set({ pending: h, notice: null });
    if (s.pending === h) return set({ pending: null });
    const kind = s.tool;
    const id = nextId(kind, s.parts);
    const part: BoardPart = { id, kind, h1: s.pending, h2: h };
    if (kind === 'resistor') part.ohms = s.ohms;
    if (kind === 'led') part.color = s.ledColor;
    if (kind === 'wire') part.wireColor = WIRE_COLORS[s.parts.filter((p) => p.kind === 'wire').length % WIRE_COLORS.length];
    set({ parts: [...s.parts, part], pending: null, selected: id });
  },

  select: (selected) => set({ selected }),
  removeSelected: () => set((s) => ({ parts: s.parts.filter((p) => p.id !== s.selected), selected: null })),
  togglePress: (id, pressed) => set((s) => ({ parts: s.parts.map((p) => (p.id === id ? { ...p, pressed } : p)) })),
  markBurnt: (ids) => set((s) => ({ parts: s.parts.map((p) => (ids.includes(p.id) ? { ...p, burnt: true } : p)) })),
  replaceLed: (id) => set((s) => ({ parts: s.parts.map((p) => (p.id === id ? { ...p, burnt: false } : p)) })),
  setShowStrips: (showStrips) => set({ showStrips }),
  updatePart: (id, patch) => set((s) => ({ parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  flipPart: (id) => set((s) => ({ parts: s.parts.map((p) => (p.id === id ? { ...p, h1: p.h2, h2: p.h1 } : p)) })),
  openMenu: (partId, x, y, anchor) => set({ menu: { partId, x, y, anchor }, selected: partId }),
  closeMenu: () => set({ menu: null }),
  startMove: (partId, anchor, mode) => {
    const s = get();
    const ids = mode === 'group' ? connectedGroup(s.parts, partId) : [partId];
    set({ moving: { ids, anchor, mode }, menu: null, pending: null, tool: 'select', notice: 'Click a hole to drop. Esc cancels.' });
  },
  cancelMove: () => set({ moving: null, notice: null }),
  setNotice: (notice) => set({ notice }),
  load: (b) => { counters = {}; set({ ...b, pending: null, selected: null, moving: null, menu: null, notice: null, probes: { red: null, black: null } }); },
  clear: () => { counters = {}; set({ parts: [], pending: null, selected: null, moving: null, menu: null, notice: null, probes: { red: null, black: null } }); },
}));

export const BENCH_PRESETS: Record<string, BoardState> = {
  'LED + resistor': {
    supply: { volts: 9, on: true },
    parts: [
      { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'j3', wireColor: '#e8413c' },
      { id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g8', ohms: 330 },
      { id: 'LED1', kind: 'led', h1: 'h8', h2: 'h10', color: 'red' },
      { id: 'W2', kind: 'wire', h1: 'j10', h2: 'T-:9', wireColor: '#2f6fe0' },
    ],
  },
  'Button + LED': {
    supply: { volts: 5, on: true },
    parts: [
      { id: 'W1', kind: 'wire', h1: 'T+:5', h2: 'j6', wireColor: '#e8413c' },
      { id: 'SW1', kind: 'button', h1: 'e6', h2: 'e8', pressed: false },
      { id: 'W3', kind: 'wire', h1: 'f6', h2: 'd6', wireColor: '#f2c230' },
      { id: 'R1', kind: 'resistor', h1: 'c8', h2: 'c13', ohms: 220 },
      { id: 'LED1', kind: 'led', h1: 'b13', h2: 'b15', color: 'green' },
      { id: 'W2', kind: 'wire', h1: 'a15', h2: 'B-:13', wireColor: '#2f6fe0' },
      { id: 'W4', kind: 'wire', h1: 'T-:24', h2: 'B-:24', wireColor: '#2f6fe0' },
    ],
  },
  'Find the fault': {
    supply: { volts: 9, on: true },
    parts: [
      { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'j3', wireColor: '#e8413c' },
      { id: 'R1', kind: 'resistor', h1: 'g3', h2: 'i3', ohms: 470 },
      { id: 'LED1', kind: 'led', h1: 'h8', h2: 'h10', color: 'yellow' },
      { id: 'W2', kind: 'wire', h1: 'j10', h2: 'T-:9', wireColor: '#2f6fe0' },
    ],
  },
};
