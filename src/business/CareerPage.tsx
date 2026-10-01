/**
 * The career page: your rank and what the next one takes, the certificates (each a group of
 * training levels, with a Train button to the first one still to pass), and the achievements.
 */
import { useEffect } from 'react';
import '../desk/desk.css';
import './business.css';
import { useWallet } from '../jobs/wallet';
import { useProgress } from '../levels/progress';
import { levelById } from '../levels';
import { ACHIEVEMENTS, CERTIFICATES, certState, jobsDone, rankIndex, RANKS, reputation, type CareerInput } from './career';
import { useBusiness } from './store';

export function useCareerInput(): CareerInput {
  const records = useProgress((s) => s.levels);
  const credits = useWallet((s) => s.credits);
  const done = useWallet((s) => s.done);
  const tools = useBusiness((s) => s.tools);
  return { records, credits, done, tools };
}

export function CareerPage({ onBack, onShop, onTrain }: { onBack: () => void; onShop: () => void; onTrain: (levelId: string) => void }) {
  const input = useCareerInput();
  const earnedAt = useBusiness((s) => s.achievements);
  const r = rankIndex(input);
  const next = RANKS[r + 1];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <main className="riso biz" aria-label="Career">
      <button className="desk-back" onClick={onBack}>‹ Menu <kbd>Esc</kbd></button>
      <header className="biz-head">
        <h1 className="workshop-title">CAREER</h1>
        <p className="biz-stats"><span>{input.credits} credits</span><span>reputation {reputation(input)}</span><span>{jobsDone(input)} {jobsDone(input) === 1 ? 'job' : 'jobs'} done</span>
          <button className="landing-link" onClick={onShop}>Shop →</button></p>
      </header>

      <section aria-label="Rank" className="biz-section">
        <ol className="biz-ladder">
          {RANKS.map((k, i) => <li key={k.id} className={i < r ? 'past' : i === r ? 'now' : ''}>{k.name}</li>)}
        </ol>
        {next ? (
          <div className="biz-next">
            <p className="nb-kicker">Next: {next.name}</p>
            <ul>{next.needs.map((n) => <li key={n.label} className={n.ok(input) ? 'ok' : ''}>{n.ok(input) ? '✓' : '○'} {n.label}</li>)}</ul>
          </div>
        ) : <p className="biz-next">You’re a Master Engineer. The job board keeps going: the records are yours to beat.</p>}
      </section>

      <section aria-label="Certificates" className="biz-section">
        <h2>Certificates <small>earned in training: pass every level in the group; three stars on all of them for a distinction</small></h2>
        <ul className="biz-certs">
          {CERTIFICATES.map((c) => {
            const st = certState(c, input.records);
            const todo = c.levels.find((id) => !input.records[id]) ?? c.levels.find((id) => input.records[id]?.stars !== 3);
            return (
              <li key={c.id} className={st.earned ? (st.distinction ? 'dist' : 'earned') : ''}>
                <span className="biz-seal" aria-hidden>{st.distinction ? '★' : st.earned ? '✓' : `${st.passed}/${st.total}`}</span>
                <b>{c.name}</b>
                <span>{c.what}</span>
                <i className="biz-bar"><i style={{ width: `${(100 * st.passed) / st.total}%` }} /></i>
                {todo && <button className="landing-link" onClick={() => onTrain(todo)}>{st.earned ? 'Go for distinction' : 'Train'}: {levelById(todo)?.title} →</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Achievements" className="biz-section">
        <h2>Achievements <small>{ACHIEVEMENTS.filter((a) => a.got(input)).length} of {ACHIEVEMENTS.length}</small></h2>
        <ul className="biz-achievements">
          {ACHIEVEMENTS.map((a) => {
            const got = a.got(input);
            return (
              <li key={a.id} className={got ? 'got' : ''}>
                <b>{got ? '★ ' : ''}{a.name}</b>
                <span>{a.what}</span>
                {got && earnedAt[a.id] && <small>{new Date(earnedAt[a.id]!).toLocaleDateString()}</small>}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
