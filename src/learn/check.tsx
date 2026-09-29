/**
 * Lesson text and the check at the end of a lesson: the small markup the lessons use, and
 * grading an answer (a choice, or a typed number with prefixes like 21.2m or 4.7k).
 */
import { Fragment, type ReactNode } from 'react';
import { gradeNumber, type Verdict } from '../drills/check';
import type { Question } from './types';

/** `**bold**` and `` `formula` `` only. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b>
          : p.startsWith('`') ? <code key={i} className="formula">{p.slice(1, -1)}</code>
            : <Fragment key={i}>{p}</Fragment>)}
    </>
  );
}

export type Answer = { choice?: number; text?: string; verdict?: Verdict | 'right' | 'wrong' };

export function grade(q: Question, a: Answer): 'right' | 'wrong' {
  if (q.kind === 'choice') return a.choice === q.correct ? 'right' : 'wrong';
  return gradeNumber(q.answer, q.tolerancePct, a.text ?? '').kind === 'correct' ? 'right' : 'wrong';
}

export function Feedback({ q, a, ok }: { q: Question; a: Answer; ok: boolean }): ReactNode {
  let extra = '';
  if (!ok && q.kind === 'number') {
    const v = gradeNumber(q.answer, q.tolerancePct, a.text ?? '');
    if (v.kind === 'wrong' && v.hint) extra = ` ${v.hint}`;
    if (v.kind === 'unreadable') extra = ' (That wasn\'t a number I could read.)';
  }
  return <p className={`verdict ${ok ? 'good' : 'bad'}`}>{ok ? '✓ ' : '✗ '}{q.explain}{extra}</p>;
}
