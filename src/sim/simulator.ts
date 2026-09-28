/**
 * Stateful wrapper for real-time use: keeps capacitor voltages and diode states between
 * steps so the electron view can call `step(dt)` every frame.
 */

import { capacitorVoltages, solve } from './mna';
import type { Circuit, DiodeState, NodeId, SolveResult } from './types';

export interface Sample {
  t: number;
  nodeVoltages: Record<NodeId, number>;
  currents: Record<string, number>;
}

export class Simulator {
  private caps: Record<string, number> = {};
  private diodes: Record<string, DiodeState> = {};
  private t = 0;
  last: SolveResult | null = null;

  constructor(public circuit: Circuit) {
    for (const c of circuit.components) {
      if (c.kind === 'capacitor') this.caps[c.id] = c.initialVolts ?? 0;
    }
  }

  get time() {
    return this.t;
  }

  /** Replace the circuit (e.g. the player moved a part). Keeps capacitor charge by id. */
  setCircuit(circuit: Circuit) {
    const caps: Record<string, number> = {};
    for (const c of circuit.components) {
      if (c.kind === 'capacitor') caps[c.id] = this.caps[c.id] ?? c.initialVolts ?? 0;
    }
    this.circuit = circuit;
    this.caps = caps;
  }

  /** DC operating point: capacitors treated as open circuits. Does not advance time. */
  operatingPoint(): SolveResult {
    this.last = solve(this.circuit, { diodeGuess: this.diodes, time: this.t });
    this.diodes = this.last.diodeStates;
    return this.last;
  }

  /** Advance the simulation by `dt` seconds. */
  step(dt: number): SolveResult {
    const t = this.t + dt;
    const r = solve(this.circuit, { dt, capVoltages: this.caps, diodeGuess: this.diodes, time: t });
    if (r.ok) {
      this.caps = capacitorVoltages(this.circuit, r);
      this.diodes = r.diodeStates;
      this.t = t;
    }
    this.last = r;
    return r;
  }

  /** Run for `duration` seconds in steps of `dt`, returning every `every`-th sample. */
  run(duration: number, dt: number, every = 1): Sample[] {
    const samples: Sample[] = [];
    const steps = Math.round(duration / dt);
    for (let i = 1; i <= steps; i++) {
      const r = this.step(dt);
      if (!r.ok) break;
      if (i % every === 0 || i === steps) {
        samples.push({ t: r.time, nodeVoltages: r.nodeVoltages, currents: r.currents });
      }
    }
    return samples;
  }
}
