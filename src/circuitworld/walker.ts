/**
 * First-person movement on the circuit world: a small kinematic controller, no physics engine.
 * The world is 2.5D (floors with a height, nothing overhead), so a step is: move in x/z, find
 * the floor under you, step up small rises (ramps), fall onto lower floors (ledges), and stop
 * where there's no floor you can reach (walls, gaps, a closed door, a ledge too high to climb).
 * Height is voltage, so there's no jumping: the only way up is the supply's stair.
 *
 * Deterministic and pure, so it's tested without WebGL.
 */
import { floorsAt, type World } from './world';

export const EYE = 1.6;
export const CROUCH_EYE = 1.0;
export const SPEED = { walk: 4, sprint: 7, crouch: 1.6 } as const;
/** Highest rise you can step up in one go (a ramp is many small ones). */
export const STEP_UP = 0.35;
export const RADIUS = 0.3;
const GRAVITY = 18;
const ACCEL = 1 / 0.15;

export interface Walker {
  x: number; y: number; z: number;
  /** Heading: forward is (cos yaw, −sin yaw) in x/z. */
  yaw: number;
  pitch: number;
  vx: number; vz: number; vy: number;
  crouch: boolean;
  /** Seconds since the last bump into something (for the camera shake and prompts). */
  bumped: number;
}

export interface MoveInput {
  /** −1..1 each: forward/back and right/left. */
  forward: number;
  strafe: number;
  sprint: boolean;
  crouch: boolean;
}

export const forwardOf = (yaw: number): [number, number] => [Math.cos(yaw), -Math.sin(yaw)];

export function spawnWalker(w: World): Walker {
  const [x, y, z] = w.spawn.pos;
  return { x, y, z, yaw: w.spawn.yaw, pitch: -0.12, vx: 0, vz: 0, vy: 0, crouch: false, bumped: 99 };
}

/** The floor you'd stand on at (x, z) coming from height y: the highest one you can reach. */
export function standable(w: World, x: number, z: number, y: number): number | undefined {
  return floorsAt(w, x, z).find((f) => f <= y + STEP_UP);
}

/** Can the body (a circle of RADIUS) stand at (x, z) from height y? Every rim point needs a reachable floor. */
function bodyFits(w: World, x: number, z: number, y: number): number | undefined {
  const centre = standable(w, x, z, y);
  if (centre === undefined) return undefined;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (standable(w, x + Math.cos(a) * RADIUS, z + Math.sin(a) * RADIUS, y) === undefined) return undefined;
  }
  return centre;
}

/** Advance the walker by dt seconds. Returns true if it bumped into something. */
export function step(w: World, s: Walker, input: MoveInput, dt: number): boolean {
  dt = Math.min(dt, 0.05);
  s.crouch = input.crouch;
  const speed = input.crouch ? SPEED.crouch : input.sprint ? SPEED.sprint : SPEED.walk;
  const [fx, fz] = forwardOf(s.yaw);
  const rx = -fz, rz = fx; // right of forward
  let wx = fx * input.forward + rx * input.strafe, wz = fz * input.forward + rz * input.strafe;
  const len = Math.hypot(wx, wz);
  if (len > 1) { wx /= len; wz /= len; }
  // Ease toward the wanted velocity (time-based).
  const k = Math.min(1, ACCEL * dt);
  s.vx += (wx * speed - s.vx) * k;
  s.vz += (wz * speed - s.vz) * k;

  let bumped = false;
  const tryMove = (dx: number, dz: number) => {
    const f = bodyFits(w, s.x + dx, s.z + dz, s.y);
    if (f === undefined) return false;
    s.x += dx; s.z += dz;
    return true;
  };
  const dx = s.vx * dt, dz = s.vz * dt;
  if ((dx || dz) && !tryMove(dx, dz)) {
    // Slide along whatever stopped us: try each axis on its own.
    bumped = true;
    const slidX = tryMove(dx, 0);
    const slidZ = tryMove(0, dz);
    if (!slidX) s.vx = 0;
    if (!slidZ) s.vz = 0;
  }

  // Floor: step up onto small rises, fall onto lower floors.
  const floor = standable(w, s.x, s.z, s.y);
  if (floor !== undefined) {
    if (floor >= s.y) { s.y = floor; s.vy = 0; }
    else {
      s.vy -= GRAVITY * dt;
      s.y = Math.max(floor, s.y + s.vy * dt);
      if (s.y === floor) s.vy = 0;
    }
  }
  s.bumped = bumped ? 0 : s.bumped + dt;
  return bumped;
}

/** Walk straight toward a point for up to `seconds`; used by click-to-walk and the tests. */
export function walkToward(w: World, s: Walker, x: number, z: number, seconds: number, dt = 1 / 60): boolean {
  for (let t = 0; t < seconds; t += dt) {
    const dx = x - s.x, dz = z - s.z;
    if (Math.hypot(dx, dz) < 0.4) return true;
    s.yaw = Math.atan2(-dz, dx);
    step(w, s, { forward: 1, strafe: 0, sprint: false, crouch: false }, dt);
  }
  return Math.hypot(x - s.x, z - s.z) < 0.4;
}

/** Follow a link's path from its start to its end (stopping where it's blocked). */
export function walkLink(w: World, s: Walker, linkIndex: number, seconds = 20): boolean {
  const l = w.links[linkIndex]!;
  for (const p of l.path) if (!walkToward(w, s, p[0], p[1], seconds)) return false;
  const to = w.plazas[l.to]!;
  return walkToward(w, s, to.center[0], to.center[1], seconds);
}
