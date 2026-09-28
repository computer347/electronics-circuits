/** Oscilloscope front-panel settings (the knobs). The probes live in the bench store. */
import { create } from 'zustand';
import type { ScopeCh, TriggerEdge, TriggerMode } from './scope';

export interface ChannelSettings {
  on: boolean;
  /** Volts per division. */
  vdiv: number;
  /** Vertical position of 0 V, in divisions from the centre line. */
  pos: number;
}

/** A partial set of knob positions, e.g. what suits a preset circuit. */
export interface ScopeSetup {
  tdiv?: number;
  ch1?: Partial<ChannelSettings>;
  ch2?: Partial<ChannelSettings>;
  trigger?: Partial<ScopeStore['trigger']>;
}

interface ScopeStore {
  tdiv: number;
  ch1: ChannelSettings;
  ch2: ChannelSettings;
  trigger: { source: ScopeCh; level: number; edge: TriggerEdge; mode: TriggerMode };
  running: boolean;
  /** Phosphor afterglow time constant in seconds. */
  afterglow: number;
  fx: boolean;
  setTdiv: (t: number) => void;
  setChannel: (ch: ScopeCh, patch: Partial<ChannelSettings>) => void;
  setTrigger: (patch: Partial<ScopeStore['trigger']>) => void;
  setRunning: (r: boolean) => void;
  setAfterglow: (a: number) => void;
  setFx: (fx: boolean) => void;
  /** Apply settings that suit a preset circuit. */
  apply: (patch: ScopeSetup) => void;
}

export const useScope = create<ScopeStore>((set) => ({
  tdiv: 1e-3,
  ch1: { on: true, vdiv: 2, pos: -2 },
  ch2: { on: true, vdiv: 2, pos: -2 },
  trigger: { source: 'ch1', level: 2.5, edge: 'rise', mode: 'auto' },
  running: true,
  afterglow: 0.35,
  // Full CRT treatment unless the player asked for reduced motion.
  fx: typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches,
  setTdiv: (tdiv) => set({ tdiv }),
  setChannel: (ch, patch) => set((s) => ({ [ch]: { ...s[ch], ...patch } }) as Pick<ScopeStore, ScopeCh>),
  setTrigger: (patch) => set((s) => ({ trigger: { ...s.trigger, ...patch } })),
  setRunning: (running) => set({ running }),
  setAfterglow: (afterglow) => set({ afterglow }),
  setFx: (fx) => set({ fx }),
  apply: (patch) => set((s) => ({
    tdiv: patch.tdiv ?? s.tdiv,
    ch1: { ...s.ch1, ...patch.ch1 },
    ch2: { ...s.ch2, ...patch.ch2 },
    trigger: { ...s.trigger, ...patch.trigger },
  })),
}));
