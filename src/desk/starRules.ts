/**
 * The three stars, spelled out for the result card and the level's hint note: what each one
 * takes, and whether this run got it. Same rules as `stars()` in levels/check.ts.
 */
import type { RunStats } from '../levels/check';
import type { LevelDef } from '../levels/types';

export interface StarRule { stars: 1 | 2 | 3; label: string; detail: string; met: boolean }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "1 try · 2 measurements · 0 parts added" */
export function parText(level: LevelDef): string {
  const p = level.par;
  return [
    plural(p.checks, 'try', 'tries'),
    p.measurements !== undefined ? plural(p.measurements, 'measurement') : null,
    p.partsAdded !== undefined ? plural(p.partsAdded, 'part added', 'parts added') : null,
  ].filter(Boolean).join(' · ');
}

export function starRules(level: LevelDef, s: RunStats | null, passed: boolean): StarRule[] {
  const clean = !!s && s.hintsUsed === 0 && s.burnt === 0;
  const par = level.par;
  const withinPar = !!s && s.checks <= par.checks
    && (par.partsAdded === undefined || s.partsAdded <= par.partsAdded)
    && (par.measurements === undefined || s.measurements <= par.measurements);
  const why: string[] = [];
  if (s && s.hintsUsed) why.push(plural(s.hintsUsed, 'hint') + ' used');
  if (s && s.burnt) why.push(plural(s.burnt, 'LED') + ' burnt');
  const over: string[] = [];
  if (s && s.checks > par.checks) over.push(plural(s.checks, 'try', 'tries'));
  if (s && par.measurements !== undefined && s.measurements > par.measurements) over.push(plural(s.measurements, 'measurement'));
  if (s && par.partsAdded !== undefined && s.partsAdded > par.partsAdded) over.push(plural(s.partsAdded, 'part added', 'parts added'));
  return [
    { stars: 1, label: 'Meet the spec', detail: 'the circuit does what the notebook asks', met: passed },
    { stars: 2, label: 'No hints, nothing burnt', detail: why.length ? why.join(', ') : 'on your own, no smoke', met: passed && clean },
    { stars: 3, label: 'Within par', detail: over.length ? `par is ${parText(level)}; you took ${over.join(', ')}` : `par: ${parText(level)}`, met: passed && clean && withinPar },
  ];
}
