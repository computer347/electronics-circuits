/**
 * Level format. A level is plain JSON (see src/levels/world0/): a starting board, faults
 * injected into it, a brief, and a spec the simulator checks. The same shape will be used by
 * generated levels and a level editor later, so everything here is data, not code.
 */
import type { BoardState } from '../breadboard/model';
import type { Tool } from '../breadboard/store';

export type LevelFormat = 'build' | 'find-fault';

/** A change applied to the base board before the player sees it. */
export type FaultSpec =
  /** Swap a part's legs (a backwards LED, electrolytic or battery). */
  | { kind: 'reverse'; part: string }
  /** Wrong resistor value (a misread colour code). */
  | { kind: 'value'; part: string; ohms: number }
  /** One leg in the wrong hole (off by a row, across the centre gap, on the wrong rail). */
  | { kind: 'move-leg'; part: string; leg: 'h1' | 'h2'; to: string }
  /** A part missing entirely (a jumper that was never placed). */
  | { kind: 'remove'; part: string };

/** A pass condition, checked against the solved board. */
export type SpecCheck =
  /** LED current in a window, in amperes. */
  | { kind: 'led-current'; part: string; min: number; max: number }
  /** Voltage at a hole (relative to ground, or to `ref`) in a window, in volts. */
  | { kind: 'voltage'; hole: string; ref?: string; min: number; max: number; label?: string }
  /** No LED burnt out on the board at check time. */
  | { kind: 'no-burnt' };

export interface DatasheetCard {
  title: string;
  rows: [string, string][];
}

export interface LevelDef {
  id: string;
  world: number;
  number: number;
  title: string;
  format: LevelFormat;
  skills: string[];
  brief: {
    /** One or two sentences of story. */
    story: string;
    /** What passing means, in plain words. */
    goal: string;
    datasheet?: DatasheetCard;
  };
  /** Revealed one at a time; using any costs the silver star. */
  hints: string[];
  board: BoardState;
  faults?: FaultSpec[];
  /** Parts the player can't move, edit or remove (the level's own wiring). */
  locked?: string[];
  /** Tools available in this level (select is always there). */
  tools: Tool[];
  /** Resistor values the parts bin offers, in ohms (omit for the full E12 range). */
  resistorValues?: number[];
  /** Spare LEDs: each burnt LED costs one to replace. */
  spares?: { led?: number };
  spec: SpecCheck[];
  /** Gold star: pass within this many checks and added parts, with no hints and nothing burnt. */
  par: { checks: number; partsAdded?: number; probes?: number };
  /** Shown on the result screen: what just happened, and why it works. */
  debrief: string;
}
