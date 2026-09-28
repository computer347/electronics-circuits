/**
 * A small, SPICE-like text format for circuits. One component per line:
 *
 *   * comments start with * or #
 *   V1   vcc 0   9          voltage source: + node, - node, volts
 *   I1   a   b   1m         current source: amps flow a -> b through the source
 *   R1   vcc out 330        resistor, ohms
 *   C1   out 0   100u  v0=0 capacitor, farads, optional initial voltage
 *   W1   a   b              wire
 *   S1   a   b   closed     switch: closed | open
 *   D1   a   k   vf=0.7     diode: anode, cathode
 *   LED1 a   k   red        LED: colour sets vf; optional imax=20m vrmax=5 vf=...
 *
 * Value suffixes: p n u (or µ) m k M/meg G. Note: unlike SPICE, "M" means mega here,
 * because that's how students write 1M ohm. An exporter will translate for ngspice.
 * Ground is 0, gnd or GND.
 */

import { LED_VF, type Circuit, type Component, type LedColor } from './types';

const SUFFIX: Record<string, number> = {
  p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, meg: 1e6, MEG: 1e6, G: 1e9,
};

export class NetlistError extends Error {
  constructor(public readonly line: number, message: string) {
    super(`Line ${line}: ${message}`);
  }
}

/** Parses "4.7k", "100u", "1M", "2.2meg", "10mA" (trailing unit letters are ignored). */
export function parseValue(token: string): number {
  const m = /^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(meg|MEG|[pnuµmkKMG])?[a-zA-ZΩ]*$/.exec(token);
  if (!m) throw new Error(`"${token}" is not a number`);
  const base = Number(m[1]);
  return m[2] ? base * SUFFIX[m[2]]! : base;
}

const LED_COLORS = Object.keys(LED_VF) as LedColor[];
const LED_DEFAULT_MAX_AMPS = 0.03;
const LED_DEFAULT_MAX_REVERSE = 5;

export function parseNetlist(text: string): Circuit {
  const components: Component[] = [];
  const ids = new Set<string>();

  text.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.replace(/[*#;].*$/, '').trim();
    if (!line) return;
    const [id, a, b, ...rest] = line.split(/\s+/);
    if (!id || !a || !b) throw new NetlistError(lineNo, 'expected: NAME node1 node2 [value]');
    if (ids.has(id)) throw new NetlistError(lineNo, `duplicate component name ${id}`);
    ids.add(id);

    const params: Record<string, string> = {};
    const positional: string[] = [];
    for (const t of rest) {
      const kv = /^(\w+)=(.+)$/.exec(t);
      if (kv) params[kv[1]!.toLowerCase()] = kv[2]!;
      else positional.push(t);
    }
    const value = (name: string) => {
      const t = positional[0];
      if (t === undefined) throw new NetlistError(lineNo, `${id} needs a ${name}`);
      try { return parseValue(t); } catch (e) { throw new NetlistError(lineNo, (e as Error).message); }
    };
    const param = (k: string) => {
      const t = params[k];
      if (t === undefined) return undefined;
      try { return parseValue(t); } catch (e) { throw new NetlistError(lineNo, (e as Error).message); }
    };

    const upper = id.toUpperCase();
    if (upper.startsWith('LED')) {
      const color = (positional.find((p) => LED_COLORS.includes(p as LedColor)) ?? 'red') as LedColor;
      components.push({
        kind: 'diode', id, a, b,
        vf: param('vf') ?? LED_VF[color],
        led: { color },
        maxAmps: param('imax') ?? LED_DEFAULT_MAX_AMPS,
        maxReverseVolts: param('vrmax') ?? LED_DEFAULT_MAX_REVERSE,
      });
      return;
    }

    switch (upper[0]) {
      case 'R': {
        const ohms = value('resistance');
        if (ohms <= 0) throw new NetlistError(lineNo, `${id} must be greater than 0 ohms`);
        components.push({ kind: 'resistor', id, a, b, ohms });
        break;
      }
      case 'V':
        if (positional[0]?.toLowerCase() === 'dc') positional.shift();
        components.push({ kind: 'vsource', id, a, b, volts: value('voltage') });
        break;
      case 'I':
        if (positional[0]?.toLowerCase() === 'dc') positional.shift();
        components.push({ kind: 'isource', id, a, b, amps: value('current') });
        break;
      case 'C': {
        const farads = value('capacitance');
        if (farads <= 0) throw new NetlistError(lineNo, `${id} must be greater than 0 F`);
        const initialVolts = param('v0');
        components.push({ kind: 'capacitor', id, a, b, farads, ...(initialVolts !== undefined && { initialVolts }) });
        break;
      }
      case 'W':
        components.push({ kind: 'wire', id, a, b });
        break;
      case 'S': {
        const state = (positional[0] ?? 'closed').toLowerCase();
        if (state !== 'open' && state !== 'closed') throw new NetlistError(lineNo, `${id} must be open or closed`);
        components.push({ kind: 'switch', id, a, b, closed: state === 'closed' });
        break;
      }
      case 'D': {
        const maxAmps = param('imax');
        const maxReverseVolts = param('vrmax');
        components.push({
          kind: 'diode', id, a, b, vf: param('vf') ?? 0.7,
          ...(maxAmps !== undefined && { maxAmps }),
          ...(maxReverseVolts !== undefined && { maxReverseVolts }),
        });
        break;
      }
      default:
        throw new NetlistError(lineNo, `unknown component type "${id}" (use R, V, I, C, W, S, D or LED)`);
    }
  });

  return { components };
}
