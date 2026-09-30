/**
 * Story dialogue: one line at a time, typed out. A tap (E, Space or a click) finishes
 * the line; holding E, Space or the mouse button moves on to the next, with a bar that fills
 * while you hold, as in the reference. Holding means a stray tap never skips the story.
 */
import { useEffect, useRef, useState } from 'react';
import { HOLD_TO_CONTINUE_MS, holdProgress, type Line } from './client';

const TYPE_MS = 18;

export function Dialogue({ lines, names, onDone }: { lines: Line[]; names: { client: string; you: string }; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const [held, setHeld] = useState(0);
  const holdStart = useRef<number | null>(null);
  const line = lines[i]!;
  const typing = shown < line.text.length;

  useEffect(() => { setShown(0); }, [i]);
  useEffect(() => {
    if (!typing) return;
    const t = setInterval(() => setShown((n) => Math.min(line.text.length, n + 2)), TYPE_MS);
    return () => clearInterval(t);
  }, [typing, line.text]);

  // A timer finishes the hold (so a slow frame rate can't eat it); frames only draw the bar.
  const timer = useRef<number | null>(null);
  const next = useRef(() => {});
  next.current = () => { if (i + 1 < lines.length) setI(i + 1); else onDone(); };
  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (holdStart.current !== null) setHeld(holdProgress(performance.now() - holdStart.current));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const press = () => {
    if (typing) { setShown(line.text.length); return; }
    if (holdStart.current !== null) return;
    holdStart.current = performance.now();
    timer.current = window.setTimeout(() => { holdStart.current = null; timer.current = null; setHeld(0); next.current(); }, HOLD_TO_CONTINUE_MS);
  };
  const release = () => { holdStart.current = null; setHeld(0); if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  useEffect(() => {
    // E or Space (not Enter: on the desk, Enter is the main button's key).
    const isKey = (e: KeyboardEvent) => e.key === 'e' || e.key === 'E' || e.key === ' ';
    const down = (e: KeyboardEvent) => { if (isKey(e)) { e.preventDefault(); if (!e.repeat) press(); } };
    const up = (e: KeyboardEvent) => { if (isKey(e)) release(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  return (
    <div className={`dialogue ${line.who}`} role="dialog" aria-live="polite" onPointerDown={press} onPointerUp={release} onPointerLeave={release}>
      <p className="dialogue-who">{line.who === 'client' ? names.client : names.you}</p>
      <p className="dialogue-text">{line.text.slice(0, shown)}<span aria-hidden className="dialogue-rest">{line.text.slice(shown)}</span></p>
      <div className="dialogue-foot">
        <span>{i + 1} / {lines.length}</span>
        <span className="dialogue-hold">{typing ? 'Tap to finish the line' : <>Hold <kbd>E</kbd> to continue</>}<i style={{ width: `${Math.round(held * 100)}%` }} /></span>
      </div>
    </div>
  );
}
