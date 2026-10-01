/**
 * The front page: a landing page that looks like the game. The first screen is the lab bench
 * itself (a capture of the desk under the lamp) with the title and one obvious button (Start
 * playing, or Continue with the level you're on). Below it, sections laid on the game's own
 * surfaces: the four steps of a level on the green cutting mat, the two worlds on the cork
 * board, the lab book on notebook paper, the workshop and career on the dark bench, then the
 * button again. Keys: Enter starts or continues, 1–5 open the menu.
 */
import { useEffect, type ReactNode } from 'react';
import '../desk/desk.css';
import './landing.css';
import { ALL_LEVELS, levelById, WORLDS } from '../levels';
import { useProgress, worldStars } from '../levels/progress';
import { nextLevel } from '../desk/levelPick';
import { CATALOGUE } from '../parts/catalogue';

export type FrontChoice = 'continue' | 'play' | 'learn' | 'practice' | 'workshop' | 'career';

const CHOICES: { id: Exclude<FrontChoice, 'continue'>; label: string; key: string }[] = [
  { id: 'play', label: 'Level map', key: '1' },
  { id: 'learn', label: 'Learn', key: '2' },
  { id: 'practice', label: 'Practice', key: '3' },
  { id: 'workshop', label: 'Workshop', key: '4' },
  { id: 'career', label: 'Career', key: '5' },
];

const STEPS = [
  { img: 'notebook', title: 'Read the task', text: 'Open the lab book: the client’s story, a datasheet and a goal with real numbers, plus the theory in technical and plain words.' },
  { img: 'board', title: 'Build it', text: 'Place resistors, LEDs, switches, transistors and chips on a breadboard that behaves like the real one, legs, strips and all.' },
  { img: 'meter', title: 'Test it', text: 'Probe with the multimeter and the scope. A real circuit simulator works out every volt and milliamp.' },
  { img: 'walk', title: 'Walk it', text: 'Shrink down and travel the loop you built as an electron. Voltage is height: climb at the battery, roll down through the parts.' },
] as const;

/** A readout like the multimeter's LCD. */
const Lcd = ({ value, unit }: { value: ReactNode; unit: string }) => (
  <span className="lp-lcd"><b>{value}</b><small>{unit}</small></span>
);

export function FrontPage({ onChoose }: { onChoose: (c: FrontChoice) => void }) {
  const records = useProgress((s) => s.levels);
  const started = Object.keys(records).length > 0;
  const next = levelById(nextLevel(records) ?? ALL_LEVELS[0]!.id)!;
  const cta = started ? `Continue · ${next.world}–${next.number} ${next.title}` : 'Start playing';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); onChoose('continue'); }
      const c = CHOICES.find((x) => x.key === e.key);
      if (c) onChoose(c.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChoose]);

  const Cta = ({ end }: { end?: boolean }) => (
    <button className={`desk-main lp-cta ${end ? 'end' : ''}`} onClick={() => onChoose('continue')} autoFocus={!end}>
      {cta} <span aria-hidden>→</span>
    </button>
  );

  return (
    <main className="lp" aria-label="SIGNAL PATH">
      {/* ---------------------------------------------------------------- the bench */}
      <header className="lp-hero">
        <picture className="lp-hero-img" aria-hidden>
          <source media="(max-width: 900px)" srcSet="/landing/desk-960.webp" />
          <img src="/landing/desk-1920.webp" alt="" fetchPriority="high" />
        </picture>
        <div className="lp-hero-text">
          <p className="lp-kicker">A lab-bench game about electronics</p>
          <h1 className="lp-title"><span>SIGNAL</span><span>PATH</span></h1>
          <p className="lp-tag">Build real circuits on a real-looking bench, measure them like an engineer, then shrink down and walk the path as an electron.</p>
          <Cta />
          <nav className="lp-menu" aria-label="Main menu">
            {CHOICES.map((c) => <button key={c.id} onClick={() => onChoose(c.id)}><kbd>{c.key}</kbd> {c.label}</button>)}
          </nav>
          <div className="lp-readouts" aria-label="At a glance">
            <Lcd value={ALL_LEVELS.length} unit="levels" />
            <Lcd value={CATALOGUE.length} unit="real parts" />
            <Lcd value="0.00" unit="€ · free" />
          </div>
        </div>
        <a className="lp-down" href="#how">How it plays ↓</a>
      </header>

      {/* ---------------------------------------------------------------- on the cutting mat */}
      <section id="how" className="lp-mat" aria-labelledby="how-h">
        <div className="lp-inner">
          <p className="lp-kicker">How a level works</p>
          <h2 id="how-h">Four steps on the bench</h2>
          <ol className="lp-steps">
            {STEPS.map((s, i) => (
              <li key={s.img}>
                <img src={`/landing/${s.img}.webp`} alt="" loading="lazy" width={960} height={540} />
                <div><span className="lp-step-n">{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- on the cork board */}
      <section className="lp-cork" aria-labelledby="worlds-h">
        <div className="lp-inner">
          <p className="lp-kicker light">What you’ll learn</p>
          <h2 id="worlds-h" className="light">Two worlds, pinned to the board</h2>
          <div className="lp-worlds">
            {WORLDS.map((w, i) => {
              const st = worldStars(records, w.number);
              const topics = [...new Set(w.plan.map((p) => p.topic.replace(/\s*\(.*\)$/, '')))];
              return (
                <article key={w.number} className="lp-card" style={{ rotate: `${i ? 0.8 : -0.8}deg` }}>
                  <i className="lp-pin" aria-hidden />
                  <p className="lp-card-tab">World {w.number}</p>
                  <h3>{w.name}</h3>
                  <p className="lp-card-meta">{w.levels.length} levels · ★ {st.got}/{st.max}</p>
                  <p className="lp-card-topics">{topics.slice(0, 12).join(' · ')}{topics.length > 12 ? ` · and ${topics.length - 12} more` : ''}</p>
                  <button className="lp-link" onClick={() => onChoose('play')}>Open the level map →</button>
                </article>
              );
            })}
            <figure className="lp-photo" style={{ rotate: '1.4deg' }}>
              <i className="lp-pin" aria-hidden />
              <img src="/landing/map.webp" alt="The level map: a cork board of level cards in the game" loading="lazy" width={960} height={540} />
              <figcaption>Every world’s first level is open. Nothing is locked behind lessons.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- the lab book */}
      <section className="lp-book" aria-labelledby="book-h">
        <div className="lp-inner lp-spread">
          <div className="lp-page left">
            <p className="lp-kicker">The lab book</p>
            <h2 id="book-h">Theory that comes with the job</h2>
            <dl className="lp-tabs">
              <dt>Task</dt><dd>The brief, the datasheet and one good tip.</dd>
              <dt>Theory</dt><dd>Every idea twice: the technical explanation, and the same thing in plain words. Live labs to poke at.</dd>
              <dt>Math</dt><dd>Formulas, worked examples step by step, and practice questions checked against the simulator.</dd>
            </dl>
            <p className="lp-plain"><b>In plain words</b> Every light you add takes its own share. The supply has to feed all of them at once, so the total is what counts.</p>
            <button className="lp-link" onClick={() => onChoose('learn')}>Open the theory →</button>
          </div>
          <div className="lp-page right">
            <img src="/landing/notebook.webp" alt="A theory spread in the game’s lab book" loading="lazy" width={960} height={661} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- the dark bench: workshop and career */}
      <section className="lp-bench" aria-labelledby="shop-h">
        <div className="lp-inner">
          <p className="lp-kicker">The workshop</p>
          <h2 id="shop-h">Real boards, real jobs, real money</h2>
          <ul className="lp-jobs">
            <li><b>Repair</b> a dead Arduino Uno with the meter and the iron.</li>
            <li><b>Code</b> blinks, clocks and status screens on a real OLED, in nodes that write real Arduino code.</li>
            <li><b>Wire</b> sensors and screens to the board, and prove they answer with an I²C scanner.</li>
            <li><b>Grow</b> the business: every job pays for its parts and your time. Save up for the scope, the logic kit, the soldering station.</li>
          </ul>
          <ol className="lp-ranks" aria-label="Career ranks">
            {['Hobbyist', 'Apprentice', 'Technician', 'Engineer', 'Senior Engineer', 'Master Engineer'].map((r) => <li key={r}>{r}</li>)}
          </ol>
          <p className="lp-note">Training earns eleven certificates; jobs earn credits and reputation; six ranks to your own lab.</p>
          <div className="lp-row">
            <button className="lp-link light" onClick={() => onChoose('workshop')}>Go to the workshop →</button>
            <button className="lp-link light" onClick={() => onChoose('career')}>See your career →</button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- under the lamp */}
      <footer className="lp-end">
        <p className="lp-end-line">You are an electron.<br />Build the path, then walk it.</p>
        <Cta end />
        <p className="lp-small">Enter to {started ? 'continue' : 'start'} · 1–5 for the menu · Install it from your browser to play offline</p>
      </footer>
    </main>
  );
}
