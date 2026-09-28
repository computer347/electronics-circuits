/**
 * Two-channel oscilloscope on the bench. The probes clip onto breadboard holes (scope tool),
 * the ground clip is on board ground, and the trace is drawn live on the phosphor screen.
 */
import { useEffect, useRef, useState } from 'react';
import { formatSI } from '../lib/units';
import { bench, useLive } from '../breadboard/live';
import { hole } from '../breadboard/layout';
import { useBench } from '../breadboard/store';
import { PhosphorScreen } from './phosphor';
import {
  DIVS_Y, measure, PRE_TRIGGER_DIVS, stepValue, TDIV_STEPS, VDIV_STEPS,
  type BeamPoint, type ChannelStats, type Sample, type ScopeCh,
} from './scope';
import { useScope, type ChannelSettings } from './scopeStore';

/** Paint colours: each channel draws into its own colour channel of the beam canvas. */
const PAINT: Record<ScopeCh | 'text', string> = { ch1: '#ff0000', ch2: '#00ff00', text: '#0000ff' };
/** What the channels look like on the tube (for the HTML controls). */
export const CH_COLOR: Record<ScopeCh, string> = { ch1: '#39ff88', ch2: '#3ad7ff' };

const fmtDiv = (v: number, unit: string) => formatSI(v, unit);
const fmtFreq = (f?: number) => (f === undefined ? '—' : formatSI(f, 'Hz'));

export function ScopePanel({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [noGL, setNoGL] = useState(false);
  const [mini, setMini] = useState(false);
  const [stats, setStats] = useState<Record<ScopeCh, ChannelStats | null>>({ ch1: null, ch2: null });
  const sc = useScope();
  const probes = useBench((s) => s.scopeProbes);
  const tool = useBench((s) => s.tool);
  const setTool = useBench((s) => s.setTool);
  const rate = useLive((s) => s.rate);
  const liveResult = useLive((s) => s.result);
  const probeNote = (ch: ScopeCh) => {
    const h = probes[ch];
    if (!h) return 'not clipped on';
    return bench.voltageAt(liveResult, h) === undefined ? `${hole(h).label} · nothing connected there` : hole(h).label;
  };

  // Render loop: drain the acquisition into the phosphor screen every frame.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let screen: PhosphorScreen | null = null;
    try { screen = PhosphorScreen.create(el); } catch (e) { console.warn('[scope] phosphor shader failed', e); }
    if (!screen) { setNoGL(true); return; }
    const scr = screen;
    const ro = new ResizeObserver(() => scr.resize());
    ro.observe(el);
    scr.resize();

    const prev: Record<ScopeCh, [number, number] | null> = { ch1: null, ch2: null };
    let lastTdiv = useScope.getState().tdiv;
    let raf = 0;

    const loop = (now: number) => {
      const st = useScope.getState();
      const pr = useBench.getState().scopeProbes;
      if (st.tdiv !== lastTdiv) { lastTdiv = st.tdiv; scr.clear(); prev.ch1 = prev.ch2 = null; }
      const fresh = bench.scope.take();
      const stopped = bench.scope.state === 'stopped';

      scr.frame(now, (ctx, W, H, dpr) => {
        const yOf = (c: ChannelSettings, v: number) => H / 2 - (v / c.vdiv + c.pos) * (H / DIVS_Y);
        const clampY = (y: number) => Math.max(-4 * dpr, Math.min(H + 4 * dpr, y));
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.7 * dpr;

        const trace = (ch: ScopeCh, pts: readonly BeamPoint[], restart: boolean) => {
          const c = st[ch];
          if (!c.on || !pr[ch]) { prev[ch] = null; return; }
          ctx.strokeStyle = PAINT[ch];
          if (restart) prev[ch] = null;
          for (const p of pts) {
            const x = p.x * W, y = clampY(yOf(c, ch === 'ch1' ? p.v1 : p.v2));
            const q = prev[ch];
            if (q && !p.jump && x >= q[0]) {
              // brightness follows dwell time: steep edges draw faint, like a real beam
              const len = Math.hypot(x - q[0], y - q[1]);
              ctx.globalAlpha = Math.min(1, (1.5 * dpr) / Math.max(len, 0.01)) * 0.9 + 0.07;
              ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(x, y); ctx.stroke();
            }
            prev[ch] = [x, y];
          }
        };

        if (stopped) {
          // Held picture: redraw the last sweep every frame so it stays put.
          const { lastSweep, lastStart, span } = bench.scope;
          const hold: BeamPoint[] = lastSweep.map((p: Sample, i) => ({ x: (p.t - lastStart) / span, v1: p.v1, v2: p.v2, jump: i === 0 }));
          trace('ch1', hold, true); trace('ch2', hold, true);
        } else {
          trace('ch1', fresh, false); trace('ch2', fresh, false);
        }

        // ---- markers and readouts, drawn in the text channel so they glow too
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = PAINT.text;
        const fs = Math.round(10.5 * dpr);
        ctx.font = `${fs}px 'JetBrains Mono', ui-monospace, monospace`;
        ctx.textBaseline = 'top';
        const pad = W * 0.035;
        const line = fs * 1.6;

        // 0 V markers at the left edge, in each channel's own colour
        for (const ch of ['ch1', 'ch2'] as const) {
          const c = st[ch];
          if (!c.on || !pr[ch]) continue;
          const y = Math.max(6 * dpr, Math.min(H - 6 * dpr, yOf(c, 0)));
          ctx.fillStyle = PAINT[ch];
          ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.moveTo(2 * dpr, y - 5 * dpr); ctx.lineTo(10 * dpr, y); ctx.lineTo(2 * dpr, y + 5 * dpr); ctx.fill();
          ctx.fillText(ch === 'ch1' ? '1' : '2', 12 * dpr, y - fs / 2);
        }
        // trigger level (right edge) and trigger point (top)
        const tc = st[st.trigger.source];
        const ty = Math.max(6 * dpr, Math.min(H - 6 * dpr, yOf(tc, st.trigger.level)));
        ctx.fillStyle = PAINT[st.trigger.source];
        ctx.beginPath(); ctx.moveTo(W - 2 * dpr, ty - 5 * dpr); ctx.lineTo(W - 10 * dpr, ty); ctx.lineTo(W - 2 * dpr, ty + 5 * dpr); ctx.fill();
        const tx = (PRE_TRIGGER_DIVS / 10) * W;
        ctx.fillStyle = PAINT.text;
        ctx.beginPath(); ctx.moveTo(tx - 5 * dpr, 2 * dpr); ctx.lineTo(tx + 5 * dpr, 2 * dpr); ctx.lineTo(tx, 9 * dpr); ctx.fill();

        ctx.globalAlpha = 0.62;
        ctx.textAlign = 'left';
        let y = H * 0.045 + 6 * dpr;
        for (const ch of ['ch1', 'ch2'] as const) {
          if (!st[ch].on) continue;
          ctx.fillStyle = PAINT[ch];
          ctx.fillText(`${ch.toUpperCase()} ${pr[ch] ? fmtDiv(st[ch].vdiv, 'V') + '/div' : 'no probe'}`, pad + 10 * dpr, y);
          y += line;
        }
        ctx.textAlign = 'right';
        ctx.fillStyle = PAINT.text;
        ctx.fillText(`${fmtDiv(st.tdiv, 's')}/div`, W - pad - 10 * dpr, H * (1 - 0.045) - fs);
        const status = stopped ? 'STOP' : bench.scope.state === 'waiting' && st.trigger.mode !== 'auto' ? 'WAIT' : bench.scope.triggered ? "TRIG'D" : 'AUTO';
        ctx.fillText(`${st.trigger.source.toUpperCase()} ${st.trigger.edge === 'rise' ? '↑' : '↓'} ${formatSI(st.trigger.level, 'V')}`, W - pad - 10 * dpr, H * 0.045 + 6 * dpr);
        ctx.fillText(status, W - pad - 10 * dpr, H * 0.045 + 6 * dpr + line);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }, { afterglow: st.afterglow, fx: st.fx });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); scr.dispose(); };
  }, []);

  // Measurements, a few times a second.
  useEffect(() => {
    const id = setInterval(() => {
      const s = bench.scope.measured;
      const recent = bench.scope.recent;
      // Levels from what's on screen; frequency from a longer stretch, like a scope's counter.
      const one = (ch: ScopeCh): ChannelStats | null => {
        const m = measure(s, ch);
        return m && { ...m, freq: m.freq ?? measure(recent, ch)?.freq };
      };
      setStats({ ch1: one('ch1'), ch2: one('ch2') });
    }, 250);
    return () => clearInterval(id);
  }, []);

  const trigCh = sc[sc.trigger.source];
  const nudgeLevel = (dir: 1 | -1) => sc.setTrigger({ level: Number((sc.trigger.level + dir * trigCh.vdiv * 0.2).toPrecision(6)) });
  const slowmo = rate < 0.999 ? `slow motion ×1/${Math.round(1 / rate)}` : 'real time';

  return (
    <div className={`scope-panel panel ${mini ? 'mini' : ''}`} role="region" aria-label="Oscilloscope">
      <div className="scope-head">
        <h2>Oscilloscope · 2 ch</h2>
        <span className="scope-rate" title="The whole bench runs at the scope's timebase">{slowmo}</span>
        <button className={sc.running ? 'active' : 'stopped'} onClick={() => sc.setRunning(!sc.running)} title={sc.running ? 'Running: click to freeze the picture' : 'Stopped: click to run'}>
          {sc.running ? '■ Stop' : '▶ Run'}
        </button>
        <button className={sc.trigger.mode === 'single' ? 'active' : ''} onClick={() => { sc.setTrigger({ mode: 'single' }); sc.setRunning(true); bench.scope.run(); }}>Single</button>
        <button onClick={() => setMini(!mini)} aria-label={mini ? 'Expand oscilloscope' : 'Shrink oscilloscope'}>{mini ? '▢' : '▁'}</button>
        <button onClick={onClose} aria-label="Close oscilloscope">✕</button>
      </div>
      <div className={`scope-body ${mini ? 'mini' : ''}`}>
        <div className="tube">
          <canvas ref={canvas} />
          {noGL && <div className="tube-fallback">The scope screen needs WebGL2, which this browser doesn't provide.</div>}
        </div>
        <div className="scope-controls">
          {(['ch1', 'ch2'] as const).map((ch) => (
            <div key={ch} className="knob-row">
              <button className={`ch-btn ${sc[ch].on ? 'active' : ''}`} style={{ color: CH_COLOR[ch], borderColor: sc[ch].on ? CH_COLOR[ch] : undefined }} onClick={() => sc.setChannel(ch, { on: !sc[ch].on })}>
                {ch.toUpperCase()}
              </button>
              <div className="knob">
                <button aria-label={`${ch} fewer volts per division`} onClick={() => sc.setChannel(ch, { vdiv: stepValue(VDIV_STEPS, sc[ch].vdiv, -1) })}>−</button>
                <span>{formatSI(sc[ch].vdiv, 'V')}</span>
                <button aria-label={`${ch} more volts per division`} onClick={() => sc.setChannel(ch, { vdiv: stepValue(VDIV_STEPS, sc[ch].vdiv, 1) })}>+</button>
              </div>
              <div className="knob small">
                <button aria-label={`${ch} position down`} onClick={() => sc.setChannel(ch, { pos: Math.max(-4, sc[ch].pos - 0.5) })}>▼</button>
                <button aria-label={`${ch} position up`} onClick={() => sc.setChannel(ch, { pos: Math.min(4, sc[ch].pos + 0.5) })}>▲</button>
              </div>
              <div className="probe-at">{probeNote(ch)}</div>
            </div>
          ))}
          <div className="knob-row">
            <span className="knob-label">Time</span>
            <div className="knob">
              <button aria-label="Faster timebase" onClick={() => sc.setTdiv(stepValue(TDIV_STEPS, sc.tdiv, -1))}>−</button>
              <span>{formatSI(sc.tdiv, 's')}</span>
              <button aria-label="Slower timebase" onClick={() => sc.setTdiv(stepValue(TDIV_STEPS, sc.tdiv, 1))}>+</button>
            </div>
          </div>
          <div className="knob-row">
            <span className="knob-label">Trig</span>
            <button onClick={() => sc.setTrigger({ source: sc.trigger.source === 'ch1' ? 'ch2' : 'ch1' })} style={{ color: CH_COLOR[sc.trigger.source] }}>{sc.trigger.source.toUpperCase()}</button>
            <button onClick={() => sc.setTrigger({ edge: sc.trigger.edge === 'rise' ? 'fall' : 'rise' })} aria-label="Trigger edge">{sc.trigger.edge === 'rise' ? '↑' : '↓'}</button>
            <div className="knob">
              <button aria-label="Trigger level down" onClick={() => nudgeLevel(-1)}>−</button>
              <span>{formatSI(sc.trigger.level, 'V')}</span>
              <button aria-label="Trigger level up" onClick={() => nudgeLevel(1)}>+</button>
            </div>
            <button onClick={() => sc.setTrigger({ mode: sc.trigger.mode === 'normal' ? 'auto' : 'normal' })}>{sc.trigger.mode === 'normal' ? 'Normal' : sc.trigger.mode === 'single' ? 'Single' : 'Auto'}</button>
          </div>
          <div className="knob-row">
            <button className={tool === 'scope' ? 'active' : ''} onClick={() => setTool(tool === 'scope' ? 'select' : 'scope')}>Clip probes <kbd>0</kbd></button>
            <label className="check glow">Glow
              <input type="range" min={0.05} max={1.5} step={0.05} value={sc.afterglow} onChange={(e) => sc.setAfterglow(Number(e.target.value))} aria-label="Afterglow" />
            </label>
            <label className="check"><input type="checkbox" checked={sc.fx} onChange={(e) => sc.setFx(e.target.checked)} /> CRT</label>
          </div>
        </div>
        <div className="scope-meas">
          {(['ch1', 'ch2'] as const).some((ch) => probes[ch]) ? (
            <table>
              <thead><tr><th></th>{(['ch1', 'ch2'] as const).filter((ch) => sc[ch].on && probes[ch]).map((ch) => <th key={ch} className="num" style={{ color: CH_COLOR[ch] }}>{ch.toUpperCase()}</th>)}</tr></thead>
              <tbody>
                {([['Vpp', (x: ChannelStats) => formatSI(x.vpp, 'V')], ['Mean', (x: ChannelStats) => formatSI(x.mean, 'V')], ['Max', (x: ChannelStats) => formatSI(x.vmax, 'V')], ['Min', (x: ChannelStats) => formatSI(x.vmin, 'V')], ['Freq', (x: ChannelStats) => fmtFreq(x.freq)]] as const).map(([label, f]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    {(['ch1', 'ch2'] as const).filter((ch) => sc[ch].on && probes[ch]).map((ch) => <td key={ch} className="num">{stats[ch] ? f(stats[ch]!) : '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="hint">No probes on the board. Pick <b>Scope probes</b> (key 0) and click a hole for CH1, then another for CH2. The ground clip is on board ground (the blue top rail).</p>
          )}
        </div>
      </div>
    </div>
  );
}
