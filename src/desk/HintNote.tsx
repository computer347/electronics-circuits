/**
 * Hints on the desk: a quiet "Hint" link by the level name. The first one asks before it
 * costs you the second star; after that each hint lands on a yellow sticky note, one at a time.
 * Spare LEDs sit next to it when the level rations them.
 */
import { useState } from 'react';
import { useBench } from '../breadboard/store';
import { useSession } from '../levels/session';
import type { LevelDef } from '../levels/types';

export function HintNote({ level }: { level: LevelDef }) {
  const shown = useSession((s) => s.hintsShown);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const left = level.hints.length - shown;

  const reveal = () => { useSession.getState().showHint(); setAsking(false); setOpen(true); };
  const onLink = () => {
    if (shown === 0) { setAsking(true); setOpen(true); return; }
    setOpen((o) => !o);
  };

  return (
    <div className="hint-note-wrap">
      <button className="desk-tour-btn" onClick={onLink} aria-expanded={open}>Hint · {shown}/{level.hints.length}</button>
      {open && (
        <div className="hint-note" role="note">
          {asking ? (
            <>
              <p><b>A hint costs the second star.</b> The first star is still yours if the circuit works.</p>
              <div className="nb-row">
                <button className="nb-button" onClick={reveal}>Show a hint</button>
                <button className="nb-link" onClick={() => { setAsking(false); setOpen(false); }}>Not now</button>
              </div>
            </>
          ) : (
            <>
              <ol>{level.hints.slice(0, shown).map((h, i) => <li key={i}>{h}</li>)}</ol>
              <div className="nb-row">
                {left > 0 && <button className="nb-link" onClick={reveal}>Next hint</button>}
                <button className="nb-link" onClick={() => setOpen(false)}>Put it away</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "Spare LEDs ●●" when the level rations them; empty when it doesn't. */
export function SpareLeds() {
  const spares = useBench((s) => s.spares);
  if (spares === null) return null;
  return (
    <span className="spares" title="Each burnt LED costs a spare">
      Spare LEDs {spares ? Array.from({ length: spares }, (_, i) => <i key={i} />) : <b>none left</b>}
    </span>
  );
}
