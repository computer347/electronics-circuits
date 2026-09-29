/**
 * The Learn tab: World 0's classes as a syllabus, and a class reader that pages through
 * its steps (text + live lab) and ends with a short check and a way into its level.
 */
import { Fragment, useState, type ReactNode } from 'react';
import { useNav } from '../app/nav';
import { gradeNumber, type Verdict } from '../drills/check';
import { levelById } from '../levels';
import { useProgress } from '../levels/progress';
import { WORLD0_CLASSES, classById } from './classes';
import { Lab } from './Labs';
import { useLearnProgress } from './progress';
import type { LearnClass, Question } from './types';

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

const code = (c: LearnClass) => `${c.world}–${c.number}`;

export function LearnView() {
  const classId = useNav((s) => s.classId);
  const cls = classId ? classById(classId) : undefined;
  return cls ? <ClassReader key={cls.id} cls={cls} /> : <Syllabus />;
}

function Syllabus() {
  const done = useLearnProgress((s) => s.classes);
  const levels = useProgress((s) => s.levels);
  const openClass = useNav((s) => s.openClass);
  const finished = WORLD0_CLASSES.filter((c) => done[c.id]).length;
  return (
    <main className="learn">
      <header className="world-head">
        <div>
          <div className="level-kicker">Learn · World 0</div>
          <h2 className="world-title">Foundations</h2>
          <p className="world-sub">One short class for each World 0 level: exactly the theory that level needs, with a live circuit to try it on. Take them in order, or jump to the one you need. None of them lock anything.</p>
        </div>
        <div className="world-score"><b>{finished}</b> / {WORLD0_CLASSES.length} classes</div>
      </header>
      <ol className="class-list">
        {WORLD0_CLASSES.map((c) => {
          const rec = done[c.id];
          const level = levelById(c.levelId);
          return (
            <li key={c.id}>
              <button className={`class-card ${rec ? 'done' : ''}`} onClick={() => openClass(c.id)}>
                <span className="class-num">{code(c)}</span>
                <span className="class-main">
                  <span className="class-title">{c.title}</span>
                  <span className="class-goals">{c.goals.join(' · ')}</span>
                </span>
                <span className="class-meta">
                  <span>{c.minutes} min</span>
                  <span className={rec ? 'ok' : ''}>{rec ? `✓ ${rec.best}/${rec.of}` : 'Start →'}</span>
                  {level && <span className="class-level">→ level {code(c)} {level.title}{levels[level.id] ? ' ✓' : ''}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function ClassReader({ cls }: { cls: LearnClass }) {
  const openClass = useNav((s) => s.openClass);
  const [at, setAt] = useState(0); // 0..steps.length (the last page is the check)
  const pages = cls.steps.length + 1;
  const onCheck = at === cls.steps.length;
  const step = cls.steps[at];
  const level = levelById(cls.levelId);

  return (
    <main className="learn class-reader">
      <header className="class-head">
        <button className="back" onClick={() => openClass(null)}>← All classes</button>
        <div className="level-kicker">Class {code(cls)}{level ? ` · for level ${code(cls)} ${level.title}` : ''}</div>
        <h2 className="class-h">{cls.title}</h2>
        <nav className="class-steps" aria-label="Steps">
          {cls.steps.map((s, i) => (
            <button key={i} className={i === at ? 'active' : i < at ? 'seen' : ''} aria-current={i === at ? 'step' : undefined} onClick={() => setAt(i)}>
              {i + 1}. {s.title}
            </button>
          ))}
          <button className={onCheck ? 'active' : ''} aria-current={onCheck ? 'step' : undefined} onClick={() => setAt(cls.steps.length)}>✓ Check</button>
        </nav>
      </header>

      {step ? (
        <section className={`class-step ${step.lab ? 'has-lab' : ''}`} key={at}>
          <div className="class-text">
            <h3>{step.title}</h3>
            {step.body.map((p, i) => <p key={i}><Rich text={p} /></p>)}
          </div>
          {step.lab && (
            <div className="class-lab">
              <Lab spec={step.lab} />
              {step.tryThis && <p className="try-this"><span>Try this</span> {step.tryThis}</p>}
            </div>
          )}
        </section>
      ) : (
        <ClassCheck cls={cls} />
      )}

      <footer className="class-foot">
        <button disabled={at === 0} onClick={() => setAt(at - 1)}>← Back</button>
        <span className="class-progress" aria-label={`Page ${at + 1} of ${pages}`}>
          {Array.from({ length: pages }, (_, i) => <i key={i} className={i <= at ? 'on' : ''} />)}
        </span>
        {!onCheck && <button className="primary" onClick={() => setAt(at + 1)}>{at === cls.steps.length - 1 ? 'Check yourself →' : 'Next →'}</button>}
        {onCheck && <span />}
      </footer>
    </main>
  );
}

type Answer = { choice?: number; text?: string; verdict?: Verdict | 'right' | 'wrong' };

function ClassCheck({ cls }: { cls: LearnClass }) {
  const finish = useLearnProgress((s) => s.finish);
  const nav = useNav();
  const [answers, setAnswers] = useState<Answer[]>(() => cls.check.map(() => ({})));
  const [submitted, setSubmitted] = useState(false);
  const idx = WORLD0_CLASSES.indexOf(cls);
  const next = WORLD0_CLASSES[idx + 1];
  const level = levelById(cls.levelId);

  const set = (i: number, a: Answer) => setAnswers((all) => all.map((x, j) => (j === i ? a : x)));
  const graded = answers.map((a, i) => grade(cls.check[i]!, a));
  const correct = graded.filter((g) => g === 'right').length;
  const allAnswered = answers.every((a, i) => cls.check[i]!.kind === 'choice' ? a.choice !== undefined : !!a.text?.trim());

  const submit = () => {
    setSubmitted(true);
    finish(cls.id, correct, cls.check.length);
  };

  return (
    <section className="class-check">
      <h3>Check yourself</h3>
      <p className="world-sub">Three quick questions. Numbers can be typed with prefixes: 21.2m, 4.7k, 500.</p>
      <ol className="check-list">
        {cls.check.map((q, i) => (
          <li key={i} className={submitted ? graded[i] : ''}>
            <p className="check-q">{q.prompt}</p>
            {q.kind === 'choice' ? (
              <div className="check-options" role="radiogroup">
                {q.options.map((o, k) => (
                  <button key={k} role="radio" aria-checked={answers[i]!.choice === k} disabled={submitted}
                    className={[answers[i]!.choice === k ? 'picked' : '', submitted && k === q.correct ? 'correct' : ''].join(' ')}
                    onClick={() => set(i, { choice: k })}>{o}</button>
                ))}
              </div>
            ) : (
              <label className="check-number">
                <input value={answers[i]!.text ?? ''} disabled={submitted} inputMode="decimal"
                  onChange={(e) => set(i, { text: e.target.value })} aria-label={`Answer in ${q.unit}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' && allAnswered && !submitted) submit(); }} />
                <span>{q.unit}</span>
              </label>
            )}
            {submitted && <Feedback q={q} a={answers[i]!} ok={graded[i] === 'right'} />}
          </li>
        ))}
      </ol>
      {!submitted ? (
        <button className="primary" disabled={!allAnswered} onClick={submit}>Check answers</button>
      ) : (
        <div className="check-result">
          <p className="check-score"><b>{correct}</b> / {cls.check.length} right{correct === cls.check.length ? '. You\'re ready.' : '. Read the explanations, then have a go anyway.'}</p>
          <div className="check-actions">
            {level && <button className="primary" onClick={() => nav.playLevel(level.id)}>Try it: level {code(cls)} {level.title} →</button>}
            {next && <button onClick={() => nav.openClass(next.id)}>Next class: {code(next)} {next.title}</button>}
            <button onClick={() => { setAnswers(cls.check.map(() => ({}))); setSubmitted(false); }}>Try the questions again</button>
          </div>
        </div>
      )}
    </section>
  );
}

function grade(q: Question, a: Answer): 'right' | 'wrong' {
  if (q.kind === 'choice') return a.choice === q.correct ? 'right' : 'wrong';
  return gradeNumber(q.answer, q.tolerancePct, a.text ?? '').kind === 'correct' ? 'right' : 'wrong';
}

function Feedback({ q, a, ok }: { q: Question; a: Answer; ok: boolean }): ReactNode {
  let extra = '';
  if (!ok && q.kind === 'number') {
    const v = gradeNumber(q.answer, q.tolerancePct, a.text ?? '');
    if (v.kind === 'wrong' && v.hint) extra = ` ${v.hint}`;
    if (v.kind === 'unreadable') extra = ' (That wasn\'t a number I could read.)';
  }
  return <p className={`verdict ${ok ? 'good' : 'bad'}`}>{ok ? '✓ ' : '✗ '}{q.explain}{extra}</p>;
}
