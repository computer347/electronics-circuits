import { useEffect, useMemo } from 'react';
import { formatSI } from '../lib/units';
import { LED_VF, type LedColor } from '../sim';
import { colorBands } from './colorCode';
import { hole } from './layout';
import { analyzeBoard, SUPPLY_ID } from './model';
import { connectedGroup } from './move';
import { BreadboardScene } from './Scene';
import { BENCH_PRESETS, useBench, type Tool } from './store';

/** Hide solver leakage (GMIN) below 1 nA. */
const amps = (a: number | undefined) => formatSI(Math.abs(a ?? 0) < 1e-9 ? 0 : Math.abs(a ?? 0), 'A');

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const E12_OHMS = [10, 100, 1000, 10000, 100000].flatMap((d) => E12.map((m) => Number((m * d).toPrecision(2)))).concat(1_000_000);
const WIRE_SWATCHES = ['#e8413c', '#1b1b1b', '#2f6fe0', '#f2c230', '#39c46a', '#e8e8e8', '#ff8a2a'];
const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Select / press', key: '1' },
  { id: 'wire', label: 'Jumper wire', key: '2' },
  { id: 'resistor', label: 'Resistor', key: '3' },
  { id: 'led', label: 'LED', key: '4' },
  { id: 'button', label: 'Push button', key: '5' },
  { id: 'probe', label: 'Multimeter probes', key: '6' },
];

function instruction(tool: Tool, pending: boolean): string {
  switch (tool) {
    case 'select': return 'Click a part to edit it, right-click to move it. Hold a push button to press it. Drag to orbit.';
    case 'probe': return 'Click a hole for the red probe, then another for the black probe.';
    case 'led': return pending ? 'Now click the hole for the cathode (short leg, flat side).' : 'Click the hole for the anode (long leg, +).';
    default: return pending ? 'Click the second hole.' : 'Click the first hole.';
  }
}

function describeStrip(id: string) {
  const h = hole(id);
  if (h.strip.includes('+') || h.strip.includes('-')) return 'the whole rail row is connected';
  const col = h.strip.slice(1);
  return h.strip.startsWith('L') ? `connected to a–e in column ${col}` : `connected to f–j in column ${col}`;
}

export function BenchView() {
  const s = useBench();
  const board = useMemo(() => ({ supply: s.supply, parts: s.parts }), [s.supply, s.parts]);
  const analysis = useMemo(() => analyzeBoard(board), [board]);

  // LEDs that got overloaded stay burnt, like real ones.
  useEffect(() => {
    const fresh = analysis.newlyBurnt.filter((id) => !s.parts.find((p) => p.id === id)?.burnt);
    if (fresh.length) s.markBurnt(fresh);
  }, [analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const t = TOOLS.find((x) => x.key === e.key);
      if (t) s.setTool(t.id);
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selected) s.removeSelected();
      if (e.key === 'Escape') {
        if (s.moving) return s.cancelMove();
        if (s.menu) return s.closeMenu();
        s.setTool('select'); s.select(null);
      }
      if ((e.key === 'm' || e.key === 'M') && s.selected && !s.moving) {
        const p = s.parts.find((x) => x.id === s.selected);
        if (p) s.startMove(p.id, p.h1, e.shiftKey ? 'group' : 'single');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  useEffect(() => {
    if (!s.menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.part-menu')) s.closeMenu(); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [s.menu]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = s.parts.find((p) => p.id === s.selected);
  const menuPart = s.menu ? s.parts.find((p) => p.id === s.menu!.partId) : undefined;
  const groupSize = menuPart ? connectedGroup(s.parts, menuPart.id).length : 0;
  const r = analysis.result;
  const meter = (() => {
    const { red, black } = s.probes;
    if (!red || !black) return { text: '- - -', note: 'Place both probes' };
    const vr = analysis.voltageAt(red);
    const vb = analysis.voltageAt(black);
    if (vr === undefined || vb === undefined || !r.ok) return { text: '0.000', note: 'A probe is on a strip with nothing connected' };
    return { text: (vr - vb).toFixed(3), note: `${hole(red).label} → ${hole(black).label}` };
  })();

  const faults = [
    ...r.faults.filter((f) => f.kind !== 'floating-node'),
    ...analysis.shortedParts.map((id) => ({ kind: 'same-strip', severity: 'warning' as const, message: `${id} has both legs on the same strip, so it's bypassed.` })),
  ];
  const burnt = s.parts.filter((p) => p.burnt);

  return (
    <div className="bench3d">
      <aside className="panel tools">
        <h2>Parts</h2>
        {TOOLS.map((t) => (
          <button key={t.id} className={s.tool === t.id ? 'active' : ''} onClick={() => s.setTool(t.id)}>
            <span className="key">{t.key}</span>{t.label}
          </button>
        ))}
        {s.tool === 'resistor' && (
          <label className="field">Value
            <select value={s.ohms} onChange={(e) => s.setOhms(Number(e.target.value))}>
              {E12_OHMS.map((o) => <option key={o} value={o}>{formatSI(o, 'Ω')}</option>)}
            </select>
          </label>
        )}
        {s.tool === 'led' && (
          <label className="field">Colour
            <select value={s.ledColor} onChange={(e) => s.setLedColor(e.target.value as LedColor)}>
              {(Object.keys(LED_VF) as LedColor[]).map((c) => <option key={c} value={c}>{c} ({LED_VF[c]} V)</option>)}
            </select>
          </label>
        )}

        <h2>Bench supply</h2>
        <div className="supply-row">
          <select value={s.supply.volts} onChange={(e) => s.setVolts(Number(e.target.value))} aria-label="Supply voltage">
            {[3.3, 5, 9, 12].map((v) => <option key={v} value={v}>{v} V</option>)}
          </select>
          <button className={s.supply.on ? 'active' : ''} onClick={s.toggleSupply}>{s.supply.on ? 'ON' : 'OFF'}</button>
        </div>
        <p className="hint">Drives the top rails: red = +, blue = ground.</p>

        <h2>Circuits</h2>
        <div className="presets">
          {Object.keys(BENCH_PRESETS).map((name) => (
            <button key={name} onClick={() => s.load(structuredClone(BENCH_PRESETS[name]!))}>{name}</button>
          ))}
          <button onClick={s.clear}>Clear</button>
        </div>
        <label className="check"><input type="checkbox" checked={s.showStrips} onChange={(e) => s.setShowStrips(e.target.checked)} /> Glow strips by voltage</label>
      </aside>

      <section className="stage" onContextMenu={(e) => e.preventDefault()}>
        <BreadboardScene analysis={analysis} />
        <div className="stage-hud">
          <span className={s.notice ? 'notice' : ''}>{s.notice ?? instruction(s.tool, !!s.pending)}</span>
          {s.hover && (
            <span className="hover-info">
              {hole(s.hover).label} · {describeStrip(s.hover)}
              {analysis.voltageAt(s.hover) !== undefined && r.ok ? ` · ${formatSI(analysis.voltageAt(s.hover)!, 'V')}` : ''}
            </span>
          )}
        </div>
        {s.menu && menuPart && (
          <div className="part-menu" style={{ left: s.menu.x, top: s.menu.y }} role="menu">
            <div className="part-menu-title">{menuPart.id}</div>
            <button role="menuitem" onClick={() => s.startMove(menuPart.id, s.menu!.anchor, 'single')}>Move <kbd>M</kbd></button>
            {groupSize > 1 && (
              <button role="menuitem" onClick={() => s.startMove(menuPart.id, s.menu!.anchor, 'group')}>
                Move with connected parts ({groupSize}) <kbd>⇧M</kbd>
              </button>
            )}
            {menuPart.kind !== 'wire' && (
              <button role="menuitem" onClick={() => { s.flipPart(menuPart.id); s.closeMenu(); }}>
                {menuPart.kind === 'led' ? 'Flip polarity' : 'Swap legs'}
              </button>
            )}
            <button role="menuitem" onClick={() => { s.select(menuPart.id); s.closeMenu(); }}>Edit value…</button>
            <button role="menuitem" className="danger" onClick={() => { s.select(menuPart.id); s.removeSelected(); s.closeMenu(); }}>Delete <kbd>Del</kbd></button>
          </div>
        )}
      </section>

      <aside className="panel readouts">
        <h2>Multimeter · DC V</h2>
        <div className="dmm">
          <div className="dmm-screen">{meter.text}<span>V</span></div>
          <div className="dmm-note">{meter.note}</div>
        </div>

        <h2>Status</h2>
        {faults.length === 0 && burnt.length === 0 ? <p className="ok">● No faults</p> : (
          <ul className="faults">
            {faults.map((f, i) => <li key={i} className={f.severity}>{f.message}</li>)}
            {burnt.map((p) => <li key={p.id} className="error">{p.id} burnt out. Fix the circuit, then replace it.</li>)}
          </ul>
        )}
        {r.ok && s.supply.on && <p className="hint">Supply current: {amps(r.currents[SUPPLY_ID])}</p>}

        {sel && (
          <>
            <h2>{sel.id}</h2>
            <table>
              <tbody>
                <tr><th>Type</th><td className="num">{sel.kind === 'led' ? 'LED' : sel.kind}</td></tr>
                {sel.kind === 'resistor' && (
                  <tr><th>Value</th><td className="num">
                    <select value={sel.ohms} onChange={(e) => s.updatePart(sel.id, { ohms: Number(e.target.value) })} aria-label="Resistance">
                      {E12_OHMS.map((o) => <option key={o} value={o}>{formatSI(o, 'Ω')}</option>)}
                    </select>
                  </td></tr>
                )}
                {sel.kind === 'led' && (
                  <tr><th>Colour</th><td className="num">
                    <select value={sel.color} onChange={(e) => s.updatePart(sel.id, { color: e.target.value as LedColor })} aria-label="LED colour">
                      {(Object.keys(LED_VF) as LedColor[]).map((c) => <option key={c} value={c}>{c} ({LED_VF[c]} V)</option>)}
                    </select>
                  </td></tr>
                )}
                {sel.kind === 'wire' && (
                  <tr><th>Colour</th><td className="num">
                    <span className="swatches">
                      {WIRE_SWATCHES.map((c) => (
                        <button key={c} className={sel.wireColor === c ? 'swatch active' : 'swatch'} style={{ background: c }} aria-label={`Wire colour ${c}`} onClick={() => s.updatePart(sel.id, { wireColor: c })} />
                      ))}
                    </span>
                  </td></tr>
                )}
                {sel.kind === 'resistor' && <tr><th>Bands</th><td className="num">{colorBands(sel.ohms ?? 1000).names.join(' · ')}</td></tr>}
                <tr><th>Legs</th><td className="num">{hole(sel.h1).label} → {hole(sel.h2).label}</td></tr>
                {sel.kind !== 'wire' && r.ok && (
                  <>
                    <tr><th>Current</th><td className="num">{amps(r.currents[sel.id])}</td></tr>
                    <tr><th>Voltage</th><td className="num">{formatSI(Math.abs((analysis.voltageAt(sel.h1) ?? 0) - (analysis.voltageAt(sel.h2) ?? 0)), 'V')}</td></tr>
                    <tr><th>Power</th><td className="num">{formatSI(Math.abs(r.power[sel.id] ?? 0), 'W')}</td></tr>
                  </>
                )}
              </tbody>
            </table>
            <div className="presets" style={{ marginTop: 12 }}>
              {sel.burnt && <button onClick={() => s.replaceLed(sel.id)}>Replace LED</button>}
              <button onClick={() => s.startMove(sel.id, sel.h1, 'single')}>Move (M)</button>
              {sel.kind === 'led' && <button onClick={() => s.flipPart(sel.id)}>Flip</button>}
              <button onClick={s.removeSelected}>Remove (Del)</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
