/**
 * Superposition breakdown: how much of each current and voltage comes from each source.
 *
 * The circuit is re-solved once per source with every other source switched off
 * (voltage sources shorted, current sources opened). The results add up exactly because
 * the circuit is linear. Diodes aren't linear, so they are frozen in the on/off states of
 * the full solve; each conducting diode then acts as a fixed drop, and those drops get
 * their own entry (DIODE_KEY). The parts always sum to the full answer, but the split is
 * only valid at this operating point.
 */

import { solve } from './mna';
import type { Circuit, SolveResult } from './types';

export const DIODE_KEY = 'diode drops';

export interface Contributions {
  /** Contribution keys in order: source ids, then DIODE_KEY if any diode conducts. */
  keys: string[];
  /** currents[componentId][key] in amperes (a -> b). */
  currents: Record<string, Record<string, number>>;
  /** voltages[node][key] in volts. */
  voltages: Record<string, Record<string, number>>;
}

export function contributions(circuit: Circuit, full: SolveResult): Contributions | null {
  if (!full.ok) return null;
  const sources = circuit.components.filter((c) => c.kind === 'vsource' || c.kind === 'isource').map((c) => c.id);
  const anyOn = Object.values(full.diodeStates).some((s) => s === 'on');
  const keys = [...sources, ...(anyOn ? [DIODE_KEY] : [])];
  const currents: Contributions['currents'] = {};
  const voltages: Contributions['voltages'] = {};

  for (const key of keys) {
    const zero = new Set(sources.filter((s) => s !== key));
    const r = solve(circuit, {
      zeroSources: zero,
      fixedDiodeStates: full.diodeStates,
      zeroDiodeOffsets: key !== DIODE_KEY,
    });
    if (!r.ok) return null;
    for (const [id, i] of Object.entries(r.currents)) (currents[id] ??= {})[key] = i;
    for (const [n, v] of Object.entries(r.nodeVoltages)) (voltages[n] ??= {})[key] = v;
  }
  return { keys, currents, voltages };
}
