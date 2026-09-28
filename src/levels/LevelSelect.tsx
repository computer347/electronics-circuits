/** The World 0 map: five levels on one trace, lit up as you pass them. */
import { WORLD0, WORLD0_PLAN } from '.';
import { useProgress } from './progress';
import { Stars } from './LevelView';

export function LevelSelect({ onPlay }: { onPlay: (id: string) => void }) {
  const records = useProgress((s) => s.levels);
  const total = WORLD0.reduce((n, l) => n + (records[l.id]?.stars ?? 0), 0);

  return (
    <main className="world">
      <header className="world-head">
        <div>
          <div className="level-kicker">World 0</div>
          <h2 className="world-title">Foundations</h2>
          <p className="world-sub">Voltage, current and resistance, one part at a time. Every circuit here is really simulated: if it would burn on a real bench, it burns here.</p>
        </div>
        <div className="world-score"><Stars n={0} size="sm" /> <b>{total}</b> / {WORLD0_PLAN.length * 3}</div>
      </header>

      <ol className="world-map">
        {WORLD0_PLAN.map((slot, i) => {
          const level = WORLD0.find((l) => l.number === slot.number);
          const rec = level ? records[level.id] : undefined;
          // A level opens once the one before it is passed (level 1 is always open).
          const prev = i === 0 ? null : WORLD0.find((l) => l.number === slot.number - 1);
          const open = !!level && (i === 0 || (!!prev && !!records[prev.id]));
          const state = rec ? 'done' : open ? 'open' : level ? 'locked' : 'soon';
          return (
            <li key={slot.number} className={`node ${state}`}>
              <span className="node-dot" aria-hidden />
              <button className="node-card" disabled={!open} onClick={() => level && onPlay(level.id)}>
                <span className="node-num">0–{slot.number}</span>
                <span className="node-title">{slot.title}</span>
                <span className="node-topic">{slot.topic}</span>
                <span className="node-state">
                  {rec ? <><Stars n={rec.stars} size="sm" /> best {Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, '0')}</>
                    : open ? 'Play →' : level ? 'Pass the level before' : 'Coming soon'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="hint world-foot">★ meet the spec · ★★ no hints, nothing burnt · ★★★ within par</p>
    </main>
  );
}
