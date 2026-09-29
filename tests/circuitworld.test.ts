import { describe, expect, it } from 'vitest';
import { analyzeBoard, type BoardState } from '../src/breadboard/model';
import { spawnWalker, step, walkLink, walkToward } from '../src/circuitworld/walker';
import { buildWorld, floorsAt, resistorWidth } from '../src/circuitworld/world';
import { startingBoard, WORLD0 } from '../src/levels';

const [L1, L2, , L4, L5] = WORLD0 as [typeof WORLD0[0], typeof WORLD0[0], typeof WORLD0[0], typeof WORLD0[0], typeof WORLD0[0]];
const world = (b: BoardState) => buildWorld(b, analyzeBoard(b));
const flipped = (b: BoardState, id: string) => ({ ...b, parts: b.parts.map((p) => (p.id === id ? { ...p, h1: p.h2, h2: p.h1 } : p)) });

describe('voltage is height', () => {
  it('stands every plaza at its voltage, with the floor at 0 m', () => {
    const w = world(flipped(startingBoard(L2), 'LED1'));
    expect(w.plazas.map((p) => Number(p.height.toFixed(2)))).toEqual([5, 2, 0]);
    expect(w.links.map((l) => l.kind)).toEqual(['stair', 'ramp', 'door']);
  });

  it('gives back everything the stair climbs, round the loop (KVL)', () => {
    for (const b of [flipped(startingBoard(L2), 'LED1'), (() => { const x = startingBoard(L1); x.parts.push({ id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g12', ohms: 330 }); return x; })()]) {
      const w = world(b);
      const rise = w.links[0]!.h1 - w.links[0]!.h0;
      const fall = w.links.slice(1).filter((l) => !l.side).reduce((s, l) => s + (l.h0 - l.h1), 0);
      expect(fall).toBeCloseTo(rise, 3);
    }
  });

  it('stacks the whole supply in front of a backwards LED, whose door is shut', () => {
    const w = world(startingBoard(L2));
    const door = w.links.find((l) => l.id === 'LED1')!;
    expect(door.passable).toBe(false);
    expect(door.h0 - door.h1).toBeCloseTo(5, 2);
    // Nothing flows, so the resistor's ramp is flat.
    const r1 = w.links.find((l) => l.id === 'R1')!;
    expect(r1.h0).toBeCloseTo(r1.h1, 3);
  });

  it('ends an open loop in a chasm, and puts a bleed resistor on a side path', () => {
    expect(world(startingBoard(L1)).links.some((l) => l.kind === 'chasm')).toBe(true);
    const b5 = startingBoard(L5);
    b5.parts.push({ id: 'R1', kind: 'resistor', h1: 'i6', h2: 'i14', ohms: 10000 });
    const w5 = world(b5);
    expect(w5.links.find((l) => l.id === 'R2')?.side).toBe(true);
    expect(w5.links.find((l) => l.id === 'C1')?.kind).toBe('reservoir');
    expect(w5.links.find((l) => l.id === 'SW1')?.kind).toBe('bridge');
  });

  it('makes bigger resistors narrower passages', () => {
    expect(resistorWidth(100)).toBeGreaterThan(resistorWidth(1000));
    expect(resistorWidth(1000)).toBeGreaterThan(resistorWidth(100000));
    expect(resistorWidth(100000)).toBeGreaterThanOrEqual(0.8);
  });

  it('builds the divider level with its tap plaza up the hill', () => {
    const b = startingBoard(L4);
    b.parts.push({ id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g14', ohms: 2200 }, { id: 'R2', kind: 'resistor', h1: 'h14', h2: 'h25', ohms: 1000 });
    const w = world(b);
    const tap = w.plazas.find((p) => p.volts !== undefined && p.volts > 2 && p.volts < 3.5);
    expect(tap?.height).toBeCloseTo(9 * 1000 / 3200, 1);
  });
});

describe('walking the circuit', () => {
  it('walks down the loop of a working circuit, stepping off the LED ledge', () => {
    const w = world(flipped(startingBoard(L2), 'LED1'));
    const s = spawnWalker(w);
    expect(s.y).toBeCloseTo(5, 3);
    expect(walkLink(w, s, 1)).toBe(true); // down R1's ramp
    expect(s.y).toBeCloseTo(2, 1);
    expect(walkLink(w, s, 2)).toBe(true); // through the door and off the ledge
    expect(s.y).toBeCloseTo(0, 1);
  });

  it('stops at a shut door', () => {
    const w = world(startingBoard(L2));
    const s = spawnWalker(w);
    expect(walkLink(w, s, 1)).toBe(true);
    expect(walkLink(w, s, 2, 6)).toBe(false);
    const door = w.links[2]!;
    // Still on the high side of it.
    expect(s.y).toBeCloseTo(door.h0, 1);
  });

  it("can't climb a ledge back up, but can climb the supply's stair", () => {
    const w = world(flipped(startingBoard(L2), 'LED1'));
    const s = spawnWalker(w);
    walkLink(w, s, 1);
    walkLink(w, s, 2);
    const door = w.links[2]!;
    // Back toward the door from below: the ledge is 2 m, too high to step up.
    const [bx, bz] = door.path[0]!;
    expect(walkToward(w, s, bx, bz, 6)).toBe(false);
    expect(s.y).toBeCloseTo(0, 1);
    // The stair takes you back up to the supply's plaza.
    expect(walkLink(w, s, 0)).toBe(true);
    expect(s.y).toBeCloseTo(5, 1);
  });

  it("stays inside the world: walking off into nothing is a wall", () => {
    const w = world(flipped(startingBoard(L2), 'LED1'));
    const s = spawnWalker(w);
    // Face straight out from the ring's centre and walk.
    s.yaw = Math.atan2(-s.z, s.x);
    for (let i = 0; i < 300; i++) step(w, s, { forward: 1, strafe: 0, sprint: false, crouch: false }, 1 / 60);
    expect(floorsAt(w, s.x, s.z).length).toBeGreaterThan(0);
    expect(s.y).toBeCloseTo(5, 3);
  });
});

describe('a fix inside', () => {
  it('moves the heights but not the plazas', () => {
    const before = world(startingBoard(L2));
    const after = world(flipped(startingBoard(L2), 'LED1'));
    expect(after.plazas.map((p) => p.center)).toEqual(before.plazas.map((p) => p.center));
    expect(after.plazas[1]!.height).not.toBeCloseTo(before.plazas[1]!.height, 1);
  });
});

describe('using things and finding the way', () => {
  it('offers the door to turn round, and the power panel', async () => {
    const { targets } = await import('../src/circuitworld/interact');
    const t = targets(world(startingBoard(L2)));
    expect(t.map((x) => x.kind).sort()).toEqual(['door', 'panel']);
    expect(targets(world(flipped(startingBoard(L2), 'LED1'))).map((x) => x.kind)).toEqual(['panel']);
  });

  it('routes to a place along passable links, never through a shut door', async () => {
    const { routeTo } = await import('../src/circuitworld/interact');
    const shut = world(startingBoard(L2));
    const s = spawnWalker(shut);
    expect(routeTo(shut, s, 1).length).toBeGreaterThan(1);
    // With the door shut, the floor is still reachable, but only back down the supply's stair.
    const down = routeTo(shut, s, 2);
    const door = shut.links[2]!;
    expect(down.some((p) => door.path.includes(p))).toBe(false);
    expect(down.some((p) => shut.links[0]!.path.includes(p))).toBe(true);
    const open = world(flipped(startingBoard(L2), 'LED1'));
    expect(routeTo(open, spawnWalker(open), 2).length).toBeGreaterThan(2);
  });
});
