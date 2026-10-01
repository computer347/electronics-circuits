/**
 * The career: certificates earned in training (groups of campaign levels), ranks from
 * Hobbyist to Master Engineer, and achievements. All of it is worked out from what's already
 * saved (level progress, the wallet, the business store), so nothing can drift out of step.
 */
import { WORLD0, WORLD1 } from '../levels';
import type { LevelRecord } from '../levels/progress';
import { LABS } from '../lab/labs';
import { CODING_JOBS } from '../coding/jobs';
import { TOOLS } from './economy';

export interface Certificate {
  id: string;
  name: string;
  /** What it says you can do. */
  what: string;
  levels: string[];
}

const w0 = (...n: number[]) => n.map((k) => WORLD0.find((l) => l.number === k)!.id);
const w1 = (...n: number[]) => n.map((k) => WORLD1.find((l) => l.number === k)!.id);

export const CERTIFICATES: Certificate[] = [
  { id: 'cert-ohm', name: 'Ohm’s law and LEDs', what: 'Size resistors for any LED, alone, in series or side by side.', levels: w0(1, 3, 11, 12, 13) },
  { id: 'cert-fault', name: 'Fault finding', what: 'Find reversed parts, shorts and open circuits by measuring, not guessing.', levels: w0(2, 8, 14, 15) },
  { id: 'cert-dividers', name: 'Dividers and sensors', what: 'Design dividers, read sensors and pots, and allow for the load.', levels: w0(4, 9, 19, 20, 21) },
  { id: 'cert-power', name: 'Power and protection', what: 'Budget current, protect against reversed batteries and regulate a rail.', levels: w0(6, 16, 17, 23) },
  { id: 'cert-switching', name: 'Switches and timing', what: 'Switch loads by hand and by timer, and set RC delays.', levels: w0(5, 7, 18, 22) },
  { id: 'cert-transistors', name: 'Transistors and MOSFETs', what: 'Switch real loads with transistors and MOSFETs, sized and saturated.', levels: w0(10, 24, 25) },
  { id: 'cert-logic', name: 'Digital logic', what: 'Count in binary and build every basic gate from switches, diodes and transistors.', levels: w1(1, 2, 3, 4, 5, 6, 10) },
  { id: 'cert-chips', name: 'Logic chips', what: 'Power and wire 74HC chips by pin number, and make any gate from NANDs.', levels: w1(7, 11, 12, 13, 14) },
  { id: 'cert-design', name: 'Combinational design', what: 'Turn a spec or a truth table into gates: parity, voting, multiplexers, decoders, locks.', levels: w1(15, 16, 17, 18, 19, 20) },
  { id: 'cert-arith', name: 'Arithmetic and interfacing', what: 'Add binary numbers in gates, and drive real loads from logic.', levels: w1(8, 21, 22) },
  { id: 'cert-memory', name: 'Memory and state', what: 'Store bits in latches and decode a state machine’s outputs.', levels: w1(9, 23, 24) },
];

export interface CertState { earned: boolean; distinction: boolean; passed: number; total: number }

export function certState(c: Certificate, records: Record<string, LevelRecord>): CertState {
  const passed = c.levels.filter((id) => records[id]).length;
  return { earned: passed === c.levels.length, distinction: c.levels.every((id) => records[id]?.stars === 3), passed, total: c.levels.length };
}

/** Everything the career is worked out from. */
export interface CareerInput {
  records: Record<string, LevelRecord>;
  /** The wallet: credits, and every workshop job done (with pay and stars). */
  credits: number;
  done: Record<string, { paid: number; stars?: 1 | 2 | 3 }>;
  tools: string[];
}

/** Workshop jobs done (repairs, coding, wiring, clients), not Parts Lab answers. */
export const jobsDone = (i: CareerInput) => Object.keys(i.done).filter((k) => !k.startsWith('lab:')).length;
/** Reputation: five for every star earned on a workshop job. */
export const reputation = (i: CareerInput) => Object.entries(i.done).filter(([k]) => !k.startsWith('lab:')).reduce((s, [, v]) => s + 5 * (v.stars ?? 1), 0);
export const certsEarned = (i: CareerInput) => CERTIFICATES.filter((c) => certState(c, i.records).earned).length;

export interface Rank {
  id: string;
  name: string;
  /** What it takes, as checks you can tick off. */
  needs: { label: string; ok: (i: CareerInput) => boolean }[];
}

const certs = (n: number) => ({ label: `${n} certificates`, ok: (i: CareerInput) => certsEarned(i) >= n });
const jobs = (n: number) => ({ label: `${n} jobs done`, ok: (i: CareerInput) => jobsDone(i) >= n });
const rep = (n: number) => ({ label: `reputation ${n}`, ok: (i: CareerInput) => reputation(i) >= n });
const owns = (id: string) => ({ label: `own the ${TOOLS.find((t) => t.id === id)!.name.toLowerCase()}`, ok: (i: CareerInput) => i.tools.includes(id) });

export const RANKS: Rank[] = [
  { id: 'hobbyist', name: 'Hobbyist', needs: [] },
  { id: 'apprentice', name: 'Apprentice', needs: [certs(2)] },
  { id: 'technician', name: 'Technician', needs: [certs(5), jobs(3), owns('meter-auto')] },
  { id: 'engineer', name: 'Engineer', needs: [certs(8), jobs(5), owns('scope'), rep(40)] },
  { id: 'senior', name: 'Senior Engineer', needs: [certs(10), jobs(7), owns('iron'), rep(70)] },
  {
    id: 'master', name: 'Master Engineer', needs: [
      certs(CERTIFICATES.length),
      { label: 'every certificate with distinction, or reputation 120', ok: (i) => CERTIFICATES.every((c) => certState(c, i.records).distinction) || reputation(i) >= 120 },
    ],
  },
];

/** The highest rank whose needs (and every rank's below it) are met. */
export function rankIndex(i: CareerInput): number {
  let r = 0;
  for (let k = 1; k < RANKS.length; k++) { if (RANKS[k]!.needs.every((n) => n.ok(i))) r = k; else break; }
  return r;
}

export interface Achievement { id: string; name: string; what: string; got: (i: CareerInput) => boolean }

const passedIn = (i: CareerInput, levels: { id: string }[]) => levels.filter((l) => i.records[l.id]).length;
const threeStars = (i: CareerInput) => Object.values(i.records).filter((r) => r.stars === 3).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-light', name: 'First light', what: 'Pass your first level.', got: (i) => Object.keys(i.records).length > 0 },
  { id: 'gold-10', name: 'Clean hands', what: 'Three stars on 10 levels.', got: (i) => threeStars(i) >= 10 },
  { id: 'gold-25', name: 'Gold standard', what: 'Three stars on 25 levels.', got: (i) => threeStars(i) >= 25 },
  { id: 'quick', name: 'Quick fingers', what: 'Pass a level in under a minute.', got: (i) => Object.values(i.records).some((r) => r.seconds > 0 && r.seconds < 60) },
  { id: 'logic', name: 'True or false', what: 'Pass a level in World 1.', got: (i) => passedIn(i, WORLD1) > 0 },
  { id: 'world0', name: 'Foundations laid', what: 'Pass every level in World 0.', got: (i) => passedIn(i, WORLD0) === WORLD0.length },
  { id: 'world1', name: 'Logically complete', what: 'Pass every level in World 1.', got: (i) => passedIn(i, WORLD1) === WORLD1.length },
  { id: 'certified', name: 'Certified', what: 'Earn your first certificate.', got: (i) => certsEarned(i) > 0 },
  { id: 'distinction', name: 'With distinction', what: 'Earn a certificate with three stars on every level.', got: (i) => CERTIFICATES.some((c) => certState(c, i.records).distinction) },
  { id: 'first-pay', name: 'Open for business', what: 'Get paid for a job.', got: (i) => Object.values(i.done).some((d) => d.paid > 0) },
  { id: 'saver', name: 'Rainy-day fund', what: 'Have 300 credits at once.', got: (i) => i.credits >= 300 },
  { id: 'first-tool', name: 'Tooled up', what: 'Buy your first tool.', got: (i) => i.tools.some((t) => !['meter-basic', 'supply'].includes(t)) },
  { id: 'toolbox', name: 'Full toolbox', what: 'Own every tool.', got: (i) => TOOLS.every((t) => i.tools.includes(t.id)) },
  { id: 'coder', name: 'It compiles', what: 'Finish every coding job.', got: (i) => CODING_JOBS.filter((j) => !j.free).every((j) => i.done[j.id]) },
  { id: 'parts', name: 'Know your parts', what: 'Answer every Parts Lab question.', got: (i) => LABS.every((l) => i.done[`lab:${l.part}`]) },
  { id: 'master', name: 'Master Engineer', what: 'Reach the top rank.', got: (i) => rankIndex(i) === RANKS.length - 1 },
];
