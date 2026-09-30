/**
 * What the notebook says for each level: one big sentence, the picture of the target, then the
 * level's own goal and story, the datasheet and one tip. The numbers come from the level JSON;
 * the short sentence and the tip are written here.
 */
import type { LevelDef } from '../levels/types';

export type TaskPicture = 'led' | 'two-leds' | 'divider' | 'rc' | 'fork' | 'button' | 'cells' | 'bridge';

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
  /** What you can do after this level, in one line. */
  skill: string;
  /** Where you'll meet it outside the game. */
  realLife: string;
  datasheet?: { title: string; rows: [string, string][] };
}

const EXTRA: Record<string, { headline: string; tip: string; picture: TaskPicture; skill: string; realLife: string }> = {
  'w0-01-first-light': {
    headline: 'Light the LED without burning it.',
    tip: 'The resistor sets the current. Too small and the LED burns, too big and it stays dark. Try R = (9 V − 2 V) ÷ the current you want.',
    picture: 'led',
    skill: 'Pick the resistor that keeps an LED safe, with Ohm’s law.',
    realLife: 'Every power light on a charger, router or TV has a resistor like R1 in front of it. It’s the first sum anyone building with LEDs does.',
  },
  'w0-02-wrong-way-round': {
    headline: 'Make the LED light up.',
    tip: 'Measure before you touch anything: black probe on the − rail, red on each LED leg. A lit LED has its long leg about 2 V above its short one.',
    picture: 'led',
    skill: 'Find a part that’s in backwards by measuring, not guessing.',
    realLife: 'LEDs, diodes, electrolytic capacitors and batteries all have a right way round. A reversed one is the most common mistake on a new board.',
  },
  'w0-03-side-by-side': {
    headline: 'Light both LEDs from a small supply.',
    tip: 'Side by side, the supply feeds each LED its own current. In a line (series), one current passes through both.',
    picture: 'two-leds',
    skill: 'Tell series from parallel, and give each LED its own current.',
    realLife: 'Indicator panels, LED strips and car dashboards wire their lights side by side, each with its own resistor, so one dead LED doesn’t take the rest out.',
  },
  'w0-04-split-the-difference': {
    headline: 'Make 3 volts out of 9.',
    tip: 'Two resistors in a line split the voltage: the middle sits at 9 V × R_bottom ÷ (R_top + R_bottom). Big values waste less current.',
    picture: 'divider',
    skill: 'Design a voltage divider for the voltage you need.',
    realLife: 'Dividers read sensors (light, temperature, a battery’s charge) and drop a 5 V signal to the 3.3 V an ESP32’s pin can take.',
  },
  'w0-05-slow-blink': {
    headline: 'Make the capacitor charge in about a second.',
    tip: 'The time constant is τ = R × C. C1 is 100 µF: which R makes R × C about 1 s?',
    picture: 'rc',
    skill: 'Set a delay with a resistor and a capacitor: τ = R × C.',
    realLife: 'RC delays debounce buttons, hold a chip in reset while its power settles, and set the blink rate of timers like the 555.',
  },
  'w0-06-fork-in-the-road': {
    headline: 'Get both LEDs properly lit.',
    tip: 'Each branch gets the full 9 V. Measure across each resistor: V ÷ R is its current, no need to break the circuit.',
    picture: 'fork',
    skill: 'Add up the currents where a circuit branches (Kirchhoff’s current law).',
    realLife: 'It’s how you budget current: an Arduino pin gives 20 mA, a USB port 500 mA. Add up your branches before you plug in.',
  },
  'w0-07-push-to-light': {
    headline: 'Light the LED only while the button is held.',
    tip: 'A column of five holes is one strip. The button goes across the gap between two columns, never along one.',
    picture: 'button',
    skill: 'Put a switch in series, across the breadboard’s strips.',
    realLife: 'Every button on a remote, keyboard or doorbell closes a gap in a loop like this. Later a microcontroller will read it.',
  },
  'w0-08-stack-them-up': {
    headline: 'Get the torch working on its batteries.',
    tip: 'Walk the stack with the meter: black on the − rail, red on each cell’s + end. It should climb 1.5 V per cell.',
    picture: 'cells',
    skill: 'Add cell voltages in series, and find the one put in backwards.',
    realLife: 'Torches, remotes and toys stack AA cells: two make 3 V, four make 6 V. One reversed cell is why a fresh set of batteries ’doesn’t work’.',
  },
  'w0-09-balance-the-bridge': {
    headline: 'Make the meter across the bridge read zero.',
    tip: 'Both taps match when both sides divide in the same ratio: R2 ÷ R1 = R4 ÷ R3.',
    picture: 'bridge',
    skill: 'Balance a bridge: matching ratios give zero volts across it.',
    realLife: 'Kitchen scales, pressure sensors and precise thermometers use a bridge, so a tiny change in one resistor shows up as a clear voltage.',
  },
};

export function taskPage(l: LevelDef): TaskPage {
  const x = EXTRA[l.id] ?? { headline: l.brief.goal, tip: l.hints[0] ?? '', picture: 'led' as const, skill: '', realLife: '' };
  return {
    label: `LEVEL ${l.world}–${l.number}`,
    title: l.title.toUpperCase(),
    headline: x.headline,
    goal: l.brief.goal,
    story: l.brief.story,
    tip: x.tip,
    picture: x.picture,
    skill: x.skill,
    realLife: x.realLife,
    datasheet: l.brief.datasheet,
  };
}
