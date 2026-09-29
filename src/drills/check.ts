/** Grading typed answers like "27.3m", "27.3 mA", "4.7k" or "-1.25". */
import { parseValue } from '../sim';
import type { Drill } from './generators';

export type Verdict =
  | { kind: 'correct' }
  | { kind: 'wrong'; hint?: string }
  | { kind: 'unreadable' };

export function parseAnswer(input: string): number | null {
  const cleaned = input.trim().replace(/\s+/g, '').replace(',', '.');
  if (!cleaned) return null;
  try {
    return parseValue(cleaned);
  } catch {
    return null;
  }
}

export function checkAnswer(drill: Drill, input: string): Verdict {
  return gradeNumber(drill.answer.value, drill.answer.tolerancePct, input);
}

/** Grades a typed number against `value` ± `tolerancePct` (also used by Learn class checks). */
export function gradeNumber(value: number, tolerancePct: number, input: string): Verdict {
  const got = parseAnswer(input);
  if (got === null) return { kind: 'unreadable' };
  const close = (x: number) => Math.abs(x - value) <= Math.abs(value) * (tolerancePct / 100) + 1e-12;
  if (close(got)) return { kind: 'correct' };
  if (close(-got)) return { kind: 'wrong', hint: 'Right size, wrong sign.' };
  for (const factor of [1e3, 1e-3, 1e6, 1e-6]) {
    if (close(got * factor)) return { kind: 'wrong', hint: 'The digits are right: check your unit prefix (m, µ, k).' };
  }
  return { kind: 'wrong' };
}
