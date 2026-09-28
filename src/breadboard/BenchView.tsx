import { useEffect, useMemo, type ReactNode } from 'react';
import { formatSI } from '../lib/units';
import { ScopePanel } from '../instruments/ScopePanel';
import { useScope } from '../instruments/scopeStore';
import { DIODE_KEY, LED_VF, type LedColor, type SolveResult, type Waveform, type WaveShape } from '../sim';
import { colorBands } from './colorCode';
import { hole } from './layout';
import { sourceColors } from './flow';
import { startLiveBench, useLive } from './live';
import { lapText } from './rideStops';
import { analyzeBoard, DEFAULT_WAVE, isDynamicBoard, isElectrolytic, LED_MAX_AMPS, reversedElectrolytics, SUPPLY_ID, type BoardAnalysis } from './model';
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
  { id: 'battery', label: 'Battery', key: '6' },
  { id: 'probe', label: 'Multimeter probes', key: '7' },
  { id: 'capacitor', label: 'Capacitor', key: '8' },
  { id: 'generator', label: 'Function generator', key: '9' },
  { id: 'scope', label: 'Scope probes', key: '0' },
];
const BATTERY_VOLTS = [1.5, 3, 4.5, 6, 9];
const CAP_VALUES = [1e-9, 2.2e-9, 4.7e-9, 10e-9, 22e-9, 47e-9, 100e-9, 220e-9, 470e-9, 1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6, 47e-6, 100e-6, 220e-6, 470e-6, 1000e-6];
const FREQS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const VPPS = [0.5, 1, 2, 3.3, 5, 9, 10];
const SHAPES: WaveShape[] = ['square', 'sine', 'triangle'];
/** Capacitors are labelled in nF and µF, never mF (a "1000 µF" can, not "1 mF"). */
const fmtCap = (f: number) => (f >= 1e-6 ? `${Number((f * 1e6).toPrecision(3))} µF` : formatSI(f, 'F'));

/** Shape, frequency, amplitude and offset of a function generator. */
function WaveEditor({ wave, onChange }: { wave: Waveform; onChange: (w: Waveform) => void }) {
  return (
    <div className="wave-editor">
      <label className="field">Shape
        <select value={wave.shape} onChange={(e) => onChange({ ...wave, shape: e.target.value as WaveShape })}>
          {SHAPES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <label className="field">Frequency
        <select value={wave.freq} onChange={(e) => onChange({ ...wave, freq: Number(e.target.value) })}>
          {FREQS.map((f) => <option key={f} value={f}>{formatSI(f, 'Hz')}</option>)}
        </select>
      </label>
      <label className="field">Amplitude
        <select value={wave.vpp} onChange={(e) => onChange({ ...wave, vpp: Number(e.target.value) })}>
          {VPPS.map((v) => <option key={v} value={v}>{v} Vpp</option>)}
        </select>
      </label>
      <label className="field">Offset
        <input type="number" step={0.5} min={-10} max={10} value={wave.offset} onChange={(e) => onChange({ ...wave, offset: Number(e.target.value) })} />
      </label>
    </div>
  );
}

const keyLabel = (k: string) => (k === SUPPLY_ID ? 'Bench supply' : k === DIODE_KEY ? 'LED/diode drops' : k);

/** Stacked breakdown of a value by source (superposition). */
function Breakdown({ parts, unit, colors }: { parts: Record<string, number>; unit: string; colors: Record<string, string> }) {
  const entries = Object.entries(parts).filter(([, v]) => Math.abs(v) > 1e-9);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, v]) => s + Math.abs(v), 0);
  return (
    <div className="breakdown">
      <div className="breakdown-bar">
        {entries.map(([k, v]) => (
          <span key={k} style={{ width: `${(Math.abs(v) / total) * 100}%`, background: colors[k] ?? '#7fa892', opacity: v < 0 ? 0.45 : 1 }} />
        ))}
      </div>
      {entries.map(([k, v]) => (
        <div key={k} className="breakdown-row">
          <span><i style={{ background: colors[k] ?? '#7fa892' }} />{keyLabel(k)}</span>
          <span>{v > 0 ? '+' : '−'}{formatSI(Math.abs(v), unit)}</span>
        </div>
      ))}
    </div>
  );
}

function voltageParts(a: BoardAnalysis, h1: string, h2: string): Record<string, number> {
  const c = a.contributions;
  if (!c) return {};
  const v1 = c.voltages[a.nodeOf(h1)] ?? {}, v2 = c.voltages[a.nodeOf(h2)] ?? {};
  return Object.fromEntries(c.keys.map((k) => [k, (v1[k] ?? 0) - (v2[k] ?? 0)]));
}

function instruction(tool: Tool, pending: boolean): string {
  switch (tool) {
    case 'select': return 'Click a part to edit it, right-click to move it. Hold a push button to press it. Drag to orbit.';
    case 'probe': return 'Click a hole for the red probe, then one for the black. After that, clicks move the red probe; click a probe to lift it off.';
    case 'battery': return pending ? 'Now click the hole for the − terminal.' : 'Click the hole for the + terminal.';
    case 'capacitor': return pending ? 'Now the second leg (the − leg, by the stripe, for electrolytics).' : 'Click the first leg (the + leg for electrolytics, 1 µF and up).';
    case 'generator': return pending ? 'Now the COM clip (usually ground).' : 'Click the hole for the signal lead.';
    case 'scope': return 'Click a hole to clip on CH1, then CH2. Click a probe again to take it off. Ground is the blue rail.';
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

/** Level mode: which tools the player gets, and the level's own panel and overlay. */
export interface BenchMode {
  tools: Tool[];
  resistorValues?: number[];
  /** Shown at the top of the left panel (the brief). */
  panel: ReactNode;
  /** Shown right under the parts, so the Check button is never far away. */
  actions?: ReactNode;
  /** Shown at the top of the right panel (story, datasheet, hints). */
  side?: ReactNode;
  /** Extra buttons on the ride's stop cards (e.g. "Finish level" once it's passed). */
  rideExtra?: ReactNode;
  /** Shown over the 3D stage (the result card). */
  overlay?: ReactNode;
}

export function BenchView({ mode }: { mode?: BenchMode } = {}) {
  const s = useBench();
  const tools = mode ? TOOLS.filter((t) => t.id === 'select' || mode.tools.includes(t.id)) : TOOLS;
  const ohmsList = mode?.resistorValues ?? E12_OHMS;
  const scopeAllowed = !mode || mode.tools.includes('scope');
  const board = useMemo(() => ({ supply: s.supply, parts: s.parts }), [s.supply, s.parts]);
  const analysis = useMemo(() => analyzeBoard(board), [board]);
  const dynamic = isDynamicBoard(board);
  const live = useLive();
  const scopeApply = useScope((x) => x.apply);

  // The transient simulation runs while the bench is open.
  useEffect(() => startLiveBench(), []);

  // LEDs that got overloaded stay burnt, like real ones. On a changing board it's the peak that counts.
  useEffect(() => {
    if (dynamic) return;
    const fresh = analysis.newlyBurnt.filter((id) => !s.parts.find((p) => p.id === id)?.burnt);
    if (fresh.length) s.markBurnt(fresh);
  }, [analysis]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dynamic || !live.result?.ok) return;
    const over = Object.entries(live.peakCurrents).filter(([, a]) => a > LED_MAX_AMPS).map(([id]) => id);
    const reverse = live.result.faults.filter((f) => f.kind === 'reverse-overvoltage' && f.component).map((f) => f.component!);
    const fresh = [...over, ...reverse].filter((id) => { const p = s.parts.find((x) => x.id === id); return p?.kind === 'led' && !p.burnt; });
    if (fresh.length) s.markBurnt([...new Set(fresh)]);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The result the readouts show: live transient on a changing board, DC otherwise. */
  const shown: SolveResult = dynamic && live.result ? live.result : analysis.result;
  const voltAt = (h: string) => (shown.ok ? shown.nodeVoltages[analysis.nodeOf(h)] : undefined);
  const partAmps = (id: string) => (dynamic ? live.avgCurrents[id] : shown.currents[id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') return s.setView(s.view === 'flow' ? 'build' : 'flow');
      if (e.key === 'r' || e.key === 'R') return s.setView(s.view === 'ride' ? 'build' : 'ride');
      if ((e.key === 'o' || e.key === 'O') && scopeAllowed) return s.setScopeOpen(!s.scopeOpen);
      if (e.key === 'Escape' && s.view === 'ride') return s.setView('flow');
      if (s.view === 'ride' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); return s.rideContinue(); }
      if (s.view === 'ride' && (e.key === 'a' || e.key === 'A')) return s.setRideStep(!s.rideStep);
      if (s.view === 'ride') return;
      const t = tools.find((x) => x.key === e.key);
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
  }, [s, tools, scopeAllowed]);

  useEffect(() => {
    if (!s.menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.part-menu')) s.closeMenu(); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [s.menu]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = s.parts.find((p) => p.id === s.selected);
  const selLocked = !!sel && s.locked.includes(sel.id);
  const menuPart = s.menu ? s.parts.find((p) => p.id === s.menu!.partId) : undefined;
  const menuLocked = !!menuPart && s.locked.includes(menuPart.id);
  const menuPinned = !!menuPart && s.pinned.includes(menuPart.id);
  const selPinned = !!sel && s.pinned.includes(sel.id);
  const groupSize = menuPart ? connectedGroup(s.parts, menuPart.id).length : 0;
  const r = shown;
  const meter = (() => {
    const { red, black } = s.probes;
    if (!red || !black) return { text: '- - -', note: 'Place both probes' };
    const vr = voltAt(red);
    const vb = voltAt(black);
    if (vr === undefined || vb === undefined || !r.ok) return { text: '0.000', note: 'A probe is on a strip with nothing connected' };
    return { text: (vr - vb).toFixed(3), note: `${hole(red).label} → ${hole(black).label}` };
  })();

  const colors = sourceColors(board);
  const sourceKeys = analysis.contributions?.keys.filter((k) => k !== DIODE_KEY) ?? [];
  const reversed = reversedElectrolytics(board, analysis.nodeOf, r);
  const faults = [
    ...r.faults.filter((f) => f.kind !== 'floating-node' && !(dynamic && f.kind === 'overcurrent')),
    ...reversed.map((id) => ({ kind: 'reversed-cap', severity: 'warning' as const, message: `${id} is an electrolytic in backwards: its − leg is more positive. Real ones bulge and leak. Swap its legs.` })),
    ...analysis.shortedParts.map((id) => ({ kind: 'same-strip', severity: 'warning' as const, message: `${id} has both legs on the same strip, so it's bypassed.` })),
  ];
  const burnt = s.parts.filter((p) => p.burnt);

  return (
    <div className={mode ? 'bench3d level' : 'bench3d'}>
      <aside className={mode ? 'panel tools compact' : 'panel tools'}>
        {mode?.panel}
        <h2>Parts</h2>
        <div className="tool-list">
          {tools.map((t) => (
            <button key={t.id} className={s.tool === t.id ? 'active' : ''} onClick={() => s.setTool(t.id)}>
              <span className="key">{t.key}</span>{t.label}
            </button>
          ))}
        </div>
        {s.tool === 'resistor' && (
          <label className="field">Value
            <select value={s.ohms} onChange={(e) => s.setOhms(Number(e.target.value))}>
              {ohmsList.map((o) => <option key={o} value={o}>{formatSI(o, 'Ω')}</option>)}
            </select>
          </label>
        )}
        {s.tool === 'battery' && (
          <label className="field">Voltage
            <select value={s.batteryVolts} onChange={(e) => s.setBatteryVolts(Number(e.target.value))}>
              {BATTERY_VOLTS.map((v) => <option key={v} value={v}>{v} V</option>)}
            </select>
          </label>
        )}
        {s.tool === 'capacitor' && (
          <label className="field">Value
            <select value={s.farads} onChange={(e) => s.setFarads(Number(e.target.value))}>
              {CAP_VALUES.map((f) => <option key={f} value={f}>{fmtCap(f)}{f >= 1e-6 ? ' (electrolytic)' : ''}</option>)}
            </select>
          </label>
        )}
        {s.tool === 'generator' && <WaveEditor wave={s.wave} onChange={s.setWave} />}
        {mode?.actions}
        {s.tool === 'led' && (
          <label className="field">Colour
            <select value={s.ledColor} onChange={(e) => s.setLedColor(e.target.value as LedColor)}>
              {(Object.keys(LED_VF) as LedColor[]).map((c) => <option key={c} value={c}>{c} ({LED_VF[c]} V)</option>)}
            </select>
          </label>
        )}

        <h2>View</h2>
        <div className="presets">
          <button className={s.view === 'build' ? 'active' : ''} onClick={() => s.setView('build')}>Build</button>
          <button className={s.view === 'flow' ? 'active' : ''} onClick={() => s.setView('flow')}>Flow <kbd>F</kbd></button>
          <button className={s.view === 'ride' ? 'active' : ''} onClick={() => s.setView('ride')}>Ride <kbd>R</kbd></button>
        </div>
        {s.view !== 'build' && (
          <label className="check"><input type="checkbox" checked={s.conventional} onChange={s.toggleConventional} /> Conventional current (+ → −)</label>
        )}
        {s.view === 'ride' && (
          <label className="check"><input type="checkbox" checked={s.rideStep} onChange={(e) => s.setRideStep(e.target.checked)} /> Stop at each part <kbd>A</kbd></label>
        )}
        {s.view !== 'build' && dynamic && <p className="hint">Flow shows the steady DC picture: capacitors count as open, generators sit at their t = 0 value.</p>}
        {scopeAllowed && (
          <div className="presets">
            <button className={s.scopeOpen ? 'active' : ''} onClick={() => s.setScopeOpen(!s.scopeOpen)}>Oscilloscope <kbd>O</kbd></button>
          </div>
        )}

        {!mode && <>
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
            <button key={name} onClick={() => {
              const p = structuredClone(BENCH_PRESETS[name]!);
              s.load(p);
              if (p.scopeSetup) scopeApply(p.scopeSetup);
            }}>{name}</button>
          ))}
          <button onClick={s.clear}>Clear</button>
        </div>
        </>}
        <label className="check"><input type="checkbox" checked={s.showStrips} onChange={(e) => s.setShowStrips(e.target.checked)} /> Glow strips by voltage</label>
      </aside>

      <div className="stage-col">
      <section className="stage" onContextMenu={(e) => e.preventDefault()}>
        <BreadboardScene analysis={analysis} dynamic={dynamic} />
        {mode?.overlay}
        {s.view !== 'build' && sourceKeys.length > 0 && (
          <div className="legend">
            <span className="legend-title">{s.conventional ? 'Conventional current' : 'Electron flow'} by source</span>
            {sourceKeys.map((k) => <span key={k}><i style={{ background: colors[k] }} />{keyLabel(k)}</span>)}
          </div>
        )}
        {s.view === 'ride' && s.rideStop && (
          <div className="ride-stop" role="dialog" aria-label="Ride stop">
            <div className="ride-stop-kicker">{s.rideStop.kicker}</div>
            <div className="ride-title">{s.rideStop.title}</div>
            <p className="ride-stop-body">{s.rideStop.body}</p>
            <table className="ride-stop-figures"><tbody>
              {s.rideStop.figures.map(([k, v]) => <tr key={k}><th>{k}</th><td className="num">{v}</td></tr>)}
            </tbody></table>
            {s.rideStop.lap && (
              <div className="ride-lap">
                <div className="ride-stop-kicker">Lap complete</div>
                {lapText(s.rideStop.lap)}
              </div>
            )}
            <div className="ride-stop-actions">
              <button className="primary" onClick={s.rideContinue} autoFocus>Go ▶ <kbd>Space</kbd></button>
              <button onClick={() => s.setRideStep(false)}>Ride without stops <kbd>A</kbd></button>
              {mode?.rideExtra}
            </div>
          </div>
        )}
        {s.view === 'ride' && !s.rideStop && mode?.rideExtra && <div className="ride-extra">{mode.rideExtra}</div>}
        {s.view === 'ride' && !s.rideStop && s.rideInfo && (
          <div className="ride-hud">
            <div className="ride-title">{s.rideInfo.title}</div>
            <div className="ride-detail">{s.rideInfo.detail}</div>
          </div>
        )}
        <div className="stage-hud">
          <span className={s.notice ? 'notice' : ''}>
            {s.view === 'ride' ? (s.rideStep ? 'You are the electron. Space: go on to the next part · A: ride without stops · Esc: stop riding.' : 'You are the electron. A: stop at each part again · Esc or R: stop riding.') : s.view === 'flow' ? 'Each dot is charge moving, coloured by the source pushing it. Speed follows the current.' : s.notice ?? instruction(s.tool, !!s.pending)}
          </span>
          {s.hover && (
            <span className="hover-info">
              {hole(s.hover).label} · {describeStrip(s.hover)}
              {voltAt(s.hover) !== undefined && r.ok ? ` · ${formatSI(voltAt(s.hover)!, 'V')}` : ''}
            </span>
          )}
        </div>
        {s.menu && menuPart && (
          <div className="part-menu" style={{ left: s.menu.x, top: s.menu.y }} role="menu">
            <div className="part-menu-title">{menuPart.id}</div>
            {menuLocked ? <p className="part-menu-note">Part of the level: it stays where it is.</p> : <>
            {!menuPinned && <button role="menuitem" onClick={() => s.startMove(menuPart.id, s.menu!.anchor, 'single')}>Move <kbd>M</kbd></button>}
            {groupSize > 1 && !menuPinned && (
              <button role="menuitem" onClick={() => s.startMove(menuPart.id, s.menu!.anchor, 'group')}>
                Move with connected parts ({groupSize}) <kbd>⇧M</kbd>
              </button>
            )}
            {menuPart.kind !== 'wire' && (
              <button role="menuitem" onClick={() => { s.flipPart(menuPart.id); s.closeMenu(); }}>
                {menuPart.kind === 'led' || isElectrolytic(menuPart) ? 'Flip polarity' : 'Swap legs'}
              </button>
            )}
            <button role="menuitem" onClick={() => { s.select(menuPart.id); s.closeMenu(); }}>Edit value…</button>
            {!menuPinned && <button role="menuitem" className="danger" onClick={() => { s.select(menuPart.id); s.removeSelected(); s.closeMenu(); }}>Delete <kbd>Del</kbd></button>}
            </>}
          </div>
        )}
      </section>
      {s.scopeOpen && scopeAllowed && <ScopePanel onClose={() => s.setScopeOpen(false)} />}
      </div>

      <aside className="panel readouts">
        {mode?.side}
        <h2>Multimeter · DC V</h2>
        <div className="dmm">
          <div className="dmm-screen">{meter.text}<span>V</span></div>
          <div className="dmm-note">{meter.note}</div>
        </div>
        {s.probes.red && s.probes.black && r.ok && sourceKeys.length > 0 && (
          <Breakdown parts={voltageParts(analysis, s.probes.red, s.probes.black)} unit="V" colors={colors} />
        )}

        <h2>Status</h2>
        {faults.length === 0 && burnt.length === 0 ? <p className="ok">● No faults</p> : (
          <ul className="faults">
            {faults.map((f, i) => <li key={i} className={f.severity}>{f.message}</li>)}
            {burnt.map((p) => <li key={p.id} className="error">{p.id} burnt out. Fix the circuit, then replace it.</li>)}
          </ul>
        )}
        {r.ok && s.supply.on && <p className="hint">Supply current: {amps(partAmps(SUPPLY_ID))}</p>}

        {sel && (
          <>
            <h2>{sel.id}{selLocked ? ' · part of the level' : ''}</h2>
            <table>
              <tbody>
                <tr><th>Type</th><td className="num">{sel.kind === 'led' ? 'LED' : sel.kind === 'generator' ? 'function generator' : isElectrolytic(sel) ? 'electrolytic capacitor' : sel.kind}</td></tr>
                {sel.kind === 'capacitor' && (
                  <tr><th>Value</th><td className="num">
                    <select value={sel.farads} onChange={(e) => s.updatePart(sel.id, { farads: Number(e.target.value) })} disabled={selLocked} aria-label="Capacitance">
                      {CAP_VALUES.map((f) => <option key={f} value={f}>{fmtCap(f)}</option>)}
                    </select>
                  </td></tr>
                )}
                {sel.kind === 'battery' && (
                  <tr><th>Voltage</th><td className="num">
                    <select value={sel.volts} onChange={(e) => s.updatePart(sel.id, { volts: Number(e.target.value) })} disabled={selLocked} aria-label="Battery voltage">
                      {BATTERY_VOLTS.map((v) => <option key={v} value={v}>{v} V</option>)}
                    </select>
                  </td></tr>
                )}
                {sel.kind === 'resistor' && (
                  <tr><th>Value</th><td className="num">
                    <select value={sel.ohms} onChange={(e) => s.updatePart(sel.id, { ohms: Number(e.target.value) })} disabled={selLocked} aria-label="Resistance">
                      {ohmsList.map((o) => <option key={o} value={o}>{formatSI(o, 'Ω')}</option>)}
                    </select>
                  </td></tr>
                )}
                {sel.kind === 'led' && (
                  <tr><th>Colour</th><td className="num">
                    <select value={sel.color} onChange={(e) => s.updatePart(sel.id, { color: e.target.value as LedColor })} disabled={selLocked} aria-label="LED colour">
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
                    <tr><th>Current{dynamic ? ' (avg)' : ''}</th><td className="num">{amps(partAmps(sel.id))}</td></tr>
                    <tr><th>Voltage{dynamic ? ' (now)' : ''}</th><td className="num">{formatSI(Math.abs((voltAt(sel.h1) ?? 0) - (voltAt(sel.h2) ?? 0)), 'V')}</td></tr>
                    {sel.kind !== 'capacitor' && <tr><th>Power{dynamic ? ' (now)' : ''}</th><td className="num">{formatSI(Math.abs(r.power[sel.id] ?? 0), 'W')}</td></tr>}
                  </>
                )}
              </tbody>
            </table>
            {sel.kind === 'generator' && <WaveEditor wave={sel.wave ?? DEFAULT_WAVE} onChange={(w) => s.updatePart(sel.id, { wave: w })} />}
            {!mode && r.ok && analysis.contributions?.currents[sel.id] && sel.kind !== 'wire' && sel.kind !== 'capacitor'
              && Object.values(analysis.contributions.currents[sel.id]!).some((v) => Math.abs(v) > 1e-9) && (
              <>
                <h2>Current by source</h2>
                <Breakdown parts={analysis.contributions.currents[sel.id]!} unit="A" colors={colors} />
              </>
            )}
            <div className="presets" style={{ marginTop: 12 }}>
              {sel.burnt && <button onClick={() => s.replaceLed(sel.id)}>Replace LED{s.spares !== null ? ` (${s.spares} spare${s.spares === 1 ? '' : 's'})` : ''}</button>}
              {!selLocked && <>
                {!selPinned && <button onClick={() => s.startMove(sel.id, sel.h1, 'single')}>Move (M)</button>}
                {(sel.kind === 'led' || isElectrolytic(sel)) && <button onClick={() => s.flipPart(sel.id)}>Flip</button>}
                {!selPinned && <button onClick={s.removeSelected}>Remove (Del)</button>}
              </>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
