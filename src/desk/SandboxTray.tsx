/**
 * The free bench's part controls, above the hotbar (which holds the parts, in drawers). The part in hand shows its value picker; a selected part
 * can be changed, turned round or taken out. Example circuits and the supply voltage live in
 * a small row underneath.
 */
import { isElectrolytic, type BoardPart } from '../breadboard/model';
import { BENCH_PRESETS, useBench, type Tool } from '../breadboard/store';
import { useScope } from '../instruments/scopeStore';
import { formatSI } from '../lib/units';
import type { LedColor, WaveShape } from '../sim';
import { OhmsStepper } from './PartsTray';

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const OHMS = [10, 100, 1000, 10000, 100000].flatMap((d) => E12.map((m) => Number((m * d).toPrecision(2)))).concat(1_000_000);
const FARADS = [1e-9, 10e-9, 100e-9, 1e-6, 10e-6, 47e-6, 100e-6, 220e-6, 470e-6, 1000e-6];
const VOLTS = [1.5, 3, 4.5, 6, 9];
const SUPPLY = [3.3, 5, 9, 12];
const FREQS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const LEDS: LedColor[] = ['red', 'yellow', 'green', 'blue', 'white'];
const LED_HEX: Record<LedColor, string> = { red: '#ff3b30', yellow: '#ffd60a', green: '#39d86a', blue: '#3a8bff', white: '#f5f5ff' };
const SHAPES: WaveShape[] = ['square', 'sine', 'triangle'];
const POT_OHMS = [1000, 10000, 100000];
const POSITIONS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
/** Regulators you can buy, by output voltage. */
const REGULATORS: Record<number, string> = { 3.3: 'LM1117-3.3', 5: 'LM7805', 9: 'LM7809', 12: 'LM7812' };
/** How a three-legged part goes in, leg by leg, as the hint under the tray says it. */
const LEG_HINT: Partial<Record<Tool, string>> = {
  pot: 'end · wiper · end', npn: 'E · B · C, flat face away from you', nmos: 'G · D · S', regulator: 'IN · GND · OUT', spdt: 'A · common · B',
};
const fmtF = (f: number) => (f >= 1e-6 ? `${Number((f * 1e6).toPrecision(3))} µF` : formatSI(f, 'F'));

/** ‹ value › over a fixed list. */
function Step<T extends number>({ value, values, fmt, onChange }: { value: T; values: T[]; fmt: (v: T) => string; onChange: (v: T) => void }) {
  const i = Math.max(0, values.findIndex((v) => v >= value));
  return (
    <span className="tray-stepper">
      <button onClick={() => onChange(values[Math.max(0, i - 1)]!)} disabled={i === 0} aria-label="Smaller">‹</button>
      <b>{fmt(value)}</b>
      <button onClick={() => onChange(values[Math.min(values.length - 1, i + 1)]!)} disabled={i >= values.length - 1} aria-label="Bigger">›</button>
    </span>
  );
}

function LedColors({ value, onChange }: { value: LedColor; onChange: (c: LedColor) => void }) {
  return (
    <span className="tray-colors" role="radiogroup" aria-label="LED colour">
      {LEDS.map((c) => <button key={c} role="radio" aria-checked={c === value} aria-label={c} className={c === value ? 'on' : ''} style={{ background: LED_HEX[c] }} onClick={() => onChange(c)} />)}
    </span>
  );
}

/** The value picker for a kind of part: for the one in hand, or the one selected on the board. */
function ValueEditor({ kind, part, onPatch }: { kind: Tool; part?: BoardPart; onPatch: (p: Partial<BoardPart>) => void }) {
  const b = useBench.getState();
  const s = useBench();
  if (kind === 'resistor') return <OhmsStepper value={part?.ohms ?? s.ohms} values={OHMS} onChange={(o) => (part ? onPatch({ ohms: o }) : b.setOhms(o))} />;
  if (kind === 'led') return <LedColors value={part?.color ?? s.ledColor} onChange={(c) => (part ? onPatch({ color: c }) : b.setLedColor(c))} />;
  if (kind === 'capacitor') return <Step value={part?.farads ?? s.farads} values={FARADS} fmt={fmtF} onChange={(f) => (part ? onPatch({ farads: f }) : b.setFarads(f))} />;
  if (kind === 'battery') return <Step value={part?.volts ?? s.batteryVolts} values={VOLTS} fmt={(v) => `${v} V`} onChange={(v) => (part ? onPatch({ volts: v }) : b.setBatteryVolts(v))} />;
  if (kind === 'pot') {
    const set = (patch: Partial<BoardPart>) => (part ? onPatch(patch) : undefined);
    return (
      <>
        <Step value={part?.ohms ?? 10000} values={POT_OHMS} fmt={(o) => formatSI(o, 'Ω')} onChange={(o) => set({ ohms: o })} />
        {part && <label className="tray-knob">knob <Step value={part.position ?? 0.5} values={POSITIONS} fmt={(k) => `${Math.round(k * 100)} %`} onChange={(k) => set({ position: k })} /></label>}
      </>
    );
  }
  if (kind === 'regulator' && part) {
    return <Step value={part.vout ?? 5} values={[3.3, 5, 9, 12]} fmt={(v) => `${REGULATORS[v] ?? ''} · ${v} V`} onChange={(v) => onPatch({ vout: v, marking: REGULATORS[v] })} />;
  }
  if (kind === 'generator') {
    const w = part?.wave ?? s.wave;
    const set = (patch: Partial<typeof w>) => (part ? onPatch({ wave: { ...w, ...patch } }) : b.setWave({ ...w, ...patch }));
    return (
      <>
        <span className="tray-shapes">{SHAPES.map((x) => <button key={x} className={x === w.shape ? 'on' : ''} onClick={() => set({ shape: x })}>{x}</button>)}</span>
        <Step value={w.freq} values={FREQS} fmt={(f) => formatSI(f, 'Hz')} onChange={(f) => set({ freq: f })} />
      </>
    );
  }
  return null;
}

export function SandboxTray() {
  const tool = useBench((s) => s.tool);
  const pending = useBench((s) => s.pending);
  const selected = useBench((s) => s.selected);
  const parts = useBench((s) => s.parts);
  const supply = useBench((s) => s.supply);
  const bench = useBench.getState();
  const part = parts.find((p) => p.id === selected);
  const flippable = !!part && (part.kind === 'led' || part.kind === 'battery' || part.kind === 'diode' || !!part.h3 || isElectrolytic(part));

  return (
    <>
      <div className="tray-context">
        {tool !== 'select' && tool !== 'probe' && tool !== 'scope' && (
          <>
            <ValueEditor kind={tool} onPatch={() => {}} />
            <span className="desk-pict"><span className="dot pink" /> {LEG_HINT[tool] ? `click the first of three holes in a row: ${LEG_HINT[tool]}` : pending ? 'now the second hole' : 'click two holes'}</span>
          </>
        )}
        {tool === 'select' && part && (
          <>
            <ValueEditor kind={part.kind} part={part} onPatch={(p) => bench.updatePart(part.id, p)} />
            {flippable && <button className="desk-chip" onClick={() => bench.flipPart(part.id)}>↻ Turn {part.id} round</button>}
            {part.kind === 'led' && part.burnt && <button className="desk-chip" onClick={() => bench.replaceLed(part.id)}>Fit a new LED</button>}
            <button className="tray-remove" onClick={() => bench.removeSelected()}>Take out</button>
          </>
        )}
        {tool === 'select' && !part && (
          <span className="tray-bench">
            <label>Supply <Step value={supply.volts} values={SUPPLY} fmt={(v) => `${v} V`} onChange={(v) => bench.setVolts(v)} /></label>
            <label>Example
              <select value="" onChange={(e) => { const p = BENCH_PRESETS[e.target.value]; if (p) { bench.load(structuredClone(p)); if (p.scopeSetup) useScope.getState().apply(p.scopeSetup); } }}>
                <option value="">load a circuit…</option>
                {Object.keys(BENCH_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <button className="tray-remove" onClick={() => bench.clear()}>Clear the board</button>
          </span>
        )}
      </div>
    </>
  );
}
