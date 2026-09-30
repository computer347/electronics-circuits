/**
 * "Clear the circuit": the level's solved board as a top-down map. Parts are rooms, the nets
 * between them are corridors, and faults look like what they do (a backwards LED is a one-way
 * door facing against the current). Current is shown conventionally, + to −, and the map says so.
 *
 * The map walks the loop from the supply's + terminal: at each net it takes the next part it
 * hasn't visited, leaves by that part's other leg, and stops when it's back at ground. Parts
 * that aren't on that loop are listed as side rooms. World 0 circuits are single loops, which
 * this lays out as a ring.
 */
import { hole } from '../breadboard/layout';
import { currentLegs, SUPPLY_ID, type BoardAnalysis, type BoardPart, type BoardState } from '../breadboard/model';

export type RoomKind = 'source' | 'resistor' | 'led' | 'button' | 'capacitor' | 'battery' | 'generator'
  | 'diode' | 'pot' | 'transistor' | 'regulator';

export type RoomFault =
  /** A diode or LED facing against the current: a one-way door that won't open. */
  | 'reversed'
  /** A burnt-out LED: a scorched room. */
  | 'burnt';

export interface Room {
  id: string;
  kind: RoomKind;
  /** Short name on the door, e.g. "LED1 · red". */
  label: string;
  /** Voltage on the side the current comes in, and the side it leaves. */
  vIn: number | undefined;
  vOut: number | undefined;
  /** Current through the part, in amperes (+ = along the loop). */
  amps: number;
  fault?: RoomFault;
  /** LEDs: colour, and whether it's lit. */
  color?: string;
  lit?: boolean;
  /** For doors (LEDs): true when the door opens the way the current goes round. */
  forward?: boolean;
  /** The nets it joins: where the current comes in, and where it leaves (h1, h2 for side rooms). */
  nets: [string, string];
  /** The board part, for its value and state (undefined for the supply). */
  part?: BoardPart;
}

export interface CircuitMap {
  /** Rooms in loop order, starting at the source. */
  loop: Room[];
  /** Parts on the board that aren't on the main loop. */
  side: Room[];
  /** Voltage of the corridor after each loop room (index i joins loop[i] to loop[i + 1]). */
  corridors: { v: number | undefined; net: string | null }[];
  /** The ground net (the supply's − terminal). */
  ground: string;
  /** The loop is closed: you can walk from + back to − through parts. */
  closed: boolean;
  /** Current round the loop, in amperes. */
  amps: number;
  faults: string[];
}

class UnionFind {
  private p = new Map<string, string>();
  find(x: string): string { const q = this.p.get(x) ?? x; if (q === x) return x; const r = this.find(q); this.p.set(x, r); return r; }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

const KIND: Record<BoardPart['kind'], RoomKind | null> = {
  resistor: 'resistor', led: 'led', wire: null, button: 'button', battery: 'battery', capacitor: 'capacitor', generator: 'generator',
  diode: 'diode', pot: 'pot', npn: 'transistor', nmos: 'transistor', regulator: 'regulator',
};
/** A three-legged part walks like a two-legged one between its main legs (collector → emitter...). */
const mainLegs = (p: BoardPart): BoardPart => {
  if (!p.h3) return p;
  const [h1, h2] = currentLegs(p);
  return { ...p, h1, h2 };
};
/** Doors: LEDs, diodes and transistors let the loop through one way, when they conduct. */
const DOORS: readonly BoardPart['kind'][] = ['led', 'diode', 'npn', 'nmos'];
const tidy = (a: number) => (Math.abs(a) < 1e-9 ? 0 : a);

export function buildMap(board: BoardState, analysis: BoardAnalysis): CircuitMap {
  // Nets: strips joined by jumper wires (the wires are corridors, not rooms).
  const uf = new UnionFind();
  for (const p of board.parts) if (p.kind === 'wire') uf.union(hole(p.h1).strip, hole(p.h2).strip);
  const net = (h: string) => uf.find(hole(h).strip);
  const r = analysis.result;
  const v = (h: string) => (r.ok ? r.nodeVoltages[analysis.nodeOf(h)] : undefined);
  const rooms = board.parts.filter((p) => KIND[p.kind]).map(mainLegs);
  const used = new Set<string>();

  // The loop starts at the source: the bench supply when it's on, else the battery (or
  // generator) whose − sits on ground, else the first one.
  const cells = board.parts.filter((p) => p.kind === 'battery' || p.kind === 'generator');
  const cell = board.supply.on ? undefined
    : cells.find((p) => hole(p.h2).strip === 'T-' || uf.find(hole(p.h2).strip) === uf.find('T-')) ?? cells[0];
  let plus: string, ground: string;
  let loop: Room[];
  let entryVolts: number | undefined;
  if (cell) {
    used.add(cell.id);
    plus = net(cell.h1); ground = net(cell.h2);
    const room = describe(cell, v(cell.h2), v(cell.h1), tidy(-(r.currents[cell.id] ?? 0)), [ground, plus]);
    loop = [room];
    entryVolts = v(cell.h1);
  } else {
    plus = uf.find('T+'); ground = uf.find('T-');
    loop = [{
      id: SUPPLY_ID, kind: 'source', label: `Supply · ${board.supply.volts} V`,
      vIn: 0, vOut: board.supply.on ? board.supply.volts : 0, amps: tidy(-(r.currents[SUPPLY_ID] ?? 0)),
      nets: [ground, plus],
    }];
    entryVolts = board.supply.on ? board.supply.volts : undefined;
  }
  const corridors: { v: number | undefined; net: string | null }[] = [];
  let at = plus;
  let closed = false;
  for (let guard = 0; guard < rooms.length + 1; guard++) {
    corridors.push({ v: entryVolts, net: at });
    if (at === ground) { closed = true; break; }
    const next = rooms.find((p) => !used.has(p.id) && (net(p.h1) === at || net(p.h2) === at));
    if (!next) break;
    used.add(next.id);
    const inLeg = net(next.h1) === at ? 'h1' : 'h2';
    const outLeg = inLeg === 'h1' ? 'h2' : 'h1';
    // Currents from the solver run h1 → h2; flip the sign when we walk it h2 → h1.
    const amps = tidy((r.currents[next.id] ?? 0) * (inLeg === 'h1' ? 1 : -1));
    const room = describe(next, v(next[inLeg]), v(next[outLeg]), amps, [net(next[inLeg]), net(next[outLeg])]);
    if (DOORS.includes(next.kind)) {
      // The door opens from anode (h1) to cathode (h2), collector to emitter: forward if we come in at h1.
      room.forward = inLeg === 'h1';
      if (!room.forward && !next.burnt) room.fault = 'reversed';
    }
    // A cell pushes the loop along when it's met − first. Met + first, it pushes against it.
    if (next.kind === 'battery' && inLeg === 'h1') { room.fault = 'reversed'; room.forward = false; }
    loop.push(room);
    at = net(next[outLeg]);
    entryVolts = v(next[outLeg]);
  }
  // The last corridor runs back to the supply's − terminal.
  if (!closed) corridors.push({ v: undefined, net: null });

  const side = rooms.filter((p) => !used.has(p.id)).map((p) => describe(p, v(p.h1), v(p.h2), tidy(r.currents[p.id] ?? 0), [net(p.h1), net(p.h2)]));
  const faults = [...loop, ...side].filter((x) => x.fault).map((x) => x.id);
  const amps = closed ? Math.min(...loop.slice(1).map((x) => Math.abs(x.amps))) : 0;
  return { loop, side, corridors, closed, amps: tidy(amps), faults, ground };
}

function describe(p: BoardPart, vIn: number | undefined, vOut: number | undefined, amps: number, nets: [string, string]): Room {
  const kind = KIND[p.kind]!;
  const room: Room = { id: p.id, kind, label: p.id, vIn, vOut, amps, nets, part: p };
  if (p.kind === 'resistor' || p.kind === 'pot') room.label = `${p.id} · ${fmtOhms(p.ohms ?? (p.kind === 'pot' ? 10000 : 1000))}`;
  if (p.marking && p.kind !== 'pot') room.label = `${p.id} · ${p.marking}`;
  if (p.kind === 'diode' || p.kind === 'npn' || p.kind === 'nmos') room.lit = Math.abs(amps) > 1e-4;
  if (p.kind === 'led') {
    room.label = `${p.id} · ${p.color ?? 'red'}`;
    room.color = p.color ?? 'red';
    room.lit = !p.burnt && amps > 1e-3;
    if (p.burnt) room.fault = 'burnt';
  }
  return room;
}

const fmtOhms = (o: number) => (o >= 1000 ? `${Number((o / 1000).toPrecision(3))} kΩ` : `${o} Ω`);
