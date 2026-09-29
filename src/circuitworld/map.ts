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
import { SUPPLY_ID, type BoardAnalysis, type BoardPart, type BoardState } from '../breadboard/model';

export type RoomKind = 'source' | 'resistor' | 'led' | 'button' | 'capacitor' | 'battery' | 'generator';

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
}

export interface CircuitMap {
  /** Rooms in loop order, starting at the source. */
  loop: Room[];
  /** Parts on the board that aren't on the main loop. */
  side: Room[];
  /** Voltage of the corridor after each loop room (index i joins loop[i] to loop[i + 1]). */
  corridors: { v: number | undefined }[];
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
};
const tidy = (a: number) => (Math.abs(a) < 1e-9 ? 0 : a);

export function buildMap(board: BoardState, analysis: BoardAnalysis): CircuitMap {
  // Nets: strips joined by jumper wires (the wires are corridors, not rooms).
  const uf = new UnionFind();
  for (const p of board.parts) if (p.kind === 'wire') uf.union(hole(p.h1).strip, hole(p.h2).strip);
  const net = (h: string) => uf.find(hole(h).strip);
  const plus = uf.find('T+'), ground = uf.find('T-');
  const r = analysis.result;
  const v = (h: string) => (r.ok ? r.nodeVoltages[analysis.nodeOf(h)] : undefined);

  const rooms = board.parts.filter((p) => KIND[p.kind]);
  const used = new Set<string>();
  const loop: Room[] = [{
    id: SUPPLY_ID, kind: 'source', label: `Supply · ${board.supply.volts} V`,
    vIn: 0, vOut: board.supply.on ? board.supply.volts : 0, amps: tidy(-(r.currents[SUPPLY_ID] ?? 0)),
  }];
  const corridors: { v: number | undefined }[] = [];
  let at = plus;
  let closed = false;
  let entryVolts = board.supply.on ? board.supply.volts : undefined;
  for (let guard = 0; guard < rooms.length + 1; guard++) {
    corridors.push({ v: entryVolts });
    if (at === ground) { closed = true; break; }
    const next = rooms.find((p) => !used.has(p.id) && (net(p.h1) === at || net(p.h2) === at));
    if (!next) break;
    used.add(next.id);
    const inLeg = net(next.h1) === at ? 'h1' : 'h2';
    const outLeg = inLeg === 'h1' ? 'h2' : 'h1';
    // Currents from the solver run h1 → h2; flip the sign when we walk it h2 → h1.
    const amps = tidy((r.currents[next.id] ?? 0) * (inLeg === 'h1' ? 1 : -1));
    const room = describe(next, v(next[inLeg]), v(next[outLeg]), amps);
    if (next.kind === 'led') {
      // The door opens from anode (h1) to cathode (h2): forward if we come in at the anode.
      room.forward = inLeg === 'h1';
      if (!room.forward && !next.burnt) room.fault = 'reversed';
    }
    loop.push(room);
    at = net(next[outLeg]);
    entryVolts = v(next[outLeg]);
  }
  // The last corridor runs back to the supply's − terminal.
  if (!closed) corridors.push({ v: undefined });

  const side = rooms.filter((p) => !used.has(p.id)).map((p) => describe(p, v(p.h1), v(p.h2), tidy(r.currents[p.id] ?? 0)));
  const faults = [...loop, ...side].filter((x) => x.fault).map((x) => x.id);
  const amps = closed ? Math.min(...loop.slice(1).map((x) => Math.abs(x.amps))) : 0;
  return { loop, side, corridors, closed, amps: tidy(amps), faults };
}

function describe(p: BoardPart, vIn: number | undefined, vOut: number | undefined, amps: number): Room {
  const kind = KIND[p.kind]!;
  const room: Room = { id: p.id, kind, label: p.id, vIn, vOut, amps };
  if (p.kind === 'resistor') room.label = `${p.id} · ${fmtOhms(p.ohms ?? 1000)}`;
  if (p.kind === 'led') {
    room.label = `${p.id} · ${p.color ?? 'red'}`;
    room.color = p.color ?? 'red';
    room.lit = !p.burnt && amps > 1e-3;
    if (p.burnt) room.fault = 'burnt';
  }
  return room;
}

const fmtOhms = (o: number) => (o >= 1000 ? `${Number((o / 1000).toPrecision(3))} kΩ` : `${o} Ω`);
