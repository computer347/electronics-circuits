/**
 * The notebook's Theory and Math pages, laid exactly over the open book (its place on screen
 * comes from the 3D scene). Tabs down the edge switch section; ‹ › turn the page. Everything
 * here is live: labs with sliders, a check you answer, drills you type into.
 */
import { useMemo, useState } from 'react';
import { checkAnswer, type Verdict } from '../drills/check';
import { makeDrill, randomDrill, TOPICS } from '../drills/generators';
import { formatSI } from '../lib/units';
import { Lab } from '../learn/Labs';
import { Feedback, grade, Rich, type Answer } from '../learn/check';
import { useLearnProgress } from '../learn/progress';
import type { LearnClass } from '../learn/types';
import type { LevelDef } from '../levels/types';
import { SchematicView } from '../schematic/SchematicView';
import { SECTIONS, spreads, type Formula, type Section, type Spread } from './notebook';
import { useNotebookRect } from './notebookRect';
import { PartModel } from './PartModel';
import { useDesk } from './store';

const SECTION_NAME: Record<Section, string> = { task: 'Task', theory: 'Theory', math: 'Math' };

function Tabs({ section, onPick }: { section: Section; onPick: (s: Section) => void }) {
  return (
    <nav className="nb-tabs" aria-label="Notebook sections">
      {SECTIONS.map((s) => (
        <button key={s} className={`nb-tab ${s} ${s === section ? 'on' : ''}`} onClick={() => onPick(s)}>{SECTION_NAME[s]}</button>
      ))}
    </nav>
  );
}

function PartSpread({ spread }: { spread: Extract<Spread, { kind: 'part' }> }) {
  const p = spread.part;
  return (
    <>
      <div className="nb-page left">
        <p className="nb-kicker">Meet the part</p>
        <h2>{p.name}</h2>
        <p className="nb-lead">{p.job}</p>
        <ol className="nb-facts">{p.facts.map((f) => <li key={f.label}><b>{f.label}</b> {f.text}</li>)}</ol>
      </div>
      <div className="nb-page right nb-model">
        <PartModel part={p.id} labels={p.facts.map((f) => f.label)} />
      </div>
    </>
  );
}

function StepSpread({ spread }: { spread: Extract<Spread, { kind: 'step' }> }) {
  const { cls, step, index } = spread;
  return (
    <>
      <div className="nb-page left">
        <p className="nb-kicker">Theory · {cls.title} · {index + 1}/{cls.steps.length}</p>
        <h2>{step.title}</h2>
        {step.body.map((b, i) => <p key={i}><Rich text={b} /></p>)}
      </div>
      <div className="nb-page right">
        {step.lab ? (
          <>
            <p className="nb-kicker">Try it</p>
            <div className="nb-lab"><Lab spec={step.lab} /></div>
            {step.tryThis && <p className="nb-try">{step.tryThis}</p>}
          </>
        ) : (
          <>
            {/* No live lab on this step: what the class is for, and what comes next. */}
            <p className="nb-kicker">In this class</p>
            <ul className="nb-goals">{cls.goals.map((g) => <li key={g}>{g}</li>)}</ul>
            {step.tryThis && <p className="nb-try">{step.tryThis}</p>}
            <p className="nb-next">Next: {cls.steps[index + 1]?.title ?? 'a three-question check'} →</p>
          </>
        )}
      </div>
    </>
  );
}

function CheckSpread({ cls }: { cls: LearnClass }) {
  const finish = useLearnProgress((s) => s.finish);
  const done = useLearnProgress((s) => s.classes[cls.id]);
  const [answers, setAnswers] = useState<Answer[]>(() => cls.check.map(() => ({})));
  const [submitted, setSubmitted] = useState(false);
  const set = (i: number, a: Answer) => setAnswers((all) => all.map((x, j) => (j === i ? a : x)));
  const graded = answers.map((a, i) => grade(cls.check[i]!, a));
  const correct = graded.filter((g) => g === 'right').length;
  const allAnswered = answers.every((a, i) => (cls.check[i]!.kind === 'choice' ? a.choice !== undefined : !!a.text?.trim()));
  const question = (i: number) => {
    const q = cls.check[i]!;
    return (
      <li key={i} className={submitted ? graded[i] : ''}>
        <p className="nb-q">{q.prompt}</p>
        {q.kind === 'choice' ? (
          <div className="nb-options" role="radiogroup">
            {q.options.map((o, k) => (
              <button key={k} role="radio" aria-checked={answers[i]!.choice === k} disabled={submitted}
                className={[answers[i]!.choice === k ? 'picked' : '', submitted && k === q.correct ? 'correct' : ''].join(' ')}
                onClick={() => set(i, { choice: k })}>{o}</button>
            ))}
          </div>
        ) : (
          <label className="nb-number">
            <input value={answers[i]!.text ?? ''} disabled={submitted} inputMode="decimal" onChange={(e) => set(i, { text: e.target.value })} aria-label={`Answer in ${q.unit}`} />
            <span>{q.unit}</span>
          </label>
        )}
        {submitted && <Feedback q={q} a={answers[i]!} ok={graded[i] === 'right'} />}
      </li>
    );
  };
  const half = Math.ceil(cls.check.length / 2);
  return (
    <>
      <div className="nb-page left">
        <p className="nb-kicker">Check yourself{done ? ` · best ${done.best}/${done.of}` : ''}</p>
        <ol className="nb-check">{cls.check.slice(0, half).map((_, i) => question(i))}</ol>
      </div>
      <div className="nb-page right">
        <ol className="nb-check" start={half + 1}>{cls.check.slice(half).map((_, i) => question(i + half))}</ol>
        {!submitted ? (
          <button className="nb-button" disabled={!allAnswered} onClick={() => { setSubmitted(true); finish(cls.id, correct, cls.check.length); }}>Check answers</button>
        ) : (
          <div className="nb-result">
            <p><b>{correct}</b> / {cls.check.length} right{correct === cls.check.length ? '. Stamped: you’re ready.' : '. Read the notes, then have a go anyway.'}</p>
            {correct === cls.check.length && <span className="nb-stamp" aria-hidden>READY</span>}
            <button className="nb-link" onClick={() => { setAnswers(cls.check.map(() => ({}))); setSubmitted(false); }}>Try again</button>
          </div>
        )}
      </div>
    </>
  );
}

function FormulaCard({ f }: { f: Formula }) {
  return (
    <div className="nb-formula">
      <p className="nb-kicker">{f.name}</p>
      <p className="nb-expr">{f.expr}</p>
      <table><tbody>{f.terms.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
      <p className="nb-when">{f.when}</p>
    </div>
  );
}

function FormulasSpread({ formulas }: { formulas: Formula[] }) {
  return (
    <>
      <div className="nb-page left">{formulas[0] && <FormulaCard f={formulas[0]} />}</div>
      <div className="nb-page right">{formulas[1] ? <FormulaCard f={formulas[1]} /> : <p className="nb-try">Turn the page for a worked example, then try one yourself.</p>}</div>
    </>
  );
}

function WorkedSpread({ generator, seed }: { generator: string; seed: number }) {
  const d = useMemo(() => makeDrill(generator, seed), [generator, seed]);
  return (
    <>
      <div className="nb-page left">
        <p className="nb-kicker">Worked example · {d.topic}</p>
        <h2>{d.title}</h2>
        <p>{d.prompt}</p>
        <div className="nb-schematic"><SchematicView schematic={d.schematic} highlight={d.highlight} /></div>
      </div>
      <div className="nb-page right">
        <p className="nb-kicker">Step by step</p>
        <ol className="nb-solution">{d.solution.map((l, i) => <li key={i}>{l}</li>)}</ol>
        <p className="nb-answer">Answer: <b>{formatSI(d.answer.value, d.answer.unit)}</b></p>
      </div>
    </>
  );
}

function PracticeSpread({ generator }: { generator: string }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  // This level's kind of question by default; any exam topic on request.
  const [topic, setTopic] = useState<string>('');
  const d = useMemo(() => (topic ? randomDrill(topic, seed) : makeDrill(generator, seed)), [generator, topic, seed]);
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [shown, setShown] = useState(false);
  const another = () => { setSeed(Math.floor(Math.random() * 2 ** 31)); setInput(''); setVerdict(null); setShown(false); };
  return (
    <>
      <div className="nb-page left">
        <p className="nb-kicker">Your turn · {d.topic}</p>
        <label className="nb-topic">Practise
          <select value={topic} onChange={(e) => { setTopic(e.target.value); setSeed(Math.floor(Math.random() * 2 ** 31)); setInput(''); setVerdict(null); setShown(false); }}>
            <option value="">this level’s questions</option>
            {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <h2>{d.title}</h2>
        <p>{d.prompt}</p>
        <div className="nb-schematic"><SchematicView schematic={d.schematic} highlight={d.highlight} /></div>
      </div>
      <div className="nb-page right">
        <label className="nb-number big">
          <input value={input} onChange={(e) => { setInput(e.target.value); setVerdict(null); }} inputMode="decimal" aria-label={`Answer in ${d.answer.unit}`}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setVerdict(checkAnswer(d, input)); } }} />
          <span>{d.answer.unit}</span>
        </label>
        <p className="nb-hint">Prefixes work: 21.2m, 4.7k.</p>
        <div className="nb-row">
          <button className="nb-button" disabled={!input.trim()} onClick={() => setVerdict(checkAnswer(d, input))}>Check</button>
          <button className="nb-link" onClick={() => setShown(true)}>Show the working</button>
          <button className="nb-link" onClick={another}>Another one</button>
        </div>
        {verdict && (
          <p className={`verdict ${verdict.kind === 'correct' ? 'good' : 'bad'}`}>
            {verdict.kind === 'correct' ? '✓ Right.' : verdict.kind === 'unreadable' ? 'That isn’t a number I can read.' : `✗ Not quite.${verdict.hint ? ` ${verdict.hint}` : ''}`}
          </p>
        )}
        {shown && <ol className="nb-solution">{d.solution.map((l, i) => <li key={i}>{l}</li>)}</ol>}
      </div>
    </>
  );
}

function SpreadView({ spread }: { spread: Spread }) {
  switch (spread.kind) {
    case 'part': return <PartSpread spread={spread} />;
    case 'step': return <StepSpread spread={spread} />;
    case 'check': return <CheckSpread cls={spread.cls} />;
    case 'formulas': return <FormulasSpread formulas={spread.formulas} />;
    case 'worked': return <WorkedSpread generator={spread.generator} seed={spread.seed} />;
    case 'practice': return <PracticeSpread generator={spread.generator} />;
  }
}

export function NotebookPages({ level }: { level: LevelDef }) {
  const rect = useNotebookRect((s) => s.rect);
  const section = useDesk((s) => s.nbSection);
  const page = useDesk((s) => s.nbPage);
  const list = useMemo(() => spreads(level, section), [level, section]);
  if (!rect) return null;
  const at = Math.min(page, Math.max(0, list.length - 1));
  const spread = list[at];
  const turn = (d: number) => useDesk.getState().setNbPage(Math.max(0, Math.min(list.length - 1, at + d)));
  return (
    <div className="nb" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, fontSize: Math.max(10, rect.height / 40) }}>
      <Tabs section={section} onPick={(s) => useDesk.getState().openNotebook(s)} />
      {section !== 'task' && spread && (
        <div className="nb-spread" key={`${section}-${at}`}>
          <SpreadView spread={spread} />
          <div className="nb-nav">
            <button onClick={() => turn(-1)} disabled={at === 0} aria-label="Previous page">‹</button>
            <span>{at + 1} / {list.length}</span>
            <button onClick={() => turn(1)} disabled={at >= list.length - 1} aria-label="Next page">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
