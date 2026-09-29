/**
 * The live labs inside Learn classes: a schematic drawn from the circuit, a couple of
 * controls, and the solver's readings. Each lab resets when its step opens.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { formatSI } from '../lib/units';
import { SchematicView } from '../schematic/SchematicView';
import { BIN_OHMS, dividerLab, ledLab, ledState, ohmLab, pairLab, rcLab, type LedState } from './physics';
import type { LabSpec } from './types';

const nearestIndex = (values: number[], v: number) =>
  values.reduce((best, x, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(values[best]! / v)) ? i : best), 0);

function Stepper({ label, values, value, onChange, unit }: {
  label: string; values: number[]; value: number; onChange: (v: number) => void; unit: string;
}) {
  const i = nearestIndex(values, value);
  return (
    <label className="lab-control">
      <span className="lab-control-label">{label}</span>
      <input
        type="range" min={0} max={values.length - 1} step={1} value={i}
        onChange={(e) => onChange(values[Number(e.target.value)]!)}
        aria-label={label} aria-valuetext={formatSI(value, unit)}
      />
      <b>{formatSI(value, unit)}</b>
    </label>
  );
}

function Toggle({ options, value, onChange, label }: {
  options: { id: string; text: string }[]; value: string; onChange: (id: string) => void; label: string;
}) {
  return (
    <div className="lab-control" role="group" aria-label={label}>
      <span className="lab-control-label">{label}</span>
      <div className="presets lab-toggle">
        {options.map((o) => (
          <button key={o.id} className={o.id === value ? 'active' : ''} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.text}</button>
        ))}
      </div>
    </div>
  );
}

function Reading({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className={`lab-reading ${tone ?? ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

const LED_TEXT: Record<LedState, string> = {
  off: 'dark', dim: 'barely glowing', lit: 'lit', bright: 'too bright, over 25 mA', burnt: 'burnt out',
};

function LedGlyph({ state, amps, label }: { state: LedState; amps: number; label: string }) {
  // Brightness follows current up to 25 mA; a burnt LED goes dark and grey.
  const glow = state === 'burnt' ? 0 : Math.min(1, amps / 0.025);
  return (
    <div className={`lab-led ${state}`} aria-label={`${label}: ${LED_TEXT[state]}`}>
      <span className="lab-led-dome" style={{ '--glow': glow } as React.CSSProperties} />
      <span className="lab-led-text">{label} · {LED_TEXT[state]}</span>
    </div>
  );
}

function Frame({ figure, controls, readings }: { figure: ReactNode; controls: ReactNode; readings: ReactNode }) {
  return (
    <div className="lab">
      <div className="lab-figure">{figure}</div>
      <div className="lab-side">
        <div className="lab-controls">{controls}</div>
        <div className="lab-readings">{readings}</div>
      </div>
    </div>
  );
}

const VOLTS = [1.5, 3, 4.5, 5, 6, 9, 12];
const mA = (a: number) => formatSI(a, 'A');
const volt = (v: number) => formatSI(Math.abs(v) < 1e-6 ? 0 : v, 'V', 3);

function OhmLab({ spec }: { spec: Extract<LabSpec, { kind: 'ohm' }> }) {
  const [v, setV] = useState(spec.volts ?? 9);
  const [r, setR] = useState(spec.ohms ?? 1000);
  const x = useMemo(() => ohmLab(v, r), [v, r]);
  return (
    <Frame
      figure={<SchematicView schematic={x.schematic} highlight={{ parts: ['R1'] }} title="Battery and one resistor" />}
      controls={<>
        <Stepper label="Supply" values={VOLTS} value={v} onChange={setV} unit="V" />
        <Stepper label="R1" values={BIN_OHMS} value={r} onChange={setR} unit="Ω" />
      </>}
      readings={<>
        <Reading label="Current I = V / R" value={mA(x.amps)} />
        <Reading label="Heat in R1, P = I × V" value={formatSI(x.watts, 'W')} tone={x.watts > 0.25 ? 'bad' : undefined} />
        {x.watts > 0.25 && <p className="lab-note bad">Over 0.25 W: a small resistor would get too hot.</p>}
        <Flow amps={x.amps} />
      </>}
    />
  );
}

/** A strip of moving dots whose speed follows the current: the electron's-eye view. */
function Flow({ amps }: { amps: number }) {
  const speed = amps <= 1e-6 ? 0 : Math.min(8, Math.max(0.4, amps / 0.01));
  return (
    <div className="lab-flow" aria-hidden>
      <span className="lab-flow-dots" style={{ animationDuration: speed ? `${4 / speed}s` : '0s', animationPlayState: speed ? 'running' : 'paused' }} />
    </div>
  );
}

function LedLab({ spec }: { spec: Extract<LabSpec, { kind: 'led' }> }) {
  const [r, setR] = useState(spec.ohms ?? 330);
  const [reversed, setReversed] = useState(!!spec.reversed);
  const v = spec.volts ?? 9;
  const x = useMemo(() => ledLab(v, r, reversed), [v, r, reversed]);
  return (
    <Frame
      figure={<SchematicView schematic={x.schematic} highlight={{ parts: ['LED1'], nodes: spec.meter ? [{ at: [4, 0], label: 'A' }, { at: [4, 3], label: 'B' }] : [] }} title={`${v} V supply, resistor and red LED`} />}
      controls={<>
        {!spec.flip || <Toggle label="LED1" value={reversed ? 'rev' : 'fwd'} onChange={(id) => setReversed(id === 'rev')}
          options={[{ id: 'fwd', text: 'Right way round' }, { id: 'rev', text: 'Backwards' }]} />}
        <Stepper label="R1" values={BIN_OHMS} value={r} onChange={setR} unit="Ω" />
      </>}
      readings={<>
        <LedGlyph state={x.state} amps={x.amps} label="LED1" />
        <Reading label="Current" value={mA(x.amps)}
          tone={x.state === 'burnt' || x.state === 'bright' ? 'bad' : x.state === 'lit' ? 'good' : 'warn'} />
        {spec.meter ? <>
          <Reading label="Meter at A (black on ground)" value={volt(x.vAnodeSide)} />
          <Reading label="Meter at B (black on ground)" value={volt(x.vGroundSide)} />
          <Reading label="Across the LED, A − B" value={volt(x.vAnodeSide - x.vGroundSide)} />
        </> : <>
          <Reading label="Across R1" value={volt(x.vResistor)} />
          <Reading label="Across LED1" value={volt(x.vLed)} />
        </>}
        {x.state === 'burnt' && <p className="lab-note bad">{formatSI(x.amps, 'A')} is over the 30 mA it can survive. On the bench you'd need a spare.</p>}
      </>}
    />
  );
}

function PairLab({ spec }: { spec: Extract<LabSpec, { kind: 'pair' }> }) {
  const [mode, setMode] = useState<'series' | 'parallel'>(spec.mode ?? 'series');
  const [r, setR] = useState(spec.ohms ?? 330);
  const x = useMemo(() => pairLab(9, r, mode), [r, mode]);
  const budget = spec.budget;
  const over = budget !== undefined && x.supply > budget;
  return (
    <Frame
      figure={<SchematicView schematic={x.schematic} highlight={{ parts: ['LED1', 'LED2'] }} title={`Two red LEDs in ${mode} on 9 V`} />}
      controls={<>
        <Toggle label="Layout" value={mode} onChange={(m) => setMode(m as 'series' | 'parallel')}
          options={[{ id: 'series', text: 'Series' }, { id: 'parallel', text: 'Parallel' }]} />
        <Stepper label={mode === 'series' ? 'R1' : 'R1 and R2'} values={BIN_OHMS.filter((o) => o <= 4700)} value={r} onChange={setR} unit="Ω" />
      </>}
      readings={<>
        <LedGlyph state={ledState(x.led1)} amps={x.led1} label="LED1" />
        <LedGlyph state={ledState(x.led2)} amps={x.led2} label="LED2" />
        <Reading label="LED1 current" value={mA(x.led1)} />
        <Reading label="LED2 current" value={mA(x.led2)} />
        <Reading label="Supply delivers" value={mA(x.supply)} tone={over ? 'bad' : budget !== undefined ? 'good' : undefined} />
        {budget !== undefined && (
          <div className="lab-budget" aria-label={`Supply budget ${mA(budget)}`}>
            <span className={over ? 'bad' : ''} style={{ width: `${Math.min(100, (x.supply / budget) * 100)}%` }} />
            <em>{over ? 'over' : 'within'} the {mA(budget)} budget</em>
          </div>
        )}
      </>}
    />
  );
}

function DividerLab({ spec }: { spec: Extract<LabSpec, { kind: 'divider' }> }) {
  const [top, setTop] = useState(spec.rTop ?? 1000);
  const [bottom, setBottom] = useState(spec.rBottom ?? 1000);
  const x = useMemo(() => dividerLab(9, top, bottom), [top, bottom]);
  const inTarget = spec.target ? x.vOut >= spec.target[0] && x.vOut <= spec.target[1] : undefined;
  const overCurrent = spec.maxAmps !== undefined && x.amps > spec.maxAmps;
  return (
    <Frame
      figure={<SchematicView schematic={x.schematic} highlight={{ nodes: [{ at: [3, 2], label: `TP1 ${x.vOut.toFixed(2)} V` }] }} title="Voltage divider on 9 V" />}
      controls={<>
        <Stepper label="R_top (R1)" values={BIN_OHMS} value={top} onChange={setTop} unit="Ω" />
        <Stepper label="R_bottom (R2)" values={BIN_OHMS} value={bottom} onChange={setBottom} unit="Ω" />
      </>}
      readings={<>
        <Reading label="Tap TP1" value={volt(x.vOut)} tone={inTarget === undefined ? undefined : inTarget ? 'good' : 'bad'} />
        {spec.target && <p className="lab-note">Target {spec.target[0]}–{spec.target[1]} V</p>}
        <Reading label="Ratio R_bottom / total" value={x.ratio.toFixed(3)} />
        <Reading label="Current wasted" value={mA(x.amps)} tone={spec.maxAmps === undefined ? undefined : overCurrent ? 'bad' : 'good'} />
        {spec.maxAmps !== undefined && <p className="lab-note">Budget {mA(spec.maxAmps)}</p>}
        <div className="lab-bar" aria-hidden><span style={{ height: `${(x.vOut / 9) * 100}%` }} /><em>9 V</em></div>
      </>}
    />
  );
}

const CAPS = [1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6, 47e-6, 100e-6, 220e-6, 470e-6];

function RcLab({ spec }: { spec: Extract<LabSpec, { kind: 'rc' }> }) {
  const [r, setR] = useState(spec.ohms ?? 10000);
  const [c, setC] = useState(spec.farads ?? 100e-6);
  const [bleed, setBleed] = useState(!!spec.bleed);
  const x = useMemo(() => rcLab(9, r, c, bleed ? 100000 : undefined), [r, c, bleed]);
  const inWindow = spec.window ? x.t63 >= spec.window[0] && x.t63 <= spec.window[1] : undefined;
  return (
    <Frame
      figure={<RcPlot reading={x} window={spec.window} />}
      controls={<>
        <Stepper label="R1" values={BIN_OHMS.filter((o) => o >= 1000)} value={r} onChange={setR} unit="Ω" />
        <Stepper label="C1" values={CAPS} value={c} onChange={setC} unit="F" />
        {spec.bleed !== undefined && <Toggle label="100 kΩ bleed across C1" value={bleed ? 'on' : 'off'} onChange={(id) => setBleed(id === 'on')}
          options={[{ id: 'off', text: 'Off' }, { id: 'on', text: 'On' }]} />}
      </>}
      readings={<>
        <Reading label="τ" value={formatSI(x.tau, 's')} />
        <Reading label="63 % reached at" value={formatSI(x.t63, 's')} tone={inWindow === undefined ? undefined : inWindow ? 'good' : 'bad'} />
        {spec.window && <p className="lab-note">Level 0–5 wants {spec.window[0]}–{spec.window[1]} s</p>}
        <Reading label="Final voltage" value={volt(x.vFinal)} />
      </>}
    />
  );
}

/** The charge curve, drawn in scope green, with the 63 % line and τ marked. */
function RcPlot({ reading: x, window }: { reading: ReturnType<typeof rcLab>; window?: [number, number] }) {
  const Wd = 420, H = 220, P = 28;
  const sx = (t: number) => P + (t / x.span) * (Wd - 2 * P);
  const sy = (v: number) => H - P - (v / 9) * (H - 2 * P);
  const d = x.curve.map(([t, v], i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const y63 = sy(0.632 * x.vFinal);
  return (
    <svg className="rc-plot" viewBox={`0 0 ${Wd} ${H}`} role="img" aria-label={`C1 charging: 63 % after ${formatSI(x.t63, 's')}`}>
      {[1, 2, 3, 4].map((k) => <line key={k} className="grid" x1={sx(k * x.tau)} x2={sx(k * x.tau)} y1={P} y2={H - P} />)}
      <line className="axis" x1={P} x2={Wd - P} y1={H - P} y2={H - P} />
      <line className="axis" x1={P} x2={P} y1={P} y2={H - P} />
      {window && window[0] < x.span && (
        <rect className="window" x={sx(window[0])} width={Math.max(0, sx(Math.min(window[1], x.span)) - sx(window[0]))} y={P} height={H - 2 * P} />
      )}
      <line className="mark" x1={P} x2={Wd - P} y1={y63} y2={y63} />
      <text className="label" x={Wd - P} y={y63 - 6} textAnchor="end">63 %</text>
      <line className="mark" x1={sx(x.t63)} x2={sx(x.t63)} y1={y63} y2={H - P} />
      <text className="label" x={sx(x.t63)} y={H - 10} textAnchor="middle">τ</text>
      {[2, 3, 4].map((k) => <text key={k} className="label dim" x={sx(k * x.tau)} y={H - 10} textAnchor="middle">{k}τ</text>)}
      <path className="trace" d={d} />
      <text className="label dim" x={P + 4} y={P - 8}>9 V</text>
      <text className="label dim" x={Wd - P} y={P - 8} textAnchor="end">{formatSI(x.span, 's')}</text>
    </svg>
  );
}

export function Lab({ spec }: { spec: LabSpec }) {
  switch (spec.kind) {
    case 'ohm': return <OhmLab spec={spec} />;
    case 'led': return <LedLab spec={spec} />;
    case 'pair': return <PairLab spec={spec} />;
    case 'divider': return <DividerLab spec={spec} />;
    case 'rc': return <RcLab spec={spec} />;
  }
}
