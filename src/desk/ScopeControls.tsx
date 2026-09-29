/**
 * The scope's knobs, as a small riso strip under the scope view: time per division, volts per
 * division for each channel, and Run/Stop. Clicking a hole on the board clips CH1, then CH2.
 */
import { TDIV_STEPS, VDIV_STEPS, stepValue, type ScopeCh } from '../instruments/scope';
import { useScope } from '../instruments/scopeStore';
import { formatSI } from '../lib/units';
import { useBench } from '../breadboard/store';
import { TRACE } from './assets/BenchScope';

function Stepper({ label, value, onStep, color }: { label: string; value: string; onStep: (dir: 1 | -1) => void; color?: string }) {
  return (
    <span className="tray-stepper scope-stepper">
      <small style={color ? { background: color } : undefined}>{label}</small>
      <button onClick={() => onStep(-1)} aria-label={`${label} smaller`}>‹</button>
      <b>{value}</b>
      <button onClick={() => onStep(1)} aria-label={`${label} bigger`}>›</button>
    </span>
  );
}

export function ScopeControls() {
  const sc = useScope();
  const probes = useBench((s) => s.scopeProbes);
  const next = useBench((s) => s.scopeNext);
  const ch = (c: ScopeCh) => (
    <Stepper key={c} label={c.toUpperCase()} color={TRACE[c]} value={probes[c] ? `${formatSI(sc[c].vdiv, 'V')}/div` : 'no probe'}
      onStep={(d) => sc.setChannel(c, { vdiv: stepValue(VDIV_STEPS, sc[c].vdiv, d) })} />
  );
  return (
    <div className="scope-tray">
      <div className="scope-tray-knobs">
        <Stepper label="TIME" value={`${formatSI(sc.tdiv, 's')}/div`} onStep={(d) => sc.setTdiv(stepValue(TDIV_STEPS, sc.tdiv, d))} />
        {ch('ch1')}{ch('ch2')}
        <button className="desk-chip" onClick={() => sc.setRunning(!sc.running)}>{sc.running ? '❚❚ Stop' : '▶ Run'}</button>
      </div>
      <span className="desk-pict"><span className="dot" style={{ background: TRACE[next] }} /> click a hole to clip {next.toUpperCase()}</span>
    </div>
  );
}
