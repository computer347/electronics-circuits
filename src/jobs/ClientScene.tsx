/**
 * A client job, around the desk: the client at the counter telling you what's wrong (intro),
 * a banner with the job and the wall clock while you work, then the client back for their
 * thing (outro) and the pay slip. The fix itself is the desk level.
 */
import { useEffect, useState } from 'react';
import '../desk/desk.css';
import { useDesk } from '../desk/store';
import { clockAt, clockText, payout, type ClientJob } from './client';
import { Dialogue } from './Dialogue';
import { useClient } from './store';
import { useWallet } from './wallet';

/** The client, as a riso print: a head and shoulders in their colour, overprinted. */
function Portrait({ color }: { color: string }) {
  return (
    <svg className="client-portrait" viewBox="0 0 200 220" aria-hidden>
      <rect x="84" y="104" width="32" height="44" fill="#0078bf" style={{ mixBlendMode: 'multiply' }} />
      <path d="M18 220 C 24 132, 176 132, 182 220 Z" fill="#0078bf" style={{ mixBlendMode: 'multiply' }} />
      <circle cx="100" cy="68" r="44" fill={color} style={{ mixBlendMode: 'multiply' }} />
      <circle cx="108" cy="75" r="44" fill="#ffe800" style={{ mixBlendMode: 'multiply' }} opacity="0.55" />
    </svg>
  );
}

/** The thing they brought in: here, a head torch. */
function Torch() {
  return (
    <svg className="client-item" viewBox="0 0 220 90" aria-hidden>
      <path d="M10 45 C 60 5, 160 5, 210 45" fill="none" stroke="#1c0a3a" strokeWidth="8" />
      <rect x="70" y="36" width="80" height="44" rx="8" fill="#ff48b0" style={{ mixBlendMode: 'multiply' }} />
      <circle cx="110" cy="58" r="15" fill="#f1ece1" stroke="#1c0a3a" strokeWidth="4" />
      <circle cx="110" cy="58" r="6" fill="#0078bf" />
    </svg>
  );
}

/** The counter: the client explains, then you take the job. */
export function ClientIntro({ job, onTake, onBack }: { job: ClientJob; onTake: () => void; onBack: () => void }) {
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  return (
    <main className="riso client" aria-label={`Client job: ${job.title}`}>
      <button className="desk-back" onClick={onBack}>‹ Workshop <kbd>Esc</kbd></button>
      <div className="client-clock" aria-label="Workshop clock">{clockText(job.opens)}</div>
      <div className="client-stage">
        <Portrait color={job.client.color} />
        <div className="client-tag"><b>{job.client.name}</b><span>{job.client.about}</span></div>
        <div className="client-counter"><Torch /></div>
      </div>
      {!heard ? (
        <Dialogue lines={job.intro} names={{ client: job.client.name, you: 'You' }} onDone={() => setHeard(true)} />
      ) : (
        <div className="client-take">
          <p className="nb-kicker">Job card</p>
          <h2>{job.title}</h2>
          <p>{job.client.name} will be back at <b>{clockText(job.due)}</b>. Pay: {job.pay.base} + {job.pay.perStar} per ★, and {job.pay.onTime} if it’s ready on time.</p>
          <p className="desk-result-skill"><b>You’ll use this</b>{job.skill} {job.realLife}</p>
          <button className="desk-main" autoFocus onClick={onTake}>Take the job →</button>
        </div>
      )}
    </main>
  );
}

/**
 * Over the desk while a job's on: the banner with the clock; when the level passes, the client
 * comes back (outro) and pays.
 */
export function ClientOverlay({ onFinished }: { onFinished: () => void }) {
  const { job, phase, startedAt, stars, finishedAt } = useClient();
  const result = useDesk((s) => s.result);
  const deskPhase = useDesk((s) => s.phase);
  const [now, setNow] = useState(performance.now());
  useEffect(() => { const t = setInterval(() => setNow(performance.now()), 1000); return () => clearInterval(t); }, []);
  // The fix passing ends the working part: note the stars and the time.
  useEffect(() => {
    if (job && phase === 'working' && result?.check.pass) useClient.getState().fixed(result.stars ?? 1, clockAt(job, performance.now() - startedAt));
  }, [job, phase, result, startedAt]);
  if (!job) return null;
  const clock = clockAt(job, now - startedAt);
  const late = clock > job.due;
  // Wait for the result card to close before the client comes back in.
  const back = phase === 'outro' && deskPhase === 'desk';
  const slip = payout(job, stars, finishedAt);
  return (
    <>
      {phase === 'working' && deskPhase === 'desk' && (
        <div className={`client-banner ${late ? 'late' : ''}`} role="status">
          <b>JOB</b> {job.client.name} · {job.title}
          <span className="client-banner-clock">⏲ {clockText(clock)}</span>
          <span>{late ? 'late: they’re waiting' : `back at ${clockText(job.due)}`}</span>
        </div>
      )}
      {back && (
        <div className="client-back">
          <Dialogue lines={job.outro} names={{ client: job.client.name, you: 'You' }} onDone={() => useClient.getState().pay()} />
        </div>
      )}
      {phase === 'pay' && (
        <div className="desk-result" role="dialog" aria-label="Pay slip">
          <p className="nb-kicker">Paid · {clockText(finishedAt)}</p>
          <h2>{job.client.name} pays up</h2>
          <table className="client-slip"><tbody>
            {slip.lines.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
            <tr className="total"><td>Total</td><td>{slip.total}</td></tr>
          </tbody></table>
          <p className="desk-result-skill"><b>You can now</b>{job.skill.charAt(0).toLowerCase() + job.skill.slice(1)}</p>
          <button className="desk-main" autoFocus onClick={() => { useWallet.getState().earn(job.id, slip.total, stars); onFinished(); }}>Back to the workshop</button>
        </div>
      )}
    </>
  );
}
