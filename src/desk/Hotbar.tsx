/**
 * The hotbar on screen: numbered slots, the lit one is what's in your hand (or the instrument
 * you're at). Click a slot or press its number. On the free bench a row of drawer tabs sits
 * at its end.
 */
import { useEffect } from 'react';
import { useBench } from '../breadboard/store';
import { activeSlot, DRAWERS, slotForKey, type Slot } from './hotbarSlots';
import { ToolIcon } from './PartsTray';
import { useDesk } from './store';

export function pickSlot(s: Slot) {
  const desk = useDesk.getState();
  if (s.action.kind === 'focus') { if (desk.focus !== s.action.object) desk.focusOn(s.action.object); return; }
  if (desk.focus !== 'breadboard') desk.focusOn('breadboard');
  useBench.getState().setTool(s.action.tool);
}

export function Hotbar({ slots, drawer, onDrawer }: { slots: Slot[]; drawer?: number; onDrawer?: (i: number) => void }) {
  const tool = useBench((s) => s.tool);
  const focus = useDesk((s) => s.focus);
  const lit = activeSlot(slots, tool, focus);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = slotForKey(slots, e.key);
      if (s) { e.preventDefault(); pickSlot(s); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots]);

  return (
    <div className="hotbar" role="toolbar" aria-label="Hotbar">
      {slots.map((s) => (
        <button key={s.id} className={s.id === lit ? 'on' : ''} onClick={() => pickSlot(s)} aria-pressed={s.id === lit} title={`${s.label} (${s.key})`}>
          <kbd>{s.key}</kbd>
          <ToolIcon tool={s.icon} />
          <span>{s.label}</span>
        </button>
      ))}
      {onDrawer && (
        <span className="tray-pages" role="tablist" aria-label="Part drawers">
          {DRAWERS.map((d, i) => <button key={d.name} role="tab" aria-selected={i === drawer} className={i === drawer ? 'on' : ''} onClick={() => onDrawer(i)}>{d.name}</button>)}
        </span>
      )}
    </div>
  );
}
