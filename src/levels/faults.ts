/**
 * Fault injection: turn a working base board into the broken one the player gets.
 * Levels are "base circuit + list of faults", so difficulty can be tuned by adding faults.
 */
import { HOLE_BY_ID } from '../breadboard/layout';
import type { BoardState } from '../breadboard/model';
import type { FaultSpec } from './types';

export class FaultError extends Error {}

export function applyFaults(board: BoardState, faults: readonly FaultSpec[] = []): BoardState {
  let parts = board.parts.map((p) => ({ ...p }));
  const find = (id: string) => {
    const p = parts.find((x) => x.id === id);
    if (!p) throw new FaultError(`Fault refers to a part that isn't on the board: ${id}`);
    return p;
  };
  for (const f of faults) {
    switch (f.kind) {
      case 'reverse': {
        const p = find(f.part);
        [p.h1, p.h2] = [p.h2, p.h1];
        break;
      }
      case 'value': {
        const p = find(f.part);
        if (p.kind !== 'resistor') throw new FaultError(`${f.part} is not a resistor`);
        p.ohms = f.ohms;
        break;
      }
      case 'move-leg': {
        const p = find(f.part);
        if (!HOLE_BY_ID.has(f.to)) throw new FaultError(`No such hole: ${f.to}`);
        const other = f.leg === 'h1' ? p.h2 : p.h1;
        if (f.to === other) throw new FaultError(`${f.part}: both legs in ${f.to}`);
        if (parts.some((q) => q !== p && (q.h1 === f.to || q.h2 === f.to))) throw new FaultError(`Hole ${f.to} is already taken`);
        p[f.leg] = f.to;
        break;
      }
      case 'remove':
        find(f.part);
        parts = parts.filter((p) => p.id !== f.part);
        break;
    }
  }
  return { supply: { ...board.supply }, parts };
}
