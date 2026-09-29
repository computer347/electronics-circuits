/**
 * What the notebook says for each level: one big sentence, the picture of the target, then the
 * level's own goal and story, the datasheet and one tip. The numbers come from the level JSON;
 * the short sentence and the tip are written here.
 */
import type { LevelDef } from '../levels/types';

export type TaskPicture = 'led' | 'two-leds' | 'divider' | 'rc';

export interface TaskPage {
  label: string;
  title: string;
  /** One sentence, big: what to do. */
  headline: string;
  /** The level's goal with its numbers. */
  goal: string;
  story: string;
  tip: string;
  picture: TaskPicture;
  datasheet?: { title: string; rows: [string, string][] };
}

const EXTRA: Record<string, { headline: string; tip: string; picture: TaskPicture }> = {
  'w0-01-first-light': {
    headline: 'Light the LED without burning it.',
    tip: 'The resistor sets the current. Too small and the LED burns, too big and it stays dark. Try R = (9 V − 2 V) ÷ the current you want.',
    picture: 'led',
  },
  'w0-02-wrong-way-round': {
    headline: 'Make the LED light up.',
    tip: 'Measure before you touch anything: black probe on the − rail, red on each LED leg. A lit LED has its long leg about 2 V above its short one.',
    picture: 'led',
  },
  'w0-03-side-by-side': {
    headline: 'Light both LEDs from a small supply.',
    tip: 'Side by side, the supply feeds each LED its own current. In a line (series), one current passes through both.',
    picture: 'two-leds',
  },
  'w0-04-split-the-difference': {
    headline: 'Make 3 volts out of 9.',
    tip: 'Two resistors in a line split the voltage: the middle sits at 9 V × R_bottom ÷ (R_top + R_bottom). Big values waste less current.',
    picture: 'divider',
  },
  'w0-05-slow-blink': {
    headline: 'Make the capacitor charge in about a second.',
    tip: 'The time constant is τ = R × C. C1 is 100 µF: which R makes R × C about 1 s?',
    picture: 'rc',
  },
};

export function taskPage(l: LevelDef): TaskPage {
  const x = EXTRA[l.id] ?? { headline: l.brief.goal, tip: l.hints[0] ?? '', picture: 'led' as const };
  return {
    label: `LEVEL ${l.world}–${l.number}`,
    title: l.title.toUpperCase(),
    headline: x.headline,
    goal: l.brief.goal,
    story: l.brief.story,
    tip: x.tip,
    picture: x.picture,
    datasheet: l.brief.datasheet,
  };
}
