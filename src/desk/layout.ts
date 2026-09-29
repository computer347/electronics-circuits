/**
 * Where everything sits on the lab bench, in metres (desk top at y = 0, x to the right, +z
 * toward you). The scene places objects from here and the guided tour aims the camera here,
 * so moving something moves its tour stop too.
 *
 * Back row, left to right: parts drawers against the wall, bench power supply, the
 * oscilloscope, the soldering station, the lamp. Middle: the antistatic mat with the
 * breadboard. Front: the notebook on the left, spares, the level's parts box and tools along
 * the mat's front edge, the meter and the mug on the right.
 */
import * as THREE from 'three';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const LAYOUT = {
  mat: { pos: v(-0.02, 0, -0.05), w: 0.64, d: 0.44 },
  supply: { pos: v(-0.43, 0, -0.33), rotY: 0.18 },
  drawers: { pos: v(-0.72, 0, -0.37), rotY: 0.12 },
  scope: { pos: v(0.16, 0, -0.34), rotY: -0.06 },
  partsBox: { pos: v(0.06, 0, 0.3), rotY: 0.04 },
  station: { pos: v(0.46, 0, -0.31), rotY: -0.25 },
  spool: { pos: v(0.66, 0, -0.14) },
  helpingHands: { pos: v(-0.67, 0, -0.14), rotY: 0.5 },
  notebook: { pos: v(-0.5, 0, 0.07), rotY: 0.16 },
  meter: { pos: v(0.42, 0, 0.07), rotY: -0.22 },
  mug: { pos: v(0.68, 0, 0.14) },
  cutters: { pos: v(0.24, 0, 0.28), rotY: -0.5 },
  tweezers: { pos: v(0.33, 0, 0.3), rotY: 0.3 },
  resistorTape: { pos: v(-0.3, 0, 0.27), rotY: 0.1 },
  ledBag: { pos: v(-0.14, 0, 0.3), rotY: -0.2 },
  lamp: { base: v(0.75, 0, -0.38), head: v(0.4, 0.5, -0.14), aim: v(0.0, 0, -0.02) },
  corkboard: { pos: v(-0.2, 0.2, -0.448) },
  poster: { pos: v(0.38, 0.22, -0.457) },
} as const;

/** Mat thickness: the breadboard sits on it. */
export const MAT_T = 0.003;
