import { create } from 'zustand';
import type { LedColor, Waveform } from '../sim';
import type { HoleId } from './layout';
import type { ScopeSetup } from '../instruments/scopeStore';
import type { RideStop } from './rideStops';
import { DEFAULT_WAVE, type BoardPart, type BoardPartKind, type BoardState } from './model';
import { connectedGroup, occupiedHoles, translateParts, type MoveMode } from './move';

export type Tool = 'select' | BoardPartKind | 'probe' | 'scope';
export type ScopeChannel = 'ch1' | 'ch2';
export type View = 'build' | 'flow' | 'ride';

const WIRE_COLORS = ['#e8413c', '#2f6fe0', '#f2c230', '#39c46a', '#e8e8e8', '#ff8a2a'];

interface BenchStore extends BoardState {
  tool: Tool;
  ohms: number;
  ledColor: LedColor;
  batteryVolts: number;
  farads: number;
  wave: Waveform;
  /** Oscilloscope probe tips (the ground clip is always on board ground). */
  scopeProbes: Record<ScopeChannel, HoleId | null>;
  /** Next channel the scope tool places. */
  scopeNext: ScopeChannel;
  scopeOpen: boolean;
  /** Build = normal bench; flow = electrons shown on every path; ride = camera follows one electron. */
  view: View;
  /** Show conventional current (+ to -) instead of electron flow (- to +). */
  conventional: boolean;
  /** Live caption while riding. */
  rideInfo: { title: string; detail: string } | null;
  /** Ride stops at each component and waits for Go (true), or flows continuously (false). */
  rideStep: boolean;
  /** The component the electron is waiting at, in step mode. */
  rideStop: RideStop | null;
  /** Bumped by Go: the ride watches it to continue. */
  rideGo: number;
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
  setBatteryVolts: (v: number) => void;
  setFarads: (f: number) => void;
  setWave: (w: Waveform) => void;
  setScopeProbe: (ch: ScopeChannel, h: HoleId | null) => void;
  setScopeOpen: (open: boolean) => void;
  setView: (v: View) => void;
  toggleConventional: () => void;
  setRideInfo: (i: { title: string; detail: string } | null) => void;
  setRideStep: (on: boolean) => void;
  setRideStop: (s: RideStop | null) => void;
  rideContinue: () => void;
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
  load: (b: BoardState & BenchExtras) => void;
  /** Level rules: parts the player can't touch, and how many spare LEDs they have (null = unlimited). */
  locked: string[];
  /** Parts the player can flip or edit but not move or remove (e.g. the suspect in a find-the-fault level). */
  pinned: string[];
  spares: number | null;
  /** Multimeter measurements made (both probes placed) since the page loaded. */
  measurements: number;
  /** LEDs burnt out since the page loaded (levels diff this to count burns). */
  burnEvents: number;
  /** Bumped whenever a whole board is loaded or cleared (parts then appear without animating in). */
  generation: number;
  setRules: (rules: { locked?: string[]; pinned?: string[]; spares?: number | null }) => void;
  isLocked: (id: string) => boolean;
  clear: () => void;
}

let counters: Record<string, number> = {};
/** Optional bench setup that comes with a preset (e.g. where the scope probes go). */
export interface BenchExtras {
  scope?: Partial<Record<ScopeChannel, HoleId>>;
  /** Scope knob settings that suit the circuit. */
  scopeSetup?: ScopeSetup;
}

const PREFIX: Record<BoardPartKind, string> = { resistor: 'R', led: 'LED', wire: 'W', button: 'SW', battery: 'B', capacitor: 'C', generator: 'FG' };
const nextId = (kind: BoardPartKind, parts: BoardPart[]) => {
  const prefix = PREFIX[kind];
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
  batteryVolts: 6,
  farads: 100e-9,
  wave: { ...DEFAULT_WAVE },
  scopeProbes: { ch1: null, ch2: null },
  scopeNext: 'ch1',
  scopeOpen: true,
  view: 'build',
  conventional: false,
  rideInfo: null,
  rideStep: true,
  rideStop: null,
  rideGo: 0,
  pending: null,
  hover: null,
  selected: null,
  probes: { red: null, black: null },
  showStrips: true,
  moving: null,
  menu: null,
  notice: null,
  locked: [],
  pinned: [],
  spares: null,
  measurements: 0,
  burnEvents: 0,
  generation: 0,

  setTool: (tool) => set({ tool, pending: null, notice: null, moving: null }),
  setOhms: (ohms) => set({ ohms }),
  setLedColor: (ledColor) => set({ ledColor }),
  setBatteryVolts: (batteryVolts) => set({ batteryVolts }),
  setFarads: (farads) => set({ farads }),
  setWave: (wave) => set({ wave }),
  setScopeProbe: (ch, h) => set((s) => ({ scopeProbes: { ...s.scopeProbes, [ch]: h } })),
  setScopeOpen: (scopeOpen) => set({ scopeOpen }),
  setView: (view) => set({ view, rideInfo: null, rideStop: null, pending: null, moving: null, menu: null, tool: 'select' }),
  toggleConventional: () => set((s) => ({ conventional: !s.conventional })),
  setRideInfo: (rideInfo) => set({ rideInfo }),
  setRideStep: (rideStep) => set((s) => ({ rideStep, rideStop: null, rideGo: s.rideGo + 1 })),
  setRideStop: (rideStop) => set({ rideStop }),
  rideContinue: () => set((s) => ({ rideStop: null, rideGo: s.rideGo + 1 })),
  setVolts: (volts) => set((s) => ({ supply: { ...s.supply, volts } })),
  toggleSupply: () => set((s) => ({ supply: { ...s.supply, on: !s.supply.on } })),
  setHover: (hover) => set({ hover }),

  clickHole: (h) => {
    const s = get();
    if (s.view === 'ride') return;
    if (s.moving) {
      const r = translateParts(s.parts, s.moving.ids, s.moving.anchor, h, s.moving.mode);
      if (!r.valid) return set({ notice: r.reason ?? "Can't drop there." });
      return set({ parts: r.parts, moving: null, notice: null });
    }
    if (s.tool === 'select') return set({ selected: null });
    if (s.tool === 'probe') {
      // first click places red, second black, then alternate
      // Red first, then black. After that a click moves the red probe (black stays on your
      // reference, usually ground), and clicking a probe's own hole lifts it off.
      // A measurement is counted each time both probes end up on the board.
      const { red, black } = s.probes;
      if (h === red) return set({ probes: { red: null, black } });
      if (h === black) return set({ probes: { red, black: null } });
      if (!red) return set({ probes: { red: h, black }, measurements: s.measurements + (black ? 1 : 0) });
      if (!black) return set({ probes: { red, black: h }, measurements: s.measurements + 1 });
      return set({ probes: { red: h, black }, measurements: s.measurements + 1 });
    }
    if (s.tool === 'scope') {
      // clip CH1, then CH2, then alternate; clicking a probe's own hole takes it off
      const ch = s.scopeProbes.ch1 === h ? 'ch1' : s.scopeProbes.ch2 === h ? 'ch2' : null;
      if (ch) return set({ scopeProbes: { ...s.scopeProbes, [ch]: null }, scopeNext: ch });
      const next = s.scopeNext;
      return set({ scopeProbes: { ...s.scopeProbes, [next]: h }, scopeNext: next === 'ch1' ? 'ch2' : 'ch1', scopeOpen: true });
    }
    if (occupiedHoles(s.parts).has(h)) return set({ notice: 'That hole already has a leg in it.' });
    if (!s.pending) return set({ pending: h, notice: null });
    if (s.pending === h) return set({ pending: null });
    const kind = s.tool;
    const id = nextId(kind, s.parts);
    const part: BoardPart = { id, kind, h1: s.pending, h2: h };
    if (kind === 'resistor') part.ohms = s.ohms;
    if (kind === 'led') part.color = s.ledColor;
    if (kind === 'battery') part.volts = s.batteryVolts;
    if (kind === 'capacitor') part.farads = s.farads;
    if (kind === 'generator') part.wave = { ...s.wave };
    if (kind === 'wire') part.wireColor = WIRE_COLORS[s.parts.filter((p) => p.kind === 'wire').length % WIRE_COLORS.length];
    set({ parts: [...s.parts, part], pending: null, selected: id });
  },

  select: (selected) => set({ selected }),
  removeSelected: () => set((s) => (s.selected && (s.locked.includes(s.selected) || s.pinned.includes(s.selected))
    ? { notice: 'That part belongs to the level, so it stays put.' }
    : { parts: s.parts.filter((p) => p.id !== s.selected), selected: null })),
  togglePress: (id, pressed) => set((s) => ({ parts: s.parts.map((p) => (p.id === id ? { ...p, pressed } : p)) })),
  markBurnt: (ids) => set((s) => {
    const fresh = s.parts.filter((p) => ids.includes(p.id) && !p.burnt).length;
    const names = s.parts.filter((p) => ids.includes(p.id) && !p.burnt).map((p) => p.id).join(', ');
    return {
      parts: s.parts.map((p) => (ids.includes(p.id) ? { ...p, burnt: true } : p)),
      burnEvents: s.burnEvents + fresh,
      ...(fresh ? { notice: `${names} burnt out: too much current went through it. Fix the circuit, then replace it.` } : {}),
    };
  }),
  replaceLed: (id) => set((s) => {
    if (s.spares === 0) return { notice: 'No spare LEDs left. Restart the level to get a fresh set.' };
    return {
      parts: s.parts.map((p) => (p.id === id ? { ...p, burnt: false } : p)),
      spares: s.spares === null ? null : s.spares - 1,
      notice: s.spares === null ? null : `Fitted a spare LED (${s.spares - 1} left).`,
    };
  }),
  setShowStrips: (showStrips) => set({ showStrips }),
  updatePart: (id, patch) => set((s) => (s.locked.includes(id) ? { notice: 'That part belongs to the level, so it stays put.' } : { parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  flipPart: (id) => set((s) => (s.locked.includes(id) ? { notice: 'That part belongs to the level, so it stays put.' } : { parts: s.parts.map((p) => (p.id === id ? { ...p, h1: p.h2, h2: p.h1 } : p)) })),
  openMenu: (partId, x, y, anchor) => set({ menu: { partId, x, y, anchor }, selected: partId }),
  closeMenu: () => set({ menu: null }),
  startMove: (partId, anchor, mode) => {
    const s = get();
    const ids = mode === 'group' ? connectedGroup(s.parts, partId) : [partId];
    if (ids.some((id) => s.locked.includes(id) || s.pinned.includes(id))) {
      return set({ menu: null, notice: mode === 'group' ? "That group includes the level's own parts, which stay put. Move the part on its own." : 'That part belongs to the level, so it stays put.' });
    }
    set({ moving: { ids, anchor, mode }, menu: null, pending: null, tool: 'select', notice: 'Click a hole to drop. Esc cancels.' });
  },
  cancelMove: () => set({ moving: null, notice: null }),
  setNotice: (notice) => set({ notice }),
  load: ({ scope, scopeSetup: _setup, ...b }) => {
    counters = {};
    set((s) => ({
      generation: s.generation + 1,
      locked: [], pinned: [], spares: null,
      ...b, pending: null, selected: null, moving: null, menu: null, notice: null, probes: { red: null, black: null },
      scopeProbes: { ch1: scope?.ch1 ?? null, ch2: scope?.ch2 ?? null }, scopeNext: 'ch1',
      ...(scope ? { scopeOpen: true } : {}),
    }));
  },
  setRules: ({ locked, pinned, spares }) => set((s) => ({ locked: locked ?? s.locked, pinned: pinned ?? s.pinned, spares: spares === undefined ? s.spares : spares })),
  isLocked: (id) => get().locked.includes(id),
  clear: () => { counters = {}; set((s) => ({ generation: s.generation + 1, locked: [], pinned: [], spares: null, parts: [], pending: null, selected: null, moving: null, menu: null, notice: null, probes: { red: null, black: null }, scopeProbes: { ch1: null, ch2: null }, scopeNext: 'ch1' })); },
}));

export const BENCH_PRESETS: Record<string, BoardState & BenchExtras> = {
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
  'Two sources': {
    supply: { volts: 9, on: true },
    parts: [
      { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'j3', wireColor: '#e8413c' },
      { id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g12', ohms: 470 },
      { id: 'LED1', kind: 'led', h1: 'h12', h2: 'h14', color: 'yellow' },
      { id: 'W2', kind: 'wire', h1: 'j14', h2: 'T-:12', wireColor: '#2f6fe0' },
      { id: 'B1', kind: 'battery', h1: 'i24', h2: 'T-:20', volts: 6 },
      { id: 'R2', kind: 'resistor', h1: 'f24', h2: 'f12', ohms: 680 },
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
  'RC filter': {
    // 1 kHz square wave into a 1 kΩ / 100 nF low-pass: τ = 0.1 ms, so each half period is 5 τ.
    supply: { volts: 9, on: false },
    parts: [
      { id: 'FG1', kind: 'generator', h1: 'j4', h2: 'T-:3', wave: { shape: 'square', freq: 1000, vpp: 5, offset: 2.5 } },
      { id: 'R1', kind: 'resistor', h1: 'g4', h2: 'g10', ohms: 1000 },
      { id: 'C1', kind: 'capacitor', h1: 'h10', h2: 'T-:9', farads: 100e-9 },
    ],
    scope: { ch1: 'i4', ch2: 'i10' },
    scopeSetup: { tdiv: 200e-6, ch1: { vdiv: 2, pos: 0, on: true }, ch2: { vdiv: 2, pos: -3.5, on: true }, trigger: { level: 2.5, source: 'ch1', mode: 'auto' } },
  },
  'RC charge': {
    // Hold the button: 100 µF charges through 10 kΩ (τ = 1 s). Let go: it drains through 22 kΩ.
    supply: { volts: 9, on: true },
    parts: [
      { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'j4', wireColor: '#e8413c' },
      { id: 'SW1', kind: 'button', h1: 'g4', h2: 'g7', pressed: false },
      { id: 'R1', kind: 'resistor', h1: 'h7', h2: 'h13', ohms: 10000 },
      { id: 'C1', kind: 'capacitor', h1: 'i13', h2: 'T-:11', farads: 100e-6 },
      { id: 'R2', kind: 'resistor', h1: 'f13', h2: 'f19', ohms: 22000 },
      { id: 'W2', kind: 'wire', h1: 'j19', h2: 'T-:16', wireColor: '#2f6fe0' },
    ],
    scope: { ch1: 'j13' },
    scopeSetup: { tdiv: 500e-3, ch1: { vdiv: 1, pos: -3, on: true }, ch2: { on: false }, trigger: { level: 1, source: 'ch1', mode: 'auto' } },
  },
};
