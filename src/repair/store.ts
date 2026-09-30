/**
 * The repair mat's state: the job and its pure repair state (src/repair/repair.ts), plus what
 * the player has in hand, where the probes are, the meter's dial, hints shown, and the result.
 */
import { create } from 'zustand';
import type { MeterMode } from '../desk/meter';
import { useWallet } from '../jobs/wallet';
import { repairJobById } from './jobs';
import { act, checkRepair, repairReading, repairStars, startRepair, type RepairAction, type RepairJob, type RepairState } from './repair';

/** In hand: the hand (look and point), the meter's probes, the iron, or a spare from the reel. */
export type RepairTool = 'hand' | 'meter' | 'iron' | `spare:${string}`;

export interface RepairResult { stars: 1 | 2 | 3; rules: { text: string; met: boolean }[]; message: string }

interface RepairUI {
  job: RepairJob | null;
  state: RepairState | null;
  tool: RepairTool;
  mode: MeterMode;
  red: string | null;
  /** Clipped to a GND pin to start with, like you would on a real board. */
  black: string | null;
  notice: string | null;
  hints: number;
  /** Board millimetres the camera looks at (a part you clicked with the hand). */
  look: [number, number] | null;
  result: RepairResult | null;
  start: (jobId: string, groundPin: string) => void;
  setTool: (t: RepairTool) => void;
  setMode: (m: MeterMode) => void;
  probe: (spot: string, which: 'red' | 'black') => void;
  apply: (a: RepairAction) => void;
  hint: () => void;
  lookAt: (at: [number, number] | null) => void;
  dismissResult: () => void;
}

export const useRepair = create<RepairUI>((set, get) => {
  /** Note a measurement whenever the meter has something to show (stars need to know). */
  const measure = () => {
    const { job, state, mode, red, black } = get();
    if (!job || !state || !red || !black || mode === 'off') return;
    const r = repairReading(job, state, mode, red, black);
    if (r.text === '- - - -' || r.text === 'Err') return;
    set({ state: act(job, state, { kind: 'measure', mode, red, black }).state });
  };
  return {
    job: null, state: null, tool: 'hand', mode: 'V', red: null, black: null, notice: null, hints: 0, look: null, result: null,
    start: (jobId, groundPin) => {
      const job = repairJobById(jobId);
      if (!job) return;
      set({ job, state: startRepair(job), tool: 'hand', mode: 'V', red: null, black: groundPin, notice: null, hints: 0, look: null, result: null });
    },
    setTool: (tool) => set({ tool, notice: null }),
    setMode: (mode) => { set({ mode }); measure(); },
    probe: (spot, which) => { set(which === 'red' ? { red: spot } : { black: spot }); measure(); },
    apply: (a) => {
      const { job, state } = get();
      if (!job || !state) return;
      const r = act(job, state, a);
      set({ state: r.state, notice: r.notice ?? null });
      // Powering up is the test: if it works, the job's done.
      if (a.kind === 'power' && a.on && r.state.power) {
        const c = checkRepair(job, r.state);
        if (c.pass) { const s = repairStars(job, r.state); set({ result: { ...s, message: c.message } }); useWallet.getState().complete(job.id, s.stars); }
        else if (!r.notice) set({ notice: c.message });
      }
    },
    hint: () => set((s) => ({ hints: Math.min((s.job?.hints.length ?? 0), s.hints + 1) })),
    lookAt: (look) => set({ look }),
    dismissResult: () => set({ result: null }),
  };
});
