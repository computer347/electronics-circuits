/**
 * The front page, as a risograph poster: paper, fluoro pink, blue and riso yellow overprinted
 * (multiply), a fine grain, Anton + Space Mono. One big Continue (to the desk), then three
 * choices only: Play, Learn, Practice. Keys: Enter continues, 1–3 open the others.
 */
import { useEffect } from 'react';
import '../desk/desk.css';
import { useProgress } from '../levels/progress';
import { worldStars } from './menu';

export type FrontChoice = 'continue' | 'play' | 'learn' | 'practice';

const CHOICES: { id: Exclude<FrontChoice, 'continue'>; label: string; key: string }[] = [
  { id: 'play', label: 'Play', key: '1' },
  { id: 'learn', label: 'Learn', key: '2' },
  { id: 'practice', label: 'Practice', key: '3' },
];

export function FrontPage({ onChoose }: { onChoose: (c: FrontChoice) => void }) {
  const stars = worldStars(useProgress((s) => s.levels));
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

  return (
    <main className="riso" aria-label="SIGNAL PATH">
      <svg className="riso-grain" aria-hidden><filter id="riso-noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" /><feColorMatrix values="0 0 0 0 0.11  0 0 0 0 0.04  0 0 0 0 0.23  0 0 0 0.22 0" /></filter><rect width="100%" height="100%" filter="url(#riso-noise)" /></svg>
      <div className="riso-sun" aria-hidden />
      <svg className="riso-wave" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>
        <path d={`M0,100 ${Array.from({ length: 101 }, (_, i) => `L${i * 10},${100 + Math.sin(i / 5) * 70}`).join(' ')}`} />
      </svg>
      <h1 className="riso-title">
        <span className="ink pink">SIGNAL<br />PATH</span>
        <span className="ink blue" aria-hidden>SIGNAL<br />PATH</span>
      </h1>
      <p className="riso-tag">You are an electron. Build the path, then walk it.</p>
      <div className="riso-actions">
        <button className="riso-continue" autoFocus onClick={() => onChoose('continue')}>Continue <span aria-hidden>→</span></button>
        <nav className="riso-menu" aria-label="Main menu">
          {CHOICES.map((c) => (
            <button key={c.id} onClick={() => onChoose(c.id)}><kbd>{c.key}</kbd> {c.label}</button>
          ))}
        </nav>
      </div>
      <p className="riso-foot">World 0 · Foundations · ★ {stars.got}/{stars.max}</p>
    </main>
  );
}
