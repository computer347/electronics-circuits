/**
 * What a part's label and stats card say: its name and value for the label, then what the
 * solver says is happening in it (current through, voltage across, power, and for an LED
 * whether it's lit, dark, backwards or burnt). Plain words first, numbers second.
 */
import { colorBands } from '../breadboard/colorCode';
import { currentLegs, type BoardAnalysis, type BoardPart } from '../breadboard/model';
import { formatSI } from '../lib/units';

export interface PartInfo {
  /** Short label that floats over the part: "R1 · 330 Ω". */
  tag: string;
  /** One line in plain words: "lit", "blocking: it's in backwards". */
  state?: string;
  /** Tone of the state line. */
  tone?: 'good' | 'bad' | 'neutral';
  rows: [string, string][];
}

const KIND_NAME: Record<BoardPart['kind'], string> = {
  resistor: 'Resistor', led: 'LED', wire: 'Jumper wire', button: 'Push button', battery: 'Battery', capacitor: 'Capacitor', generator: 'Function generator',
  diode: 'Diode', pot: 'Potentiometer', npn: 'NPN transistor', nmos: 'MOSFET', regulator: 'Voltage regulator',
};
/** What each leg of a three-legged part is, in hole order. */
export const LEG_NAMES: Partial<Record<BoardPart['kind'], [string, string, string]>> = {
  pot: ['end 1', 'wiper', 'end 3'], npn: ['emitter', 'base', 'collector'], nmos: ['gate', 'drain', 'source'], regulator: ['in', 'ground', 'out'],
};
const tiny = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);
/** A leg's voltage as a meter would show it: under a millivolt is 0. */
const legVolts = (v: number | undefined) => (v === undefined || Math.abs(v) < 1e-3 ? 0 : v);
const fmtF = (f: number) => (f >= 1e-6 ? `${Number((f * 1e6).toPrecision(3))} µF` : formatSI(f, 'F'));

export function valueOf(p: BoardPart): string {
  switch (p.kind) {
    case 'resistor': return formatSI(p.ohms ?? 1000, 'Ω');
    case 'led': return p.color ?? 'red';
    case 'capacitor': return fmtF(p.farads ?? 100e-9);
    case 'battery': return `${p.volts ?? 9} V`;
    case 'button': return p.pressed ? 'pressed' : 'open';
    case 'pot': return `${formatSI(p.ohms ?? 10000, 'Ω')} · ${Math.round((p.position ?? 0.5) * 100)} %`;
    case 'diode': case 'npn': case 'nmos': return p.marking ?? '';
    case 'regulator': return `${p.marking ?? 'LM7805'} · ${p.vout ?? 5} V`;
    default: return '';
  }
}

export function partInfo(p: BoardPart, a: BoardAnalysis): PartInfo {
  const value = valueOf(p);
  const tag = value && p.kind !== 'led' ? `${p.id} · ${value}` : p.id;
  const ok = a.result.ok;
  const amps = tiny(Math.abs(a.result.currents[p.id] ?? 0));
  const [m1, m2] = currentLegs(p);
  const v1 = a.voltageAt(m1), v2 = a.voltageAt(m2);
  const across = v1 !== undefined && v2 !== undefined ? tiny(v1 - v2) : undefined;
  const rows: [string, string][] = [['Part', `${KIND_NAME[p.kind]}${value ? ` · ${value}` : ''}`]];
  if (p.kind === 'resistor') rows.push(['Colour code', colorBands(p.ohms ?? 1000).names.slice(0, 3).join(' · ')]);
  if (ok) {
    rows.push(['Current through', formatSI(amps, 'A')]);
    if (across !== undefined && p.kind !== 'wire') rows.push(['Voltage across', formatSI(Math.abs(across), 'V')]);
    if (across !== undefined && p.kind !== 'wire' && amps > 0) rows.push(['Power', formatSI(Math.abs(across) * amps, 'W')]);
  }
  let state: string | undefined, tone: PartInfo['tone'];
  if (p.kind === 'led') {
    if (p.burnt) { state = 'burnt out: too much current went through it'; tone = 'bad'; }
    else if (amps > 1e-3) { state = amps > 0.025 ? 'lit, but too bright: it will burn' : 'lit'; tone = amps > 0.025 ? 'bad' : 'good'; }
    else if (across !== undefined && across < -0.5) { state = "blocking: it's in backwards (the long leg is the low one)"; tone = 'bad'; }
    else { state = 'dark: no current reaches it'; tone = 'neutral'; }
  }
  const names = LEG_NAMES[p.kind];
  if (ok && names && p.h3) [p.h1, p.h2, p.h3].forEach((h, i) => rows.push([`${names[i]![0]!.toUpperCase()}${names[i]!.slice(1)} leg`, formatSI(legVolts(a.voltageAt(h)), 'V')]));
  if (p.kind === 'npn' && ok) { const ib = Math.abs(a.result.currents[`${p.id}.base`] ?? 0); rows.push(['Base current', formatSI(ib, 'A')]); state = amps > 1e-4 ? (ib * 200 > amps * 1.5 ? 'switched fully on (saturated)' : 'on: amplifying the base current') : 'off: no base current'; tone = amps > 1e-4 ? 'good' : 'neutral'; }
  if (p.kind === 'nmos' && ok) { state = amps > 1e-4 ? 'on: the gate is above its threshold' : 'off: gate below 2 V'; tone = amps > 1e-4 ? 'good' : 'neutral'; }
  if (p.kind === 'diode' && ok) { state = amps > 1e-4 ? 'conducting' : across !== undefined && across < -0.5 ? 'blocking (reverse biased)' : 'not conducting'; tone = 'neutral'; }
  if (p.kind === 'capacitor' && across !== undefined) { state = `charged to ${formatSI(Math.abs(across), 'V')}`; tone = 'neutral'; }
  if (p.kind !== 'led' && a.shortedParts.includes(p.id)) { state = 'both legs on the same strip: it does nothing'; tone = 'bad'; }
  return { tag, state, tone, rows };
}
