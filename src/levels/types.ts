/**
 * Level format. A level is plain JSON (see src/levels/world0/): a starting board, faults
 * injected into it, a brief, and a spec the simulator checks. The same shape will be used by
 * generated levels and a level editor later, so everything here is data, not code.
 */
import type { BoardState } from '../breadboard/model';
import type { Tool } from '../breadboard/store';
import type { ScopeSetup } from '../instruments/scopeStore';

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

/** A pass condition, checked against the solved board. `explain` is added to the diagnosis when it fails. */
export type SpecCheck = (
  /** LED current in a window, in amperes. */
  | { kind: 'led-current'; part: string; min: number; max: number }
  /** Voltage at a hole (relative to ground, or to `ref`) in a window, in volts. */
  | { kind: 'voltage'; hole: string; ref?: string; min: number; max: number; label?: string;
      /** The hole is a divider's output: explain wrong divider shapes (shorted, parallel, swapped). */
      divider?: boolean }
  /** Current the bench supply delivers, in amperes. */
  | { kind: 'supply-current'; min?: number; max: number }
  /**
   * Time for a capacitor to reach 63 % of its final voltage (one time constant) from empty,
   * with every push button held down. Found by running the transient simulator.
   */
  | { kind: 'charge-time'; part: string; min: number; max: number }
  /** No LED burnt out on the board at check time. */
  | { kind: 'no-burnt' }
  /**
   * An LED switched by the push buttons: in its current window with every button held,
   * and dark (under 0.1 mA) with every button let go.
   */
  | { kind: 'switched-led'; part: string; min: number; max: number }
  /**
   * Current through a part (or a transistor's base, "Q1.base") with every button held, at
   * most `max` amperes.
   */
  | { kind: 'part-current'; part: string; max: number; label?: string }
  /** These LEDs lit (true) or dark (false), with the switches as the player has set them. */
  | { kind: 'led-pattern'; leds: Record<string, boolean>; label?: string }
  /**
   * Logic: for every combination of the toggle switches `inputs`, LED `output` is lit exactly
   * when `table[i]` is 1. Combination i has input k on when bit k of i is set. An input of "?"
   * is the switch the player adds: any toggle on the board that isn't named.
   */
  | { kind: 'truth-table'; inputs: string[]; output: string; table: (0 | 1)[]; label?: string }
  /**
   * Memory: switches and buttons set step by step (each step starts from the last, gates
   * remembering their states), with LEDs expected lit or dark after each step.
   */
  | { kind: 'sequence'; steps: { set: Record<string, boolean>; expect: Record<string, boolean>; say: string }[]; label?: string }
) & { explain?: string };

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
  /** Parts the player can flip or edit, but not move or remove (the suspect in a find-the-fault level). */
  pinned?: string[];
  /** Scope probes clipped on at the start, and knob settings that suit the level. */
  scope?: { ch1?: string; ch2?: string; setup?: ScopeSetup };
  /** Tools available in this level (select is always there). */
  tools: Tool[];
  /** Resistor values the parts bin offers, in ohms (omit for the full E12 range). */
  resistorValues?: number[];
  /** Spare LEDs: each burnt LED costs one to replace. */
  spares?: { led?: number };
  spec: SpecCheck[];
  /**
   * Gold star: pass within this many checks, added parts and multimeter measurements (both
   * probes placed), with no hints and nothing burnt.
   */
  par: { checks: number; partsAdded?: number; measurements?: number };
  /** Shown on the result screen: what just happened, and why it works. */
  debrief: string;
}
