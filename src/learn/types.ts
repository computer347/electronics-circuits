/** A Learn class: a few short steps (text + a live lab), then a quick check. */

export type LabSpec =
  | { kind: 'ohm'; volts?: number; ohms?: number }
  | { kind: 'led'; volts?: number; ohms?: number; reversed?: boolean; flip?: boolean; meter?: boolean }
  | { kind: 'pair'; ohms?: number; mode?: 'series' | 'parallel'; budget?: number }
  | { kind: 'divider'; rTop?: number; rBottom?: number; target?: [number, number]; maxAmps?: number }
  | { kind: 'rc'; ohms?: number; farads?: number; bleed?: boolean; window?: [number, number] }
  /** Flip the inputs of a gate built from real parts, and watch its lamp and truth table. */
  | { kind: 'logic'; gate: Gate }
  /** Four bits, worth 8 4 2 1: flip them and read the number. */
  | { kind: 'binary' };

export type Gate = 'AND' | 'OR' | 'NOT' | 'NAND';

export interface Step {
  title: string;
  /** Paragraphs. `**bold**` and `` `formula` `` are the only markup. */
  body: string[];
  lab?: LabSpec;
  /** One line under the lab telling you what to try. */
  tryThis?: string;
}

export type Question =
  | { kind: 'choice'; prompt: string; options: string[]; correct: number; explain: string }
  | { kind: 'number'; prompt: string; answer: number; unit: 'V' | 'A' | 'Ω' | 's'; tolerancePct: number; explain: string };

export interface LearnClass {
  id: string;
  world: number;
  number: number;
  title: string;
  /** The level this class prepares you for. */
  levelId: string;
  minutes: number;
  /** What you'll be able to do afterwards, shown on the class card. */
  goals: string[];
  steps: Step[];
  check: Question[];
}
