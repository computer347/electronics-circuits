/**
 * The hotbar: one numbered row of slots along the bottom whenever you're at the bench. It holds
 * the hand, the parts this level gives you, and the instruments (meter, scope). Keys 1–8 pick
 * a slot. The level decides what's in it, never more than eight (Hick's law: fewer choices,
 * faster choosing). The free bench has more parts than that, so it keeps them in drawers and
 * the hotbar shows the open drawer.
 */
import type { BoardPartKind } from '../breadboard/model';
import type { Tool } from '../breadboard/store';
import type { LevelDef } from '../levels/types';

export const MAX_SLOTS = 8;

export type SlotAction =
  /** Pick up a part, or the hand, on the breadboard. */
  | { kind: 'tool'; tool: Tool }
  /** Go to an instrument. */
  | { kind: 'focus'; object: 'meter' | 'scope' };

export interface Slot {
  id: string;
  /** Number key, 1–8. */
  key: number;
  label: string;
  /** Which picture to draw. */
  icon: Tool;
  action: SlotAction;
}

export const PART_KINDS: readonly BoardPartKind[] = [
  'resistor', 'wire', 'led', 'capacitor', 'button', 'battery', 'generator', 'diode', 'pot', 'npn', 'nmos', 'regulator',
];

const LABEL: Partial<Record<Tool, string>> = {
  select: 'Hand', resistor: 'Resistor', wire: 'Wire', led: 'LED', capacitor: 'Capacitor', button: 'Button', battery: 'Battery',
  generator: 'Signal gen', diode: 'Diode', pot: 'Pot', npn: 'Transistor', nmos: 'MOSFET', regulator: 'Regulator', probe: 'Meter', scope: 'Scope',
};

/** Drawers for the free bench, grouped the way a parts cabinet is. */
export const DRAWERS: { name: string; tools: BoardPartKind[] }[] = [
  { name: 'Basics', tools: ['wire', 'resistor', 'led'] },
  { name: 'Passives', tools: ['button', 'capacitor', 'pot'] },
  { name: 'Semis', tools: ['diode', 'npn', 'nmos'] },
  { name: 'Sources', tools: ['battery', 'generator', 'regulator'] },
];

function build(parts: BoardPartKind[], meter: boolean, scope: boolean): Slot[] {
  const entries: { icon: Tool; action: SlotAction }[] = [
    { icon: 'select', action: { kind: 'tool', tool: 'select' } },
    ...parts.map((p) => ({ icon: p as Tool, action: { kind: 'tool', tool: p } as SlotAction })),
  ];
  // The instruments go last. If eight slots can't hold everything, parts give way to
  // instruments, never the other way round.
  const tail: { icon: Tool; action: SlotAction }[] = [];
  if (meter) tail.push({ icon: 'probe', action: { kind: 'focus', object: 'meter' } });
  if (scope) tail.push({ icon: 'scope', action: { kind: 'focus', object: 'scope' } });
  const all = [...entries.slice(0, MAX_SLOTS - tail.length), ...tail];
  return all.map((e, i) => ({ id: e.action.kind === 'tool' ? e.action.tool : e.action.object, key: i + 1, label: LABEL[e.icon] ?? e.icon, icon: e.icon, action: e.action }));
}

/** A level's hotbar: the hand, the level's parts in the order it lists them, then its instruments. */
export function levelSlots(level: Pick<LevelDef, 'tools'>): Slot[] {
  const parts = level.tools.filter((t): t is BoardPartKind => PART_KINDS.includes(t as BoardPartKind));
  return build(parts, level.tools.includes('probe'), level.tools.includes('scope'));
}

/** The free bench's hotbar: the hand, the open drawer, the meter and the scope. */
export function benchSlots(drawer: number): Slot[] {
  return build(DRAWERS[drawer]?.tools ?? [], true, true);
}

/** The slot that's lit: the instrument you're at, else the tool in hand. */
export function activeSlot(slots: Slot[], tool: Tool, focus: string | null): string | undefined {
  if (focus === 'meter' || focus === 'scope') return slots.find((s) => s.action.kind === 'focus' && s.action.object === focus)?.id;
  return slots.find((s) => s.action.kind === 'tool' && s.action.tool === tool)?.id;
}

/** The slot a key press picks, if any ("1" … "8"). */
export function slotForKey(slots: Slot[], key: string): Slot | undefined {
  const n = Number(key);
  return Number.isInteger(n) ? slots.find((s) => s.key === n) : undefined;
}

/** The drawer holding a tool, for opening the right one when a part is picked up elsewhere. */
export const drawerOf = (tool: Tool) => DRAWERS.findIndex((d) => d.tools.includes(tool as BoardPartKind));
