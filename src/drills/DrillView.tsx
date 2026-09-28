import { useState } from 'react';
import { formatSI } from '../lib/units';
import { SchematicView } from '../schematic/SchematicView';
import { checkAnswer, type Verdict } from './check';
import { randomDrill, TOPICS, type Drill } from './generators';

const UNIT_HINT: Record<Drill['answer']['unit'], string> = {
  V: 'volts, e.g. 4.5 or 450m',
  A: 'amps, e.g. 0.0212 or 21.2m',
  'Ω': 'ohms, e.g. 330 or 4.7k',
  s: 'seconds, e.g. 0.47 or 470m',
};

export function DrillView() {
  const [topic, setTopic] = useState<string | undefined>(undefined);
  const [drill, setDrill] = useState<Drill>(() => randomDrill());
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [score, setScore] = useState({ correct: 0, attempted: 0, streak: 0 });
  const [answered, setAnswered] = useState(false);

  const next = (t = topic) => {
    setDrill(randomDrill(t));
    setInput('');
    setVerdict(null);
    setShowSolution(false);
    setAnswered(false);
  };

  const check = () => {
    const v = checkAnswer(drill, input);
    setVerdict(v);
    if (v.kind === 'unreadable' || answered) return;
    setAnswered(true);
    setScore((s) => ({
      correct: s.correct + (v.kind === 'correct' ? 1 : 0),
      attempted: s.attempted + 1,
      streak: v.kind === 'correct' ? s.streak + 1 : 0,
    }));
  };

  return (
    <div className="drills">
      <div className="drill-bar">
        <div className="presets">
          <button className={topic === undefined ? 'active' : ''} onClick={() => { setTopic(undefined); next(undefined); }}>All</button>
          {TOPICS.map((t) => (
            <button key={t} className={topic === t ? 'active' : ''} onClick={() => { setTopic(t); next(t); }}>{t}</button>
          ))}
        </div>
        <div className="score">
          <span>{score.correct}/{score.attempted} correct</span>
          <span>streak {score.streak}</span>
        </div>
      </div>

      <section className="panel drill-card">
        <div className="drill-layout">
          <div className="drill-figure">
            <SchematicView schematic={drill.schematic} highlight={drill.highlight} title={drill.title} />
          </div>
          <div className="drill-side">
            <div className="drill-meta">
              <span>{drill.topic}</span>
              <span className="seed">#{drill.generator}-{drill.seed}</span>
            </div>
            <h2 className="drill-title">{drill.title}</h2>
            <p className="drill-prompt">{drill.prompt}</p>

            <form className="answer" onSubmit={(e) => { e.preventDefault(); check(); }}>
              <div className="answer-input">
                <input
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setVerdict(null); }}
                  placeholder={UNIT_HINT[drill.answer.unit]}
                  aria-label="Your answer"
                  inputMode="decimal"
                  autoFocus
                />
                <span className="unit">{drill.answer.unit}</span>
              </div>
              <div className="answer-buttons">
                <button type="submit" className="primary">Check</button>
                <button type="button" onClick={() => setShowSolution((v) => !v)}>{showSolution ? 'Hide' : 'Show'} solution</button>
                <button type="button" onClick={() => next()}>Next →</button>
              </div>
            </form>

            {verdict?.kind === 'correct' && <p className="verdict good">● Correct: {formatSI(drill.answer.value, drill.answer.unit)}</p>}
            {verdict?.kind === 'wrong' && <p className="verdict bad">▲ Not quite. {verdict.hint ?? 'Try again or open the solution.'}</p>}
            {verdict?.kind === 'unreadable' && <p className="verdict warn">Couldn't read that number. Try something like 4.7k or 21.2m.</p>}

            {showSolution && (
              <ol className="solution">
                {drill.solution.map((line, i) => <li key={i}>{line}</li>)}
                <li className="final">Answer: {formatSI(drill.answer.value, drill.answer.unit, 4)}</li>
              </ol>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
