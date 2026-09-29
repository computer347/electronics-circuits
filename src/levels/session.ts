/**
 * The level being played: when it started, hints shown, checks made, and the last result.
 * Starting a level stashes the sandbox bench and loads the level's board; leaving restores it.
 */
import { create } from 'zustand';
import { analyzeBoard, type BoardState } from '../breadboard/model';
import { useBench } from '../breadboard/store';
import { useScope } from '../instruments/scopeStore';
import { checkLevel, partsAdded, stars, type CheckResult, type RunStats } from './check';
import { levelById, startingBoard } from '.';
import { useProgress } from './progress';
import type { LevelDef } from './types';

export interface Attempt {
  check: CheckResult;
  /** Set on a pass. */
  stars?: 1 | 2 | 3;
  stats: RunStats;
  /** A better result than anything saved before. */
  improved?: boolean;
}

interface Session {
  levelId: string | null;
  startedAt: number;
  /** Seconds taken, frozen when the level is passed. */
  finishedIn: number | null;
  hintsShown: number;
  checks: number;
  burnsAtStart: number;
  measurementsAtStart: number;
  last: Attempt | null;
  /** Result card open over the bench. */
  showResult: boolean;
  /** The Level Complete screen is showing (after a pass). */
  complete: boolean;
  stash: BoardState | null;
  start: (id: string) => void;
  restart: () => void;
  exit: () => void;
  showHint: () => void;
  check: () => Attempt | null;
  closeResult: () => void;
  /** Show the Level Complete screen (only after a pass). */
  finish: () => void;
  /** Hide it and keep tinkering with the passed circuit. */
  closeComplete: () => void;
}

export const useSession = create<Session>((set, get) => ({
  levelId: null,
  startedAt: 0,
  finishedIn: null,
  hintsShown: 0,
  checks: 0,
  burnsAtStart: 0,
  measurementsAtStart: 0,
  last: null,
  showResult: false,
  complete: false,
  stash: null,

  start: (id) => {
    const level = levelById(id);
    if (!level) return;
    const bench = useBench.getState();
    const stash = get().levelId ? get().stash : { supply: bench.supply, parts: bench.parts };
    bench.load({ ...structuredClone(startingBoard(level)), scope: { ch1: level.scope?.ch1, ch2: level.scope?.ch2 } });
    bench.setRules({ locked: level.locked ?? [], pinned: level.pinned ?? [], spares: level.spares?.led ?? null });
    if (level.scope?.setup) useScope.getState().apply(level.scope.setup);
    if (level.resistorValues && !level.resistorValues.includes(bench.ohms)) bench.setOhms(level.resistorValues[0]!);
    useScope.getState().setRunning(true);
    set({
      levelId: id, startedAt: Date.now(), finishedIn: null, hintsShown: 0, checks: 0,
      burnsAtStart: useBench.getState().burnEvents, measurementsAtStart: useBench.getState().measurements,
      last: null, showResult: false, complete: false, stash,
    });
  },

  restart: () => { const id = get().levelId; if (id) get().start(id); },

  exit: () => {
    const { stash, levelId } = get();
    if (!levelId) return;
    const bench = useBench.getState();
    bench.load(stash ?? { supply: { volts: 9, on: true }, parts: [] });
    set({ levelId: null, stash: null, last: null, showResult: false, complete: false });
  },

  showHint: () => {
    const l = get().levelId ? levelById(get().levelId!) : undefined;
    if (l && get().hintsShown < l.hints.length) set({ hintsShown: get().hintsShown + 1 });
  },

  check: () => {
    const { levelId } = get();
    const level = levelId ? levelById(levelId) : undefined;
    if (!level) return null;
    const bench = useBench.getState();
    const board = { supply: bench.supply, parts: bench.parts };
    const result = checkLevel(level, board, analyzeBoard(board));
    const checks = get().checks + 1;
    const seconds = get().finishedIn ?? Math.round((Date.now() - get().startedAt) / 1000);
    const stats: RunStats = {
      hintsUsed: get().hintsShown,
      measurements: bench.measurements - get().measurementsAtStart,
      burnt: bench.burnEvents - get().burnsAtStart,
      checks,
      partsAdded: partsAdded(level, board),
      seconds,
    };
    const attempt: Attempt = { check: result, stats };
    if (result.pass) {
      attempt.stars = stars(level, stats);
      attempt.improved = useProgress.getState().record(level.id, attempt.stars, seconds).improved;
    } else if (result.diagnosis?.part) {
      bench.select(result.diagnosis.part);
    }
    set({ checks, last: attempt, showResult: true, finishedIn: result.pass ? seconds : get().finishedIn });
    return attempt;
  },

  closeResult: () => set({ showResult: false }),
  finish: () => {
    if (!get().last?.check.pass) return;
    set({ showResult: false, complete: true });
  },
  closeComplete: () => set({ complete: false }),
}));

export const activeLevel = (): LevelDef | undefined => {
  const id = useSession.getState().levelId;
  return id ? levelById(id) : undefined;
};
