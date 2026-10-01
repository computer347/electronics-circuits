/**
 * The breadboard's controls on the desk, kept to a handful: pick up a part from this level's
 * box (at most three choices), set a resistor's value with the colour bands shown, and act on
 * the selected part (turn it round, change it, take it out). Pictures and one word each.
 */
import { colorBands } from '../breadboard/colorCode';
import type { BoardPartKind } from '../breadboard/model';
import { useBench, type Tool } from '../breadboard/store';
import { formatSI } from '../lib/units';
import type { LevelDef } from '../levels/types';

const BOX_TOOLS: BoardPartKind[] = ['resistor', 'wire', 'led', 'capacitor', 'button', 'toggle', 'diode', 'pot', 'npn', 'nmos', 'regulator', 'battery', 'generator'];
export const TOOL_LABEL: Partial<Record<Tool, string>> = {
  select: 'Hand', resistor: 'Resistor', wire: 'Wire', led: 'LED', capacitor: 'Capacitor', button: 'Button', battery: 'Battery', generator: 'Signal gen',
  diode: 'Diode', pot: 'Pot', npn: 'Transistor', nmos: 'MOSFET', regulator: 'Regulator', toggle: 'Toggle',
};
const FLIPPABLE: BoardPartKind[] = ['led', 'capacitor', 'battery', 'diode', 'pot', 'npn', 'nmos', 'regulator'];

export function ToolIcon({ tool }: { tool: Tool }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tool === 'resistor') return <svg viewBox="0 0 32 20" aria-hidden><path d="M1 10h7M24 10h7" {...s} /><rect x="8" y="5" width="16" height="10" rx="4" fill="#e7b863" stroke="currentColor" strokeWidth="2" /><path d="M12 5v10M15 5v10M19 5v10" stroke="#7a4a22" strokeWidth="2" /></svg>;
  if (tool === 'wire') return <svg viewBox="0 0 32 20" aria-hidden><path d="M3 16 C 8 0, 24 0, 29 16" {...s} stroke="#c87533" strokeWidth="3.2" /></svg>;
  if (tool === 'led') return <svg viewBox="0 0 32 20" aria-hidden><path d="M10 12 a6 6 0 0 1 12 0 v6 h-12z" fill="#ff3b30" /><path d="M13 18v2M19 18v2" {...s} /></svg>;
  if (tool === 'capacitor') return <svg viewBox="0 0 32 20" aria-hidden><rect x="10" y="2" width="12" height="15" rx="3" fill="#2f6fc0" /><path d="M14 17v3M18 17v3" {...s} /></svg>;
  if (tool === 'battery') return <svg viewBox="0 0 32 20" aria-hidden><rect x="6" y="5" width="18" height="11" rx="1.5" fill="#1b1b1b" /><rect x="6" y="5" width="7" height="11" fill="#e57b23" /><rect x="24" y="8" width="3" height="5" fill="#999" /></svg>;
  if (tool === 'generator') return <svg viewBox="0 0 32 20" aria-hidden><rect x="3" y="2" width="26" height="16" rx="2" fill="#2b2e31" /><path d="M6 13 l4 -6 l4 6 l4 -6 l4 6 l4 -6" fill="none" stroke="#ffd21f" strokeWidth="2" /></svg>;
  if (tool === 'diode') return <svg viewBox="0 0 32 20" aria-hidden><path d="M1 10h9M22 10h9" {...s} /><rect x="10" y="6" width="12" height="8" rx="3" fill="#e0703a" /><rect x="18" y="6" width="2.5" height="8" fill="#111" /></svg>;
  if (tool === 'pot') return <svg viewBox="0 0 32 20" aria-hidden><rect x="7" y="6" width="18" height="11" rx="1.5" fill="#1f5fa8" /><circle cx="16" cy="7" r="5" fill="#1c1c1e" /><path d="M16 7 V3" stroke="#ffe800" strokeWidth="1.6" /></svg>;
  if (tool === 'npn') return <svg viewBox="0 0 32 20" aria-hidden><path d="M9 14 V6 a7 7 0 0 1 14 0 V14 z" fill="#1c1c1e" /><path d="M12 14v6M16 14v6M20 14v6" {...s} /></svg>;
  if (tool === 'nmos' || tool === 'regulator') return <svg viewBox="0 0 32 20" aria-hidden><rect x="9" y="1" width="14" height="6" fill="#b8bec6" /><rect x="9" y="6" width="14" height="9" fill="#1c1c1e" /><path d="M12 15v5M16 15v5M20 15v5" {...s} /><text x="16" y="13" fontSize="5" fill="#ddd" textAnchor="middle">{tool === 'nmos' ? 'FET' : '5V'}</text></svg>;
  if (tool === 'probe') return <svg viewBox="0 0 32 20" aria-hidden><rect x="9" y="1" width="14" height="18" rx="2" fill="#f2c200" /><rect x="11" y="3" width="10" height="5" fill="#b9c7a3" /><circle cx="16" cy="13" r="3" fill="#222" /></svg>;
  if (tool === 'scope') return <svg viewBox="0 0 32 20" aria-hidden><rect x="3" y="2" width="26" height="16" rx="2" fill="#2b2e31" /><rect x="5" y="4" width="16" height="12" fill="#10231a" /><path d="M6 12 q3 -8 6 0 t6 0" fill="none" stroke="#ffd21f" strokeWidth="1.6" /><circle cx="25" cy="7" r="1.6" fill="#ddd" /><circle cx="25" cy="13" r="1.6" fill="#ddd" /></svg>;
  if (tool === 'toggle') return <svg viewBox="0 0 32 20" aria-hidden><rect x="5" y="7" width="22" height="8" rx="1" fill="#b9bdc2" /><rect x="17" y="3" width="7" height="6" fill="#1c1c1e" /><path d="M9 15v4M23 15v4" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>;
  if (tool === 'button') return <svg viewBox="0 0 32 20" aria-hidden><rect x="8" y="6" width="16" height="10" fill="#222" /><circle cx="16" cy="11" r="3.5" fill="#0078bf" /></svg>;
  return <svg viewBox="0 0 32 20" aria-hidden><path d="M12 18 V6 a2 2 0 0 1 4 0 v6 M16 11 V4 a2 2 0 0 1 4 0 v8 M20 11 a2 2 0 0 1 4 0 v3 c0 4 -3 5 -6 5 h-3 c-2 0 -4 -2 -5 -4 l-2 -4 a2 2 0 0 1 3 -2 l1 2" {...s} /></svg>;
}

function Bands({ ohms }: { ohms: number }) {
  const b = colorBands(ohms);
  return <span className="tray-bands" aria-label={b.names.join(' ')}>{b.colors.map((c, i) => <i key={i} style={{ background: c }} />)}</span>;
}

/** ‹ 330 Ω › with the colour code, stepping through the level's values. */
export function OhmsStepper({ value, values, onChange }: { value: number; values: number[]; onChange: (o: number) => void }) {
  const i = Math.max(0, values.findIndex((v) => v >= value));
  return (
    <span className="tray-stepper">
      <button onClick={() => onChange(values[Math.max(0, i - 1)]!)} disabled={i === 0} aria-label="Smaller">‹</button>
      <b>{formatSI(value, 'Ω')}</b><Bands ohms={value} />
      <button onClick={() => onChange(values[Math.min(values.length - 1, i + 1)]!)} disabled={i >= values.length - 1} aria-label="Bigger">›</button>
    </span>
  );
}

export function PartsTray({ level }: { level: LevelDef }) {
  const tool = useBench((s) => s.tool);
  const ohms = useBench((s) => s.ohms);
  const pending = useBench((s) => s.pending);
  const selected = useBench((s) => s.selected);
  const parts = useBench((s) => s.parts);
  const locked = useBench((s) => s.locked);
  const pinned = useBench((s) => s.pinned);
  const spares = useBench((s) => s.spares);
  const bench = useBench.getState();
  const values = level.resistorValues ?? [100, 220, 330, 470, 1000, 2200, 4700, 10000];
  const hasParts = level.tools.some((t) => BOX_TOOLS.includes(t as BoardPartKind));
  const part = parts.find((p) => p.id === selected);
  const isLocked = !!part && locked.includes(part.id);
  const isPinned = !!part && pinned.includes(part.id);

  return (
    <>
      <div className="tray-context">
        {tool === 'resistor' && <OhmsStepper value={ohms} values={values} onChange={(o) => bench.setOhms(o)} />}
        {tool !== 'select' && <span className="desk-pict"><span className="dot pink" /> {pending ? 'now the second hole' : 'click two holes'}</span>}
        {tool === 'select' && part && !isLocked && (
          <>
            {part.kind === 'resistor' && !isPinned && <OhmsStepper value={part.ohms ?? 1000} values={values} onChange={(o) => bench.updatePart(part.id, { ohms: o })} />}
            {FLIPPABLE.includes(part.kind) && <button className="desk-chip" onClick={() => bench.flipPart(part.id)}>↻ Turn {part.id} round</button>}
            {part.kind === 'led' && part.burnt && (spares === 0
              ? <span className="desk-pict">No spare LEDs left: restart the level for a fresh set</span>
              : <button className="desk-chip" onClick={() => bench.replaceLed(part.id)}>Fit a new LED{spares !== null ? ` (${spares} left)` : ''}</button>)}
            {!isPinned && <button className="tray-remove" onClick={() => bench.removeSelected()}>Take out</button>}
          </>
        )}
        {tool === 'select' && (!part || isLocked) && <span className="desk-pict"><span className="dot pink" /> {hasParts ? 'pick a part from the bar, or click one on the board' : 'click a part'}</span>}
      </div>
    </>
  );
}
