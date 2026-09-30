/**
 * The hotbar on screen: numbered slots, the lit one is what's in your hand (or the instrument
 * you're at). Click a slot or press its number. `HotbarRow` is the bare row, used by any bench
 * (the breadboard desk, the repair mat); `Hotbar` is the desk's, wired to its stores.
 */
import { useEffect, type ReactNode } from 'react';
import { useBench } from '../breadboard/store';
import { activeSlot, DRAWERS, slotForKey, type Slot } from './hotbarSlots';
import { ToolIcon } from './PartsTray';
import { useDesk } from './store';

export interface RowSlot { id: string; key: number; label: string; icon: ReactNode }

export function HotbarRow({ slots, lit, onPick, children }: { slots: RowSlot[]; lit?: string; onPick: (id: string) => void; children?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = slotForKey(slots, e.key);
      if (s) { e.preventDefault(); onPick(s.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots, onPick]);
  return (
    <div className="hotbar" role="toolbar" aria-label="Hotbar">
      {slots.map((s) => (
        <button key={s.id} className={s.id === lit ? 'on' : ''} onClick={() => onPick(s.id)} aria-pressed={s.id === lit} title={`${s.label} (${s.key})`}>
          <kbd>{s.key}</kbd>
          {s.icon}
          <span>{s.label}</span>
        </button>
      ))}
      {children}
    </div>
  );
}

export function pickSlot(s: Slot) {
  const desk = useDesk.getState();
  if (s.action.kind === 'focus') { if (desk.focus !== s.action.object) desk.focusOn(s.action.object); return; }
  if (desk.focus !== 'breadboard') desk.focusOn('breadboard');
  useBench.getState().setTool(s.action.tool);
}

export function Hotbar({ slots, drawer, onDrawer }: { slots: Slot[]; drawer?: number; onDrawer?: (i: number) => void }) {
  const tool = useBench((s) => s.tool);
  const focus = useDesk((s) => s.focus);
  const rows = slots.map((s) => ({ id: s.id, key: s.key, label: s.label, icon: <ToolIcon tool={s.icon} /> }));
  return (
    <HotbarRow slots={rows} lit={activeSlot(slots, tool, focus)} onPick={(id) => { const s = slots.find((x) => x.id === id); if (s) pickSlot(s); }}>
      {onDrawer && (
        <span className="tray-pages" role="tablist" aria-label="Part drawers">
          {DRAWERS.map((d, i) => <button key={d.name} role="tab" aria-selected={i === drawer} className={i === drawer ? 'on' : ''} onClick={() => onDrawer(i)}>{d.name}</button>)}
        </span>
      )}
    </HotbarRow>
  );
}
