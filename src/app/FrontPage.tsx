/**
 * The front page: a landing page printed like a risograph poster (paper, fluoro pink, blue and
 * riso yellow overprinted, a fine grain, Anton + Space Mono). The first screen is the poster
 * with one obvious button (Start playing, or Continue with the level you're on); below it,
 * short sections on how a level works, the two worlds, the workshop and the notebook, then the
 * button again. Keys: Enter starts or continues, 1–4 open Play, Learn, Practice, Workshop.
 */
import { useEffect, type ReactNode } from 'react';
import '../desk/desk.css';
import './landing.css';
import { ALL_LEVELS, levelById, WORLDS } from '../levels';
import { useProgress, worldStars } from '../levels/progress';
import { nextLevel } from '../desk/levelPick';
import { CATALOGUE } from '../parts/catalogue';

export type FrontChoice = 'continue' | 'play' | 'learn' | 'practice' | 'workshop';

const CHOICES: { id: Exclude<FrontChoice, 'continue'>; label: string; key: string }[] = [
  { id: 'play', label: 'Level map', key: '1' },
  { id: 'learn', label: 'Learn', key: '2' },
  { id: 'practice', label: 'Practice', key: '3' },
  { id: 'workshop', label: 'Workshop', key: '4' },
];

const Icon = {
  task: <svg viewBox="0 0 40 40" aria-hidden><rect x="8" y="5" width="24" height="30" fill="#fff" stroke="currentColor" strokeWidth="2.5" /><path d="M13 13h14M13 19h14M13 25h9" stroke="currentColor" strokeWidth="2.5" /></svg>,
  build: <svg viewBox="0 0 40 40" aria-hidden><rect x="4" y="10" width="32" height="20" fill="#fff" stroke="currentColor" strokeWidth="2.5" />{[9, 15, 21, 27, 33].map((x) => <circle key={x} cx={x - 2} cy="16" r="1.6" fill="currentColor" />)}{[9, 15, 21, 27, 33].map((x) => <circle key={`b${x}`} cx={x - 2} cy="24" r="1.6" fill="currentColor" />)}<path d="M7 16 C 12 4, 22 4, 25 16" fill="none" stroke="#ff48b0" strokeWidth="2.5" /></svg>,
  test: <svg viewBox="0 0 40 40" aria-hidden><rect x="10" y="4" width="20" height="32" rx="3" fill="#ffe800" stroke="currentColor" strokeWidth="2.5" /><rect x="14" y="8" width="12" height="7" fill="#c9d4b0" stroke="currentColor" strokeWidth="1.5" /><circle cx="20" cy="25" r="5" fill="#fff" stroke="currentColor" strokeWidth="2" /></svg>,
  walk: <svg viewBox="0 0 40 40" aria-hidden><path d="M4 30 L14 30 L14 12 L28 12 L28 30 L36 30" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="14" cy="21" r="5" fill="#0078bf" /><path d="M20 12 l4 -3 v6z" fill="#ff48b0" /></svg>,
};

function Section({ kicker, title, children, id }: { kicker: string; title: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="landing-section" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <p className="landing-kicker">{kicker}</p>
      <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
      {children}
    </section>
  );
}

export function FrontPage({ onChoose }: { onChoose: (c: FrontChoice) => void }) {
  const records = useProgress((s) => s.levels);
  const started = Object.keys(records).length > 0;
  const next = levelById(nextLevel(records) ?? ALL_LEVELS[0]!.id)!;
  const cta = started ? `Continue · ${next.world}–${next.number} ${next.title}` : 'Start playing';
  const parts = CATALOGUE.length;

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

  const Cta = ({ big }: { big?: boolean }) => (
    <button className={`riso-continue landing-cta ${big ? 'big' : ''}`} onClick={() => onChoose('continue')} autoFocus={!big}>
      {cta} <span aria-hidden>→</span>
    </button>
  );

  return (
    <main className="landing" aria-label="SIGNAL PATH">
      <svg className="riso-grain landing-grain" aria-hidden><filter id="riso-noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" /><feColorMatrix values="0 0 0 0 0.11  0 0 0 0 0.04  0 0 0 0 0.23  0 0 0 0.22 0" /></filter><rect width="100%" height="100%" filter="url(#riso-noise)" /></svg>

      {/* ---------------------------------------------------------------- the poster */}
      <header className="landing-hero">
        <div className="riso-sun" aria-hidden />
        <svg className="riso-wave" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>
          <path d={`M0,100 ${Array.from({ length: 101 }, (_, i) => `L${i * 10},${100 + Math.sin(i / 5) * 70}`).join(' ')}`} />
        </svg>
        <h1 className="riso-title">
          <span className="ink pink">SIGNAL<br />PATH</span>
          <span className="ink blue" aria-hidden>SIGNAL<br />PATH</span>
        </h1>
        <p className="riso-tag landing-tag">Learn electronics on a real-looking lab bench. Build circuits from real parts, measure them like an engineer, then shrink down and walk the path as an electron.</p>
        <div className="riso-actions">
          <Cta />
          <nav className="riso-menu" aria-label="Main menu">
            {CHOICES.map((c) => <button key={c.id} onClick={() => onChoose(c.id)}><kbd>{c.key}</kbd> {c.label}</button>)}
          </nav>
        </div>
        <ul className="landing-facts" aria-label="At a glance">
          <li><b>{ALL_LEVELS.length}</b> levels</li>
          <li><b>{WORLDS.length}</b> worlds</li>
          <li><b>{parts}</b> real parts</li>
          <li><b>Free</b> · works offline</li>
        </ul>
        <a className="landing-down" href="#how">How it works ↓</a>
      </header>

      {/* ---------------------------------------------------------------- how a level works */}
      <Section id="how" kicker="How a level works" title="Four steps, every time">
        <ol className="landing-steps">
          {([
            ['task', 'Read the task', 'A client, a story, a datasheet and a goal with real numbers: “light the LED at 10–25 mA”.'],
            ['build', 'Build it', 'Place resistors, LEDs, switches, transistors and chips on a breadboard that behaves like the real one.'],
            ['test', 'Test it', 'Probe it with the multimeter and the oscilloscope. A real circuit simulator works out every volt and milliamp.'],
            ['walk', 'Walk it', 'Become the electron and travel the loop you built. Faults are blockages you find and clear from the inside.'],
          ] as const).map(([icon, title, text], i) => (
            <li key={icon}>
              <span className="landing-step-n">{i + 1}</span>
              <span className="landing-icon">{Icon[icon]}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------------------------------------------------------- the worlds */}
      <Section id="worlds" kicker="What you’ll learn" title="Two worlds, from first light to state machines">
        <div className="landing-worlds">
          {WORLDS.map((w) => {
            const st = worldStars(records, w.number);
            const topics = [...new Set(w.plan.map((p) => p.topic.replace(/\s*\(.*\)$/, '')))];
            return (
              <article key={w.number} className={`landing-world w${w.number}`}>
                <p className="landing-world-n">World {w.number}</p>
                <h3>{w.name}</h3>
                <p className="landing-world-meta">{w.levels.length} levels · ★ {st.got}/{st.max}</p>
                <ul className="landing-chips">{topics.slice(0, 14).map((t) => <li key={t}>{t}</li>)}{topics.length > 14 && <li>+{topics.length - 14} more</li>}</ul>
                <button className="landing-link" onClick={() => onChoose('play')}>Open the level map →</button>
              </article>
            );
          })}
        </div>
        <p className="landing-note">Nothing is locked behind lessons: every world’s first level is open, and each level says what real-life skill it teaches.</p>
      </Section>

      {/* ---------------------------------------------------------------- the notebook */}
      <Section id="notebook" kicker="The lab book" title="Theory that comes with the job">
        <div className="landing-cols">
          <div><h3>Task</h3><p>The brief, the datasheet and one good tip, in plain sentences.</p></div>
          <div><h3>Theory</h3><p>Every idea twice: the technical explanation, and the same thing in plain words. Live labs to poke at, and a quick check.</p></div>
          <div><h3>Math</h3><p>The formulas, worked examples step by step, and practice questions whose answers come from the simulator.</p></div>
        </div>
        <button className="landing-link" onClick={() => onChoose('learn')}>Open the theory →</button>
      </Section>

      {/* ---------------------------------------------------------------- the workshop */}
      <Section id="workshop" kicker="The workshop" title="Real boards, real jobs">
        <ul className="landing-jobs">
          <li><b>Repair</b> a dead Arduino Uno with the meter and the iron.</li>
          <li><b>Code</b> a blink, an uptime clock or a status screen on a real OLED, in nodes that write real Arduino code.</li>
          <li><b>Wire</b> sensors and screens to the board, and prove they answer with an I²C scanner.</li>
          <li><b>Identify</b> {parts} parts in the Parts Lab, from a resistor’s bands to a TSOP flash chip.</li>
        </ul>
        <button className="landing-link" onClick={() => onChoose('workshop')}>Go to the workshop →</button>
      </Section>

      {/* ---------------------------------------------------------------- the button again */}
      <footer className="landing-end">
        <p className="landing-end-line">You are an electron. Build the path, then walk it.</p>
        <Cta big />
        <p className="landing-small">Enter to {started ? 'continue' : 'start'} · 1–4 for the menu · Install it from your browser to play offline</p>
      </footer>
    </main>
  );
}
