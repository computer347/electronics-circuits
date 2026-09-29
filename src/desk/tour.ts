/**
 * The guided tour of the bench: the camera visits each thing on it, and a card says what it
 * is and what it's for, in a sentence or two. It runs once on your first visit (remembered in
 * the browser) and can be replayed from the Tour button.
 */
import * as THREE from 'three';
import { LAYOUT } from './layout';

export interface TourStop {
  id: string;
  title: string;
  text: string;
  /** What the camera looks at, and roughly how big the view should be (metres across). */
  target: THREE.Vector3;
  size: number;
  /** Degrees above the desk. */
  elevation: number;
}

const up = (v: THREE.Vector3, y: number) => v.clone().setY(y);

export const TOUR: TourStop[] = [
  { id: 'bench', title: 'Your bench', text: 'Every level uses the same things, in the same order: read the task in the notebook, build on the breadboard, test with the meter, then go into the circuit. Whatever glows is next.', target: new THREE.Vector3(0, 0, -0.06), size: 1.25, elevation: 60 },
  { id: 'notebook', title: 'Lab book', text: 'The task is on the first page. The Theory and Math tabs teach exactly what the level needs, with live circuits and practice questions.', target: up(LAYOUT.notebook.pos, 0.01), size: 0.36, elevation: 62 },
  { id: 'mat', title: 'Breadboard on an antistatic mat', text: 'The breadboard joins parts without solder. The mat under it is grounded through the green-yellow lead, so static from your hands can’t zap the parts.', target: up(LAYOUT.mat.pos, 0.01), size: 0.6, elevation: 62 },
  { id: 'supply', title: 'Bench power supply', text: 'It powers the board through the red (+) and black (−) leads. The red display shows the volts it’s set to, the green one the current your circuit draws. Its OUTPUT button is how you submit.', target: up(LAYOUT.supply.pos, 0.05), size: 0.32, elevation: 40 },
  { id: 'meter', title: 'Multimeter', text: 'Twist the dial. V measures across a part, A measures in series (the meter becomes a wire), Ω measures with the power off.', target: up(LAYOUT.meter.pos, 0.02), size: 0.26, elevation: 60 },
  { id: 'scope', title: 'Oscilloscope', text: 'A meter gives one number; the scope draws a voltage over time, so you can watch a capacitor charge or a signal swing. Clip its probes onto holes and turn the time and volts knobs.', target: up(LAYOUT.scope.pos, 0.08), size: 0.4, elevation: 30 },
  { id: 'parts', title: 'Parts', text: 'The clear box in front holds this level’s parts. The drawers along the wall and the loose spares are for the free bench.', target: new THREE.Vector3(-0.3, 0.05, -0.1), size: 0.95, elevation: 50 },
  { id: 'soldering', title: 'Soldering station', text: 'For later worlds: the iron rests in its coil stand at 330 °C. Wipe the tip on the damp sponge, feed in solder from the reel.', target: up(LAYOUT.station.pos, 0.04), size: 0.38, elevation: 42 },
  { id: 'hands', title: 'Helping hands', text: 'Two clips and a magnifier to hold a board or a wire still while you solder.', target: up(LAYOUT.helpingHands.pos, 0.07), size: 0.28, elevation: 35 },
  { id: 'map', title: 'Level map', text: 'The corkboard on the wall. Cards open one after another, and a tick marks the ones you’ve passed. The blue card at the end is the free bench: build anything.', target: LAYOUT.corkboard.pos.clone(), size: 0.7, elevation: 12 },
];

const KEY = 'signal-path.desk.tour.v1';
export const tourSeen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
export const markTourSeen = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode: it just shows again */ } };
