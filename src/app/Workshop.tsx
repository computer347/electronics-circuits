/**
 * The workshop: one test level for each activity the game has besides the breadboard (board
 * repair, wiring, node coding, client jobs) and the Parts Lab. Each card says what the
 * activity is and what you'll learn; the ones not built yet say so.
 */
import { useEffect } from 'react';
import '../desk/desk.css';
import { CODING_JOBS } from '../coding/jobs';
import { REPAIR_JOBS } from '../repair/jobs';
import { WIRING_JOBS } from '../wiring/wiring';

export interface WorkshopCard {
  id: string;
  activity: string;
  title: string;
  /** What you do, in one line. */
  what: string;
  /** Where it opens, or null while it's being built. */
  open: { screen: 'repair' | 'coding' | 'wiring'; job: string } | null;
}

export const WORKSHOP: WorkshopCard[] = [
  ...REPAIR_JOBS.map((j): WorkshopCard => ({ id: j.id, activity: 'Board repair', title: j.title, what: j.goal, open: { screen: 'repair', job: j.id } })),
  ...CODING_JOBS.map((j): WorkshopCard => ({ id: j.id, activity: 'Node coding', title: j.title, what: j.goal, open: { screen: 'coding', job: j.id } })),
  ...WIRING_JOBS.map((j): WorkshopCard => ({ id: j.id, activity: 'Wiring', title: j.title, what: j.goal, open: { screen: 'wiring', job: j.id } })),
  { id: 'job-dead-torch', activity: 'Client job', title: 'The dead torch', what: 'A client’s torch won’t light. Take the job, fix it, get paid.', open: null },
];

export function Workshop({ onOpen, onBack }: { onOpen: (c: WorkshopCard) => void; onBack: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      const n = Number(e.key);
      const c = WORKSHOP[n - 1];
      if (Number.isInteger(n) && c?.open) onOpen(c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen, onBack]);
  return (
    <main className="riso workshop" aria-label="Workshop">
      <button className="desk-back" onClick={onBack}>‹ Menu <kbd>Esc</kbd></button>
      <h1 className="workshop-title">WORKSHOP</h1>
      <p className="riso-tag">One job for each thing you can do at the bench. Pick one.</p>
      <ol className="workshop-cards">
        {WORKSHOP.map((c, i) => (
          <li key={c.id}>
            <button className={c.open ? '' : 'later'} disabled={!c.open} onClick={() => c.open && onOpen(c)}>
              <kbd>{i + 1}</kbd>
              <span className="nb-kicker">{c.activity}</span>
              <b>{c.title}</b>
              <span>{c.what}</span>
              {!c.open && <em>being built</em>}
            </button>
          </li>
        ))}
      </ol>
    </main>
  );
}
