/**
 * Dev tool (with ?unlock): a list of every level, grouped by world, to jump straight to one.
 * The corkboard opens every card too.
 */
import { WORLDS } from '../levels';

export function DevLevelJump({ current, onPick }: { current: string | null; onPick: (id: string) => void }) {
  return (
    <label className="dev-jump">
      <span>DEV · all levels open</span>
      <select value={current ?? ''} onChange={(e) => e.target.value && onPick(e.target.value)}>
        <option value="">Jump to a level…</option>
        {WORLDS.map((w) => (
          <optgroup key={w.number} label={`World ${w.number} · ${w.name}`}>
            {w.levels.map((l) => <option key={l.id} value={l.id}>{w.number}–{l.number} {l.title}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
