/**
 * Board repair, as plain data and pure functions (the 3D view in RepairBench.tsx only draws it):
 * a job puts a real board on the mat with a fault in it; you power it, probe its pads with the
 * meter, desolder the bad part, fit a spare from the reel and solder it, then power it again.
 *
 * The rules are the bench's rules: you solder with the power off, a part that's only sitting on
 * its pads doesn't conduct, Ω and diode tests need the power off, and an LED driven too hard
 * burns out for good.
 */
import { scaled, ohmsAcross, diodeAcross, type MeterMode, type Reading } from '../desk/meter';
import { solve, type Component, type SolveResult } from '../sim';
import { NETLISTS, padSpots, type ElectricalPart, type PadSpot } from './netlists';

export interface Spare {
  id: string;
  /** What's printed on it, as you'd read it through a loupe: "102". */
  code: string;
  /** "Resistor 0603 · 1 kΩ" */
  name: string;
  /** Which footprint it fits. */
  fits: 'resistor' | 'led';
  ohms?: number;
}

export type RepairFault =
  /** A crack or a burnt track: the part conducts nothing. */
  | { part: string; kind: 'open' }
  /** The wrong value fitted at the factory, or drifted. */
  | { part: string; kind: 'value'; ohms: number };

export interface RepairJob {
  id: string;
  title: string;
  board: string;
  story: string;
  goal: string;
  /** What you can do after it, and where you'll meet it. */
  skill: string;
  realLife: string;
  hints: string[];
  faults: RepairFault[];
  spares: Spare[];
  /** Pass: this LED lit in its window, with the power on and every part soldered. */
  check: { led: string; min: number; max: number };
}

export interface Fitted {
  present: boolean;
  soldered: boolean;
  /** Fitted from the spares (undefined: the board's own part). */
  spare?: string;
  open?: boolean;
  ohms?: number;
  burnt?: boolean;
}

export type RepairEvent =
  | { kind: 'measure'; mode: MeterMode; red: string; black: string; value?: number }
  | { kind: 'power'; on: boolean }
  | { kind: 'desolder'; part: string }
  | { kind: 'place'; part: string; spare: string }
  | { kind: 'solder'; part: string }
  | { kind: 'burn'; part: string };

export interface RepairState {
  power: boolean;
  fitted: Record<string, Fitted>;
  log: RepairEvent[];
}

const boardOf = (job: RepairJob) => {
  const b = NETLISTS[job.board];
  if (!b) throw new Error(`no netlist for board ${job.board}`);
  return b;
};

export function startRepair(job: RepairJob): RepairState {
  const { net } = boardOf(job);
  const fitted: Record<string, Fitted> = {};
  for (const id of Object.keys(net.parts)) fitted[id] = { present: true, soldered: true };
  for (const f of job.faults) {
    if (!fitted[f.part]) throw new Error(`${job.id}: fault on ${f.part}, which isn't on the board's netlist`);
    fitted[f.part] = f.kind === 'open' ? { present: true, soldered: true, open: true } : { present: true, soldered: true, ohms: f.ohms };
  }
  return { power: false, fitted, log: [] };
}

function stamp(id: string, e: ElectricalPart, f: Fitted | undefined): Component[] {
  if (f && (!f.present || !f.soldered || f.open || f.burnt)) return [];
  switch (e.kind) {
    case 'resistor': return [{ kind: 'resistor', id, a: e.nets[0], b: e.nets[1], ohms: f?.ohms ?? e.ohms }];
    case 'led': return [{ kind: 'diode', id, a: e.nets[0], b: e.nets[1], vf: e.vf, led: { color: e.color }, maxAmps: e.maxAmps }];
    case 'capacitor': return [{ kind: 'capacitor', id, a: e.nets[0], b: e.nets[1], farads: e.farads }];
    case 'regulator': return [{ kind: 'regulator', id, a: e.nets[0], b: e.nets[1], out: e.nets[2], vout: e.vout, dropout: e.dropout }];
  }
}

/**
 * A board's circuit: its parts as fitted (all good if `fitted` is left out), and its power
 * when plugged in. Unplugged, the cable isn't there at all: an open, not a 0 V source (which
 * would be a short).
 */
export function boardComponents(boardId: string, power: boolean, fitted: Record<string, Fitted> = {}): Component[] {
  const b = NETLISTS[boardId];
  if (!b) throw new Error(`no netlist for board ${boardId}`);
  const out: Component[] = [];
  for (const [id, e] of Object.entries(b.net.parts)) out.push(...stamp(id, e, fitted[id]));
  for (const [id, e] of Object.entries(b.fixed ?? {})) out.push(...stamp(id, e, undefined));
  if (power) out.push({ kind: 'vsource', id: 'POWER', a: b.net.power.net, b: 'GND', volts: b.net.power.volts });
  return out;
}

/** The board as the solver sees it right now. */
export const repairCircuit = (job: RepairJob, s: RepairState): Component[] => boardComponents(job.board, s.power, s.fitted);

export const solveRepair = (job: RepairJob, s: RepairState): SolveResult => solve({ components: repairCircuit(job, s) });

export const spotsOf = (job: RepairJob): PadSpot[] => { const b = boardOf(job); return padSpots(b.def, b.net); };

/** What the meter shows with its probes on two spots. */
export function repairReading(job: RepairJob, s: RepairState, mode: MeterMode, red: string | null, black: string | null): Reading {
  if (mode === 'off') return { text: '', unit: '' };
  const spots = spotsOf(job);
  const r = spots.find((x) => x.id === red), b = spots.find((x) => x.id === black);
  if (!r || !b) return { text: '- - - -', unit: mode === 'A' ? 'mA' : mode === 'diode' ? 'V' : mode };
  if (mode === 'A') return { text: '- - - -', unit: 'mA', note: 'Current means breaking the circuit open, and a finished board has no gap to put the meter in. Measure the voltage across a resistor instead: V ÷ R is its current.' };
  if (mode === 'V') {
    const sol = solveRepair(job, s);
    if (!sol.ok) return { text: '- - - -', unit: 'V' };
    const v = (sol.nodeVoltages[r.net] ?? 0) - (sol.nodeVoltages[b.net] ?? 0);
    return { ...scaled(v, 'V'), value: v, note: s.power ? undefined : 'The board isn’t powered: plug the USB in to see its voltages.' };
  }
  if (s.power) return { text: 'Err', unit: mode === 'diode' ? 'V' : 'Ω', note: 'Unplug it first: Ω and diode tests push their own small current, and the board’s 5 V swamps it.' };
  const comps = repairCircuit(job, s);
  if (mode === 'Ω') {
    const ohms = ohmsAcross(comps, r.net, b.net);
    return ohms === null ? { text: 'OL', unit: 'Ω', note: 'OL: open. Nothing joins these two points.' } : { ...scaled(ohms, 'Ω'), value: ohms };
  }
  const v = diodeAcross(comps, r.net, b.net);
  return v === null ? { text: 'OL', unit: 'V' } : { text: v.toFixed(3), unit: 'V', value: v };
}

export type RepairAction =
  | { kind: 'power'; on: boolean }
  | { kind: 'desolder'; part: string }
  | { kind: 'place'; part: string; spare: string }
  | { kind: 'solder'; part: string }
  | { kind: 'measure'; mode: MeterMode; red: string; black: string };

export interface ActResult { state: RepairState; notice?: string }

/** Apply one action; a refused one comes back unchanged with a notice saying why. */
export function act(job: RepairJob, s: RepairState, a: RepairAction): ActResult {
  const { net } = boardOf(job);
  const f = 'part' in a ? s.fitted[a.part] : undefined;
  const log = (e: RepairEvent, patch: Partial<RepairState> = {}): RepairState => ({ ...s, ...patch, log: [...s.log, e] });
  switch (a.kind) {
    case 'measure': {
      const value = repairReading(job, s, a.mode, a.red, a.black).value;
      return { state: log({ kind: 'measure', mode: a.mode, red: a.red, black: a.black, value }) };
    }
    case 'power': {
      if (a.on === s.power) return { state: s };
      let next = log({ kind: 'power', on: a.on }, { power: a.on });
      if (!a.on) return { state: next };
      // Anything driven past its limit burns out the moment the power comes on.
      const sol = solveRepair(job, next);
      const burnt = sol.faults.filter((x) => x.kind === 'overcurrent' && x.component).map((x) => x.component!);
      if (burnt.length) {
        const fitted = { ...next.fitted };
        for (const id of burnt) if (fitted[id]) fitted[id] = { ...fitted[id]!, burnt: true };
        next = { ...next, fitted, log: [...next.log, ...burnt.map((part) => ({ kind: 'burn', part }) as RepairEvent)] };
        return { state: next, notice: `${burnt.join(', ')} burnt out: too much current went through it.` };
      }
      return { state: next };
    }
    case 'desolder': {
      if (!f) return { state: s, notice: 'That part can’t be taken off in this job.' };
      if (s.power) return { state: s, notice: `Unplug the ${net.power.cable} first: never solder a live board.` };
      if (!f.present) return { state: s, notice: `${a.part} is already off: its pads are empty.` };
      return { state: log({ kind: 'desolder', part: a.part }, { fitted: { ...s.fitted, [a.part]: { present: false, soldered: false } } }) };
    }
    case 'place': {
      if (!f) return { state: s, notice: 'There’s no footprint for a part there.' };
      if (f.present) return { state: s, notice: `Take ${a.part} off first: its pads are taken.` };
      const spare = job.spares.find((x) => x.id === a.spare);
      const e = net.parts[a.part]!;
      if (!spare) return { state: s, notice: 'No such spare.' };
      if (spare.fits !== e.kind) return { state: s, notice: `That's ${spare.fits === 'led' ? 'an LED' : 'a resistor'}; this footprint is for ${e.kind === 'led' ? 'an LED' : 'a resistor'}.` };
      return { state: log({ kind: 'place', part: a.part, spare: spare.id }, { fitted: { ...s.fitted, [a.part]: { present: true, soldered: false, spare: spare.id, ohms: spare.ohms } } }) };
    }
    case 'solder': {
      if (!f) return { state: s, notice: 'Nothing to solder there.' };
      if (s.power) return { state: s, notice: `Unplug the ${net.power.cable} first: never solder a live board.` };
      if (!f.present) return { state: s, notice: 'Put a part on the pads first.' };
      if (f.soldered) return { state: s, notice: `${a.part} is already soldered.` };
      return { state: log({ kind: 'solder', part: a.part }, { fitted: { ...s.fitted, [a.part]: { ...f, soldered: true } } }) };
    }
  }
}

export interface RepairCheck {
  pass: boolean;
  /** The LED's current, in amperes (0 if dark or the solve failed). */
  amps: number;
  message: string;
}

export function checkRepair(job: RepairJob, s: RepairState): RepairCheck {
  const loose = Object.entries(s.fitted).find(([, f]) => f.present && !f.soldered);
  if (loose) return { pass: false, amps: 0, message: `${loose[0]} is only sitting on its pads: solder it.` };
  const gone = Object.entries(s.fitted).find(([, f]) => !f.present);
  if (gone) return { pass: false, amps: 0, message: `${gone[0]}’s pads are empty.` };
  const led = s.fitted[job.check.led];
  if (led?.burnt) return { pass: false, amps: 0, message: `${job.check.led} has burnt out. Replace it, and whatever let too much current through it.` };
  if (!s.power) return { pass: false, amps: 0, message: 'Plug it in to see if it works.' };
  const sol = solveRepair(job, s);
  const amps = Math.max(0, sol.currents[job.check.led] ?? 0);
  const ma = (x: number) => `${(x * 1000).toFixed(1)} mA`;
  if (amps < 1e-4) return { pass: false, amps, message: `${job.check.led} is still dark.` };
  if (amps < job.check.min) return { pass: false, amps, message: `${job.check.led} is lit, but dim: ${ma(amps)}, it wants ${ma(job.check.min)}–${ma(job.check.max)}.` };
  if (amps > job.check.max) return { pass: false, amps, message: `${job.check.led} is too bright: ${ma(amps)}, over its ${ma(job.check.max)}.` };
  return { pass: true, amps, message: `${job.check.led} is on at ${ma(amps)}.` };
}

/** Parts the job broke. */
const faulty = (job: RepairJob) => new Set(job.faults.map((f) => f.part));

/**
 * Stars: one for fixing it; two if nothing burnt on the way; three if you also measured the
 * bad part before you took it off and fitted the right spare first time.
 */
export function repairStars(job: RepairJob, s: RepairState): { stars: 1 | 2 | 3; rules: { text: string; met: boolean }[] } {
  const bad = faulty(job);
  const spots = spotsOf(job);
  const onPart = (id: string, part: string) => spots.find((x) => x.id === id)?.part === part;
  const firstDesolder = s.log.findIndex((e) => e.kind === 'desolder' && bad.has(e.part));
  const before = firstDesolder < 0 ? s.log : s.log.slice(0, firstDesolder);
  const measured = [...bad].every((part) => before.some((e) => e.kind === 'measure' && (onPart(e.red, part) || onPart(e.black, part))));
  const places = s.log.filter((e): e is Extract<RepairEvent, { kind: 'place' }> => e.kind === 'place' && bad.has(e.part));
  const nominal = (part: string) => { const e = boardOf(job).net.parts[part]; return e?.kind === 'resistor' ? e.ohms : undefined; };
  const rightFirst = places.length > 0 && [...bad].every((part) => {
    const first = places.find((p) => p.part === part);
    const spare = job.spares.find((x) => x.id === first?.spare);
    return !!spare && spare.ohms === nominal(part);
  });
  const noBurn = !s.log.some((e) => e.kind === 'burn');
  const rules = [
    { text: 'Fixed', met: checkRepair(job, s).pass },
    { text: 'Nothing burnt out', met: noBurn },
    { text: 'Measured the bad part before taking it off, and fitted the right value first time', met: measured && rightFirst },
  ];
  return { stars: !noBurn ? 1 : measured && rightFirst ? 3 : 2, rules };
}
