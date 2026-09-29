/**
 * The desk: which level is on it, what's in focus, how far through the loop the player is,
 * and the submit → power → dive → clear sequence. Levels, checks and stars stay in
 * `useSession`; the board stays in `useBench`.
 */
import { create } from 'zustand';
import { useBench } from '../breadboard/store';
import { useSession, type Attempt } from '../levels/session';
import { canSubmit, FRESH, type DeskObject, type LoopProgress } from './steps';

/** Desk = at the bench; power = switch flipped, LED fading; dive = shrinking into the hole; clear = inside. */
export type DeskPhase = 'desk' | 'power' | 'dive' | 'clear';

interface DeskStore {
  levelId: string | null;
  focus: DeskObject | null;
  phase: DeskPhase;
  flags: Omit<LoopProgress, 'measurements'>;
  /** The checked result once the circuit is cleared. */
  result: Attempt | null;
  enter: (levelId: string) => void;
  focusOn: (o: DeskObject | null) => void;
  closeNotebook: () => void;
  doneBuilding: () => void;
  submit: () => boolean;
  setPhase: (p: DeskPhase) => void;
  /** Called when the last fault inside is fixed and the current has gone round. */
  finishClear: () => Attempt | null;
  /** Back at the desk with the result card closed. */
  returnToDesk: () => void;
  leave: () => void;
}

const { measurements: _m, ...FRESH_FLAGS } = FRESH;

/** Measurements made since the level started. */
export const measurementsNow = () => useBench.getState().measurements - useSession.getState().measurementsAtStart;

export const useDesk = create<DeskStore>((set, get) => ({
  levelId: null,
  focus: null,
  phase: 'desk',
  flags: FRESH_FLAGS,
  result: null,

  enter: (levelId) => {
    useSession.getState().start(levelId);
    useBench.getState().setTool('select');
    set({ levelId, focus: null, phase: 'desk', flags: FRESH_FLAGS, result: null });
  },
  focusOn: (focus) => {
    const bench = useBench.getState();
    // The meter view is where you probe; everywhere else a click selects.
    bench.setTool(focus === 'meter' ? 'probe' : 'select');
    bench.select(null);
    set({ focus });
  },
  closeNotebook: () => { set({ flags: { ...get().flags, readTask: true } }); get().focusOn(null); },
  doneBuilding: () => { set({ flags: { ...get().flags, built: true } }); get().focusOn(null); },
  submit: () => {
    if (!canSubmit({ ...get().flags, measurements: measurementsNow() })) return false;
    const bench = useBench.getState();
    bench.setTool('select');
    set({ flags: { ...get().flags, submitted: true }, phase: 'power' });
    return true;
  },
  setPhase: (phase) => set({ phase }),
  finishClear: () => {
    const attempt = useSession.getState().check();
    useSession.getState().closeResult();
    set({ result: attempt, flags: { ...get().flags, cleared: !!attempt?.check.pass } });
    return attempt;
  },
  returnToDesk: () => { get().focusOn(null); set({ phase: 'desk' }); },
  leave: () => {
    useSession.getState().exit();
    set({ levelId: null, focus: null, phase: 'desk', flags: FRESH_FLAGS, result: null });
  },
}));

/** Loop progress including the live measurement count. */
export function useLoop(): LoopProgress {
  const flags = useDesk((s) => s.flags);
  const m = useBench((s) => s.measurements);
  const at = useSession((s) => s.measurementsAtStart);
  return { ...flags, measurements: m - at };
}
