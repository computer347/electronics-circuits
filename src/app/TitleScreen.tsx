/**
 * The opening page (design option C, "boot terminal"): the title and a boot log on the left,
 * the modes on the right, an RC charge/discharge trace sweeping along the bottom.
 * Keys: 1–5 open a mode, ↑ ↓ move, Enter opens the highlighted row (Continue to start with).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '../levels/progress';
import { CrtPowerOn } from './Crt';
import { MENU, bootLine, continueTarget, worldStars, type ContinueTarget, type MenuItem } from './menu';

/** RC square-wave response, the same shape the scope shows in level 5. */
function rcTrace(): string {
  const period = 250, tau = 38, lo = 195, hi = 85;
  let v = lo, d = `M0,${lo}`;
  for (let x = 5; x <= 1000; x += 5) {
    const target = Math.floor(x / (period / 2)) % 2 === 0 ? hi : lo;
    v = target + (v - target) * Math.exp(-5 / tau);
    d += ` L${x},${v.toFixed(1)}`;
  }
  return d;
}

export function TitleScreen({ onOpen, onContinue }: {
  onOpen: (item: MenuItem) => void;
  onContinue: (target: ContinueTarget) => void;
}) {
  const records = useProgress((s) => s.levels);
  const stars = worldStars(records);
  const cont = continueTarget(records);
  const trace = useMemo(rcTrace, []);
  // Power cycling remounts the screen, which replays the whole start-up.
  const [boot, setBoot] = useState(0);
  // 0 is Continue; 1..5 are the menu rows.
  const [sel, setSel] = useState(0);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  const openable = [0, ...MENU.map((m, i) => (m.soon ? -1 : i + 1)).filter((i) => i > 0)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const item = MENU.find((m) => m.key === e.key);
      if (item) {
        e.preventDefault();
        if (!item.soon) onOpen(item);
        else setSel(MENU.indexOf(item) + 1);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const at = Math.max(0, openable.indexOf(sel));
        const next = openable[(at + (e.key === 'ArrowDown' ? 1 : openable.length - 1)) % openable.length]!;
        setSel(next);
        rows.current[next]?.focus();
        return;
      }
      if (e.key === 'Enter' && (!t || t === document.body)) {
        e.preventDefault();
        if (sel === 0) onContinue(cont);
        else if (!MENU[sel - 1]!.soon) onOpen(MENU[sel - 1]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const log: [string, string, 'ok' | 'stars'][] = [
    ['power on', 'ok', 'ok'],
    ['MNA solver', 'ok', 'ok'],
    ['phosphor shader', 'ok', 'ok'],
    ['world 0 · foundations', `★ ${stars.got}/${stars.max}`, 'stars'],
  ];

  return (
    <CrtPowerOn key={boot} variant="full" className="title-crt">
      <main className="title" aria-label="SIGNAL PATH">
        <section className="title-left">
          <h1 className="title-word reveal" style={{ animationDelay: '1.3s' }}>SIGNAL<br />PATH</h1>
          <p className="title-tag reveal" style={{ animationDelay: '1.5s' }}>
            You are an electron. Get from the source to the sink, and learn how to build everything in between.
          </p>
          <div className="boot-log" aria-label="Start-up log">
            <span className="reveal" style={{ animationDelay: '1.7s' }}>SIGNAL PATH v0.1 · phase 0</span>
            {log.map(([label, value, kind], i) => (
              <span key={label} className="reveal" style={{ animationDelay: `${1.85 + i * 0.15}s` }}>
                {bootLine(label)} <b className={kind}>{value}</b>
              </span>
            ))}
            <span className="reveal" style={{ animationDelay: '2.45s' }}>&gt; ready <span className="cursor">█</span></span>
          </div>
        </section>

        <nav className="title-menu" aria-label="Main menu">
          <button
            ref={(el) => { rows.current[0] = el; }}
            className={`row row-continue reveal ${sel === 0 ? 'sel' : ''}`}
            style={{ animationDelay: '1.6s' }}
            onClick={() => onContinue(cont)}
            onFocus={() => setSel(0)}
          >
            <span className="row-key">ENTER</span>
            <span className="row-text">
              <span className="row-title">{cont.kind === 'level' && cont.fresh ? 'Start' : 'Continue'}</span>
              <span className="row-sub">{cont.label}</span>
            </span>
            <span className="row-go" aria-hidden>▸</span>
          </button>
          {MENU.map((m, i) => (
            <button
              key={m.key}
              ref={(el) => { rows.current[i + 1] = el; }}
              className={`row reveal ${sel === i + 1 ? 'sel' : ''} ${m.soon ? 'soon' : ''}`}
              style={{ animationDelay: `${1.72 + i * 0.12}s` }}
              aria-disabled={m.soon || undefined}
              onClick={() => !m.soon && onOpen(m)}
              onFocus={() => setSel(i + 1)}
            >
              <span className="row-key">{m.key}</span>
              <span className="row-text">
                <span className="row-title">{m.title}</span>
                <span className="row-sub">{m.sub}</span>
              </span>
              {m.tab === 'play' ? <span className="row-stars">★ {stars.got}/{stars.max}</span>
                : m.soon ? <span className="row-soon">soon</span> : null}
            </button>
          ))}
        </nav>

        <svg className="title-trace" viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden>
          <path d={trace} className="trace" vectorEffect="non-scaling-stroke" />
        </svg>

        <footer className="title-foot reveal" style={{ animationDelay: '2.5s' }}>
          <span>1–5 choose · ↑ ↓ move · Enter open</span>
          <span>Reduced motion follows your system setting</span>
        </footer>

        <button className="power" onClick={() => setBoot((b) => b + 1)} aria-label="Power cycle: replay the start-up" title="Power cycle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 3v9" /><path d="M6.4 6.6a8 8 0 1 0 11.2 0" />
          </svg>
        </button>

        <div className="scanlines" aria-hidden />
        <div className="vignette" aria-hidden />
      </main>
    </CrtPowerOn>
  );
}
