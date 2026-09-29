/**
 * The level loop on the desk, as plain rules: every level goes notebook → breadboard → meter →
 * clear the circuit, in that order. What's done so far decides the current step, which object
 * glows, and what the one main button does. No React or three.js here, so it's easy to test.
 */

export type StepId = 'task' | 'build' | 'test' | 'clear';
export const STEPS: StepId[] = ['task', 'build', 'test', 'clear'];

/** The objects on the desk you can bring into focus. The scope is an extra tool, outside the four steps. */
export type DeskObject = 'notebook' | 'breadboard' | 'meter' | 'corkboard' | 'scope';

export const STEP_OBJECT: Record<StepId, DeskObject> = {
  task: 'notebook',
  build: 'breadboard',
  test: 'meter',
  clear: 'breadboard',
};

export interface LoopProgress {
  /** The notebook was opened and closed again. */
  readTask: boolean;
  /** The player said they're done on the breadboard. */
  built: boolean;
  /** Multimeter measurements since the level started (both probes placed). */
  measurements: number;
  /** Submitted from the meter (the power switch flipped). */
  submitted: boolean;
  /** The circuit was cleared from the inside and the level checked. */
  cleared: boolean;
}

export const FRESH: LoopProgress = { readTask: false, built: false, measurements: 0, submitted: false, cleared: false };

/** The step the player is on, or 'done' once the circuit is cleared. */
export function currentStep(p: LoopProgress): StepId | 'done' {
  if (!p.readTask) return 'task';
  if (!p.built) return 'build';
  if (!p.submitted) return 'test';
  if (!p.cleared) return 'clear';
  return 'done';
}

export type StepState = 'done' | 'current' | 'future';

/** How each icon on the step rail looks: ticked, lit, or dim. */
export function railStates(p: LoopProgress): Record<StepId, StepState> {
  const cur = currentStep(p);
  const at = cur === 'done' ? STEPS.length : STEPS.indexOf(cur);
  return Object.fromEntries(STEPS.map((s, i) => [s, i < at ? 'done' : i === at ? 'current' : 'future'])) as Record<StepId, StepState>;
}

/** The one object that glows on the desk: the next step's (the level map once it's all done). */
export function glowing(p: LoopProgress): DeskObject {
  const cur = currentStep(p);
  return cur === 'done' ? 'corkboard' : STEP_OBJECT[cur];
}

/** Submit needs at least one measurement: test before you submit. */
export const canSubmit = (p: LoopProgress) => p.measurements > 0 && !p.submitted;

export type MainAction =
  | { kind: 'focus'; object: DeskObject; label: string }
  | { kind: 'close-notebook'; label: string }
  | { kind: 'done-building'; label: string }
  | { kind: 'submit'; label: string; enabled: boolean }
  | { kind: 'pick-level'; label: string }
  | { kind: 'back'; label: string };

const OPEN_LABEL: Record<DeskObject, string> = {
  notebook: 'Read the task',
  breadboard: 'Go to the breadboard',
  meter: 'Test it',
  corkboard: 'Next level',
  scope: 'Look at the scope',
};

/** The single blue button in the bottom-right corner, for what's in focus right now. */
export function mainAction(p: LoopProgress, focus: DeskObject | null): MainAction {
  const cur = currentStep(p);
  if (focus === 'notebook') return cur === 'task' ? { kind: 'close-notebook', label: 'Got it' } : { kind: 'back', label: 'Back to the desk' };
  if (focus === 'breadboard') return cur === 'build' ? { kind: 'done-building', label: 'Done: test it' } : { kind: 'back', label: 'Back to the desk' };
  if (focus === 'meter') {
    if (cur === 'test') return { kind: 'submit', label: canSubmit(p) ? 'Submit' : 'Measure first', enabled: canSubmit(p) };
    return { kind: 'back', label: 'Back to the desk' };
  }
  if (focus === 'scope') return { kind: 'back', label: 'Back to the desk' };
  // On the level map the button plays the suggested level (the view names it).
  if (focus === 'corkboard') return { kind: 'pick-level', label: 'Play' };
  const next = glowing(p);
  return { kind: 'focus', object: next, label: OPEN_LABEL[next] };
}
