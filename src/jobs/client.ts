/**
 * Client jobs: someone brings something in, tells you what's wrong, and you fix it on the
 * bench. The fixing is a normal level; a client job wraps it in a story (dialogue before and
 * after), a clock on the wall, and pay. Plain data and pure functions.
 */
import { levelById } from '../levels';

export interface Line { who: 'client' | 'you'; text: string }

export interface ClientJob {
  id: string;
  title: string;
  client: { name: string; about: string; color: string };
  /** The desk level that is the actual fix. */
  levelId: string;
  intro: Line[];
  outro: Line[];
  /** Clock on the wall when they walk in, and when they'll be back (minutes after midnight). */
  opens: number;
  due: number;
  pay: { base: number; perStar: number; onTime: number };
  skill: string;
  realLife: string;
}

export const DEAD_TORCH: ClientJob = {
  id: 'job-dead-torch',
  title: 'The dead torch',
  client: { name: 'Sam', about: 'runs the allotment next door', color: '#ff48b0' },
  levelId: 'w0-08-stack-them-up',
  intro: [
    { who: 'client', text: 'Hi! You fix electronics, right? My head torch died. I put three brand-new AA cells in it this morning and… nothing.' },
    { who: 'you', text: 'New batteries and still dead. Did anything change when you swapped them?' },
    { who: 'client', text: 'Only the batteries. The old ones were flat, so I just popped the fresh ones in. It’s a blue LED, if that helps.' },
    { who: 'you', text: 'It does. Leave it with me: I’ll measure it and find out.' },
    { who: 'client', text: 'Brilliant. I’ll be back at half five, before it gets dark.' },
  ],
  outro: [
    { who: 'client', text: 'Oh, it works! What was wrong with it?' },
    { who: 'you', text: 'One cell was in backwards. Two cells push, one pushes against them: 1.5 V instead of 4.5 V, not enough for a blue LED.' },
    { who: 'client', text: 'So I did it myself. Well, now I know to check the little + marks. Thank you!' },
  ],
  opens: 16 * 60 + 40,
  due: 17 * 60 + 30,
  pay: { base: 12, perStar: 3, onTime: 5 },
  skill: 'Turn a customer’s description into a measurement plan, find the fault, and explain it back in plain words.',
  realLife: 'Every repair starts with a conversation: what changed, when it stopped. “I only swapped the batteries” is the best clue you’ll get.',
};

export const CLIENT_JOBS: ClientJob[] = [DEAD_TORCH];
export const clientJobById = (id: string) => CLIENT_JOBS.find((j) => j.id === id);

/** One real second is one minute on the workshop clock. */
export const GAME_MINUTE_MS = 1000;

export const clockAt = (job: ClientJob, realMs: number) => job.opens + Math.floor(Math.max(0, realMs) / GAME_MINUTE_MS);

export function clockText(minutes: number): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface Payout { total: number; lines: [string, number][] }

/** What the client pays: the job, a bit more per star, and a tip for being ready on time. */
export function payout(job: ClientJob, stars: 1 | 2 | 3, finishedAt: number): Payout {
  const lines: [string, number][] = [['The job', job.pay.base], [`Quality (${stars} ★)`, stars * job.pay.perStar]];
  if (finishedAt <= job.due) lines.push([`Ready by ${clockText(job.due)}`, job.pay.onTime]);
  return { total: lines.reduce((s, [, x]) => s + x, 0), lines };
}

/** Holding E to continue: how long a hold takes, and how far along it is. */
export const HOLD_TO_CONTINUE_MS = 450;
export const holdProgress = (heldMs: number) => Math.min(1, Math.max(0, heldMs / HOLD_TO_CONTINUE_MS));

/** Every job's level must exist, or the job can't be played. */
export const jobLevel = (job: ClientJob) => levelById(job.levelId);
