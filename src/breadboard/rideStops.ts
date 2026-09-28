/**
 * Step-by-step ride: the electron stops at each component and the HUD explains what happens
 * there. Pure functions, so the wording and the numbers can be tested without a 3D scene.
 */
import { formatSI } from '../lib/units';
import { LED_VF } from '../sim';
import type { FlowEdge } from './flow';
import type { BoardAnalysis, BoardPart } from './model';

export interface RideStop {
  /** e.g. "Stop 2 · Resistor". */
  kicker: string;
  title: string;
  body: string;
  figures: [string, string][];
  /** Set when the electron arrives back at a source after a full lap. */
  lap?: LapSummary;
}

/** One entry in the energy ledger for the current lap. */
export interface LapEntry { id: string; volts: number; kind: 'gain' | 'loss' }

export interface LapSummary {
  gained: number;
  losses: { id: string; volts: number }[];
  lost: number;
}

/** Parts worth stopping at. Wires and breadboard strips just carry you to the next one. */
export function isStopEdge(e: FlowEdge): boolean {
  if (e.kind === 'supply') return true;
  return e.kind === 'part' && e.partKind !== undefined && e.partKind !== 'wire';
}

const isSource = (e: FlowEdge) => e.kind === 'supply' || e.partKind === 'battery' || e.partKind === 'generator';

const V = (v: number) => formatSI(Math.abs(v) < 5e-4 ? 0 : v, 'V');
const A = (a: number) => formatSI(Math.abs(a) < 1e-9 ? 0 : Math.abs(a), 'A');
const W = (w: number) => formatSI(Math.abs(w) < 1e-9 ? 0 : Math.abs(w), 'W');

/** Voltage across an edge's two ends. */
export const edgeVolts = (e: FlowEdge, a: BoardAnalysis) => Math.abs((a.voltageAt(e.from) ?? 0) - (a.voltageAt(e.to) ?? 0));

/** What happens at this stop, and how it goes in the lap's energy ledger. */
export function describeStop(e: FlowEdge, part: BoardPart | undefined, a: BoardAnalysis, n: number, conventional: boolean): { stop: RideStop; entry: LapEntry } {
  const who = conventional ? 'charge' : 'electron';
  const volts = edgeVolts(e, a);
  const amps = e.amps;
  const figures: [string, string][] = [['Current', A(amps)], ['Voltage across', V(volts)]];

  if (isSource(e)) {
    const name = e.kind === 'supply' ? 'Bench supply' : part?.kind === 'generator' ? `Function generator ${e.partId}` : `Battery ${e.partId}`;
    figures.push(['Power delivered', W(volts * amps)]);
    return {
      entry: { id: e.partId ?? 'supply', volts, kind: 'gain' },
      stop: {
        kicker: `Stop ${n} · Source`,
        title: name,
        body: conventional
          ? `The source lifts every bit of charge ${V(volts)} uphill, from its − terminal to its + terminal. That's the energy the rest of the loop gets to spend.`
          : `The source pushes each electron in at its + terminal and out of its − terminal, and gives it ${V(volts)} worth of energy to spend around the loop.`,
        figures,
      },
    };
  }

  const id = e.partId ?? e.id;
  const kind = part?.kind;
  const entry: LapEntry = { id, volts, kind: 'loss' };
  if (kind === 'resistor') {
    const ohms = part?.ohms ?? 0;
    figures.push(['Power (heat)', W(volts * amps)], ['Ohm\'s law', `${A(amps)} × ${formatSI(ohms, 'Ω')} = ${V(Math.abs(amps) * ohms)}`]);
    return {
      entry,
      stop: {
        kicker: `Stop ${n} · Resistor`,
        title: `${id} · ${formatSI(ohms, 'Ω')}`,
        body: `The ${who} squeezes through the resistor and loses ${V(volts)} of energy, which comes out as heat. The more resistance, the bigger the drop for the same current: V = I × R.`,
        figures,
      },
    };
  }
  if (kind === 'led') {
    const color = part?.color ?? 'red';
    figures.push(['Power (light + heat)', W(volts * amps)], ['Forward voltage', `${LED_VF[color]} V for ${color}`]);
    return {
      entry,
      stop: {
        kicker: `Stop ${n} · LED`,
        title: `${id} · ${color}`,
        body: `Crossing the LED's junction, the ${who} gives up ${V(volts)} as ${color} light. An LED always takes about the same voltage (its forward voltage) whatever the current, which is why it needs a resistor to set the current.`,
        figures,
      },
    };
  }
  if (kind === 'button') {
    return {
      entry,
      stop: {
        kicker: `Stop ${n} · Push button`,
        title: `${id} · pressed`,
        body: `The button is closed, so its contacts touch and the ${who} crosses with practically no energy lost. Let go and this is where the loop would break.`,
        figures,
      },
    };
  }
  if (kind === 'capacitor') {
    return {
      entry,
      stop: {
        kicker: `Stop ${n} · Capacitor`,
        title: id,
        body: `Charge doesn't cross the gap between the plates. It piles up on one plate while the same amount leaves the other, so current flows only while the voltage across it is changing.`,
        figures,
      },
    };
  }
  return { entry, stop: { kicker: `Stop ${n}`, title: id, body: `${V(volts)} across ${id}.`, figures } };
}

/** The ledger for one lap: what the sources gave, what the parts took. */
export function summarizeLap(entries: readonly LapEntry[]): LapSummary {
  const gained = entries.filter((x) => x.kind === 'gain').reduce((s, x) => s + x.volts, 0);
  const losses = entries.filter((x) => x.kind === 'loss' && x.volts > 5e-4).map(({ id, volts }) => ({ id, volts }));
  return { gained, losses, lost: losses.reduce((s, x) => s + x.volts, 0) };
}

/** One-line reading of a lap, for the HUD. */
export function lapText(l: LapSummary): string {
  const parts = l.losses.map((x) => `${x.id} ${V(x.volts)}`).join(' + ');
  return `Gained ${V(l.gained)} at the source, spent ${parts || 'nothing'}${l.losses.length > 1 ? ` = ${V(l.lost)}` : ''}. Round any loop, what the sources give is exactly what the parts use up: Kirchhoff's voltage law.`;
}
