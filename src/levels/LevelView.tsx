/**
 * Playing a level: the bench in level mode, with the brief, hints and Check button on the
 * left and the result card over the board.
 */
import { useEffect, useState } from 'react';
import { BenchView } from '../breadboard/BenchView';
import { useBench } from '../breadboard/store';
import { WORLD0, WORLD0_PLAN } from '.';
import { useSession } from './session';
import type { LevelDef } from './types';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const STAR_RULES = ['Meet the spec', 'No hints, nothing burnt', 'Within par'];

export function Stars({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' | 'lg' }) {
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
  return (
    <section className="level-brief">
      <h2>Brief</h2>
      <p className="level-story">{level.brief.story}</p>
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
  const outOfSpares = spares === 0 && parts.some((p) => p.burnt);
  const passed = session.last?.check.pass;
  return (
    <section className="level-actions-box">
      <div className="level-stats">
        <span>Checks <b>{session.checks}</b></span>
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
        <button onClick={session.restart}>Restart</button>
      </div>
      <p className="hint">
        {session.hintsShown > 0 ? 'Your hints are in the Brief, on the right. ' : ''}
        {session.hintsShown < level.hints.length ? "Hints cost the silver star, but they're there to be used." : ''}
      </p>
    </section>
  );
}

function ResultCard({ level, onExit }: { level: LevelDef; onExit: () => void }) {
  const { last, showResult, closeResult, restart } = useSession();
  const setView = useBench((s) => s.setView);
  if (!last || !showResult) return null;
  const { check, stars } = last;
  const idx = WORLD0.findIndex((l) => l.id === level.id);
  const next = WORLD0[idx + 1];
  const nextPlan = WORLD0_PLAN.find((p) => p.number === level.number + 1);

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
      <ul className="star-rules">
        {STAR_RULES.map((r, i) => <li key={r} className={(stars ?? 1) > i ? 'on' : ''}>{'★'} {r}{i === 2 ? ` (${parText(level)})` : ''}</li>)}
      </ul>
      <ul className="result-lines">
        {check.lines.map((l) => <li key={l.label} className="ok"><span>✓ {l.label}</span><b>{l.measured}</b></li>)}
      </ul>
      <p className="result-debrief">{level.debrief}</p>
      <p className="hint">{clock(last.stats.seconds)} · {last.stats.checks} check{last.stats.checks === 1 ? '' : 's'}{last.improved ? ' · new best' : ''}</p>
      <div className="result-actions">
        <button className="primary" onClick={() => { closeResult(); setView('ride'); }} autoFocus>Ride your circuit <kbd>R</kbd></button>
        {next ? <button onClick={() => useSession.getState().start(next.id)}>Next: {next.title}</button>
          : nextPlan && <button disabled title="Being built next">Next: {nextPlan.title} (coming soon)</button>}
        <button onClick={restart}>Replay</button>
        <button onClick={onExit}>World map</button>
        <button onClick={closeResult}>Keep tinkering</button>
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
        overlay: <ResultCard level={level} onExit={onExit} />,
      }}
    />
  );
}
