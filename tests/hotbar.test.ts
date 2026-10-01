import { describe, expect, it } from 'vitest';
import { WORLD0 } from '../src/levels';
import { activeSlot, benchSlots, DRAWERS, drawerOf, levelSlots, MAX_SLOTS, slotForKey } from '../src/desk/hotbarSlots';

describe('hotbar', () => {
  it('gives each level the hand, its parts in order, then its instruments, numbered from 1', () => {
    const l1 = levelSlots(WORLD0[0]!); // tools: resistor, wire, probe
    expect(l1.map((s) => s.id)).toEqual(['select', 'resistor', 'wire', 'meter']);
    expect(l1.map((s) => s.key)).toEqual([1, 2, 3, 4]);
    const l5 = levelSlots(WORLD0[4]!); // resistor, wire, probe, scope
    expect(l5.map((s) => s.id)).toEqual(['select', 'resistor', 'wire', 'meter', 'scope']);
  });

  it('never holds more than eight slots, and parts give way before instruments do', () => {
    const many = levelSlots({ tools: ['resistor', 'wire', 'led', 'capacitor', 'button', 'battery', 'diode', 'pot', 'npn', 'probe', 'scope'] });
    expect(many).toHaveLength(MAX_SLOTS);
    expect(many.slice(-2).map((s) => s.id)).toEqual(['meter', 'scope']);
    for (const l of WORLD0) expect(levelSlots(l).length).toBeLessThanOrEqual(MAX_SLOTS);
  });

  it('lights the tool in hand, or the instrument you are at', () => {
    const slots = levelSlots(WORLD0[4]!);
    expect(activeSlot(slots, 'resistor', 'breadboard')).toBe('resistor');
    expect(activeSlot(slots, 'probe', 'meter')).toBe('meter');
    expect(activeSlot(slots, 'scope', 'scope')).toBe('scope');
  });

  it('picks slots by number key, and ignores other keys', () => {
    const slots = levelSlots(WORLD0[0]!);
    expect(slotForKey(slots, '2')?.id).toBe('resistor');
    expect(slotForKey(slots, '9')).toBeUndefined();
    expect(slotForKey(slots, 'a')).toBeUndefined();
  });

  it('puts every placeable part in exactly one free-bench drawer', () => {
    const all = DRAWERS.flatMap((d) => d.tools);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(['battery', 'button', 'capacitor', 'diode', 'generator', 'led', 'nmos', 'npn', 'pot', 'regulator', 'resistor', 'spdt', 'toggle', 'wire']);
    for (let i = 0; i < DRAWERS.length; i++) expect(benchSlots(i).length).toBeLessThanOrEqual(MAX_SLOTS);
    expect(drawerOf('npn')).toBe(2);
    expect(drawerOf('select')).toBe(-1);
  });
});
