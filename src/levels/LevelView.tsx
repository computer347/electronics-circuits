/**
 * Playing a level: the bench in level mode, with the brief, hints and Check button on the
 * left and the result card over the board.
 */
import { useEffect, useState } from 'react';
import { useNav } from '../app/nav';
import { classForLevel } from '../learn/classes';
import { useLearnProgress } from '../learn/progress';
import { BenchView } from '../breadboard/BenchView';
import { useBench } from '../breadboard/store';
import { WORLD0, WORLD0_PLAN } from '.';
import { useProgress } from './progress';
import { useSession } from './session';
import type { LevelDef } from './types';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const STAR_RULES = ['Meet the spec', 'No hints, nothing burnt', 'Within par'];

export function Stars({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`stars stars-${size}`} aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}
    </span>
  );
}

function useElapsed() {
  const { startedAt, finishedIn } = useSession();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (finishedIn !== null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finishedIn]);
  return finishedIn ?? Math.max(0, Math.round((now - startedAt) / 1000));
}

function parText(l: LevelDef) {
  const bits = [`${l.par.checks} check${l.par.checks === 1 ? '' : 's'}`];
  if (l.par.partsAdded !== undefined) bits.push(`${l.par.partsAdded} part${l.par.partsAdded === 1 ? '' : 's'} added`);
  if (l.par.measurements !== undefined) bits.push(`${l.par.measurements} measurement${l.par.measurements === 1 ? '' : 's'}`);
  return bits.join(', ');
}

/** Left panel top: where you are and what to do. */
function LevelPanel({ level, onExit }: { level: LevelDef; onExit: () => void }) {
  const elapsed = useElapsed();
  return (
    <section className="level-panel">
      <div className="level-top">
        <button className="link" onClick={onExit}>← World {level.world}</button>
        <span className="level-clock" aria-label="Time">{clock(elapsed)}</span>
      </div>
      <div className="level-kicker">Level {level.world}–{level.number} · {level.format === 'build' ? 'Build to spec' : 'Find the fault'}</div>
      <h2 className="level-title">{level.title}</h2>
      <div className="level-goal"><span>Goal</span>{level.brief.goal}</div>
    </section>
  );
}

/** Right panel top: the story, the datasheet, and any hints you've asked for. */
function LevelBrief({ level }: { level: LevelDef }) {
  const hintsShown = useSession((s) => s.hintsShown);
  const ds = level.brief.datasheet;
  const cls = classForLevel(level.id);
  const learned = useLearnProgress((s) => (cls ? !!s.classes[cls.id] : false));
  return (
    <section className="level-brief">
      <h2>Brief</h2>
      <p className="level-story">{level.brief.story}</p>
      {cls && (
        <button className={`class-link ${learned ? 'done' : ''}`} onClick={() => useNav.getState().openClass(cls.id)}
          title="Opens the class. Your stars are kept; the board starts fresh when you come back.">
          <span>{learned ? '✓ Class' : 'New to this? Class'} {cls.world}–{cls.number}</span>
          <b>{cls.title} →</b>
        </button>
      )}
      {ds && (
        <div className="datasheet">
          <div className="datasheet-title">Datasheet · {ds.title}</div>
          <table><tbody>{ds.rows.map(([k, v]) => <tr key={k}><th>{k}</th><td className="num">{v}</td></tr>)}</tbody></table>
        </div>
      )}
      {hintsShown > 0 && (
        <>
          <h2>Hints</h2>
          <ol className="hints">
            {level.hints.slice(0, hintsShown).map((h, i) => <li key={i}>{h}</li>)}
          </ol>
        </>
      )}
    </section>
  );
}

function LevelActions({ level }: { level: LevelDef }) {
  const session = useSession();
  const spares = useBench((s) => s.spares);
  const parts = useBench((s) => s.parts);
  const measurements = useBench((s) => s.measurements);
  const outOfSpares = spares === 0 && parts.some((p) => p.burnt);
  const passed = session.last?.check.pass;
  return (
    <section className="level-actions-box">
      <div className="level-stats">
        <span>Checks <b>{session.checks}</b></span>
        {level.par.measurements !== undefined && <span title="A measurement is both multimeter probes on the board">Measurements <b>{measurements - session.measurementsAtStart}</b></span>}
        {spares !== null && <span>Spare LEDs <b className={spares === 0 ? 'bad' : ''}>{spares}</b></span>}
        <span title="Gold star: pass within par, with no hints and nothing burnt">Par <b>{parText(level)}</b></span>
      </div>

      {outOfSpares && <p className="level-warn">Out of spare LEDs. Restart the level to get a fresh set.</p>}

      <button className="check-btn" onClick={() => session.check()}>{passed ? 'Check again' : 'Check circuit'}</button>
      <div className="level-actions">
        {session.hintsShown < level.hints.length && (
          <button onClick={session.showHint} title="Using a hint costs the silver star">
            Hint {session.hintsShown + 1} of {level.hints.length}
          </button>
        )}
        {passed && <button onClick={session.finish}>Level summary</button>}
        <button onClick={session.restart}>Restart</button>
      </div>
      <p className="hint">
        {session.hintsShown > 0 ? 'Your hints are in the Brief, on the right. ' : ''}
        {session.hintsShown < level.hints.length ? "Hints cost the silver star, but they're there to be used." : ''}
      </p>
    </section>
  );
}

function ResultCard({ level }: { level: LevelDef }) {
  const { last, showResult, closeResult, finish } = useSession();
  const setView = useBench((s) => s.setView);
  if (!last || !showResult) return null;
  const { check, stars } = last;

  if (!check.pass) {
    return (
      <div className="result-card fail" role="dialog" aria-label="Check result">
        <div className="result-kicker">Not yet</div>
        {check.diagnosis && <p className="result-diagnosis">{check.diagnosis.message}</p>}
        <ul className="result-lines">
          {check.lines.map((l) => <li key={l.label} className={l.ok ? 'ok' : 'bad'}><span>{l.ok ? '✓' : '✗'} {l.label}</span><b>{l.measured}</b></li>)}
        </ul>
        {check.diagnosis?.part && <p className="hint">{check.diagnosis.part} is highlighted on the board.</p>}
        <div className="result-actions"><button className="primary" onClick={closeResult} autoFocus>Keep working</button></div>
      </div>
    );
  }

  return (
    <div className="result-card pass" role="dialog" aria-label="Level passed">
      <div className="result-kicker">Spec met</div>
      <h3 className="result-title">{level.title}</h3>
      <Stars n={stars ?? 1} size="lg" />
      <ul className="result-lines">
        {check.lines.map((l) => <li key={l.label} className="ok"><span>✓ {l.label}</span><b>{l.measured}</b></li>)}
      </ul>
      <p className="result-debrief">{level.debrief}</p>
      <p className="hint">Ride through your circuit to see where the energy goes, or carry on to the level summary.</p>
      <div className="result-actions">
        <button className="primary" onClick={() => { closeResult(); setView('ride'); }} autoFocus>Ride your circuit <kbd>R</kbd></button>
        <button onClick={finish}>Continue →</button>
        <button onClick={closeResult}>Keep tinkering</button>
      </div>
    </div>
  );
}

/** On the ride's stop cards once the level is passed: go to the summary. */
function FinishButton() {
  const passed = useSession((s) => !!s.last?.check.pass);
  const finish = useSession((s) => s.finish);
  return passed ? <button className="finish" onClick={finish}>Finish level ✓</button> : null;
}

/** Shown once a level is passed: the score, then on to the next level or back to the map. */
function CompleteScreen({ level, onExit }: { level: LevelDef; onExit: () => void }) {
  const { complete, last, restart, closeComplete, start } = useSession();
  const records = useProgress((s) => s.levels);
  if (!complete || !last?.check.pass) return null;
  const idx = WORLD0.findIndex((l) => l.id === level.id);
  const next = WORLD0[idx + 1];
  const nextPlan = WORLD0_PLAN.find((p) => p.number === level.number + 1);
  const worldDone = WORLD0.length === WORLD0_PLAN.length && WORLD0.every((l) => records[l.id]);
  const s = last.stats;
  const best = records[level.id];
  const rows: [string, string][] = [
    ['Time', clock(s.seconds)],
    ['Checks', `${s.checks} (par ${level.par.checks})`],
    ...(level.par.measurements !== undefined ? [['Measurements', `${s.measurements} (par ${level.par.measurements})`] as [string, string]] : []),
    ['Hints used', String(s.hintsUsed)],
    ...(level.spares ? [['LEDs burnt', String(s.burnt)] as [string, string]] : []),
  ];
  return (
    <div className="complete-backdrop">
      <div className="complete" role="dialog" aria-label="Level complete">
        <div className="result-kicker">Level {level.world}–{level.number} complete</div>
        <h3 className="complete-title">{level.title}</h3>
        <Stars n={last.stars ?? 1} size="xl" />
        <ul className="star-rules center">
          {STAR_RULES.map((r, i) => <li key={r} className={(last.stars ?? 1) > i ? 'on' : ''}>★ {r}{i === 2 ? ` (${parText(level)})` : ''}</li>)}
        </ul>
        <table className="complete-stats"><tbody>
          {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td className="num">{v}</td></tr>)}
        </tbody></table>
        {last.improved && <div className="complete-best">New best</div>}
        {best && !last.improved && <p className="hint">Your best: {'★'.repeat(best.stars)} in {clock(best.seconds)}</p>}
        {worldDone && !next && <p className="complete-world">World 0 complete. Every level's stars count toward the next world.</p>}
        <div className="complete-actions">
          {next ? (
            <button className="primary" onClick={() => start(next.id)} autoFocus>Next level: {next.title} →</button>
          ) : nextPlan ? (
            <button className="primary" disabled>Next: {nextPlan.title} (coming soon)</button>
          ) : null}
          <button className={next ? '' : 'primary'} onClick={onExit} autoFocus={!next}>Back to menu</button>
          <button onClick={restart}>Replay</button>
          <button onClick={closeComplete}>Keep tinkering</button>
        </div>
      </div>
    </div>
  );
}

export function LevelView({ level, onExit }: { level: LevelDef; onExit: () => void }) {
  return (
    <BenchView
      mode={{
        tools: level.tools,
        resistorValues: level.resistorValues,
        panel: <LevelPanel level={level} onExit={onExit} />,
        actions: <LevelActions level={level} />,
        side: <LevelBrief level={level} />,
        overlay: <><ResultCard level={level} /><CompleteScreen level={level} onExit={onExit} /></>,
        rideExtra: <FinishButton />,
      }}
    />
  );
}
