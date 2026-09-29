/**
 * 3D paths that current takes through each part. The scene draws parts along these
 * paths, and the flow view moves electrons along exactly the same lines.
 */
import * as THREE from 'three';
import { hole, type HoleId } from './layout';
import type { BoardPart } from './model';

export type V3 = [number, number, number];
const at = (id: HoleId, y = 0): V3 => { const h = hole(id); return [h.x, y, h.z]; };

export const RESISTOR_Y = 0.55;
export const CAP_Y = 0.75;
export const SUPPLY_BOX: V3 = [-13.2, 0.5, -11.8];
export const SUPPLY_HOLES = { plus: 'T+:1', minus: 'T-:1' } as const;

/**
 * A jumper wire: straight up out of each hole, then one smooth arch over to the other hole.
 * The arch's control points sit right above the legs, so the tangent is vertical where the legs
 * meet the bend (no kink), and it rises with the span so long wires clear the parts under them.
 */
export function wireCurve(h1: HoleId, h2: HoleId): THREE.CurvePath<THREE.Vector3> {
  const a = new THREE.Vector3(...at(h1, -0.2)), b = new THREE.Vector3(...at(h2, -0.2));
  const span = a.distanceTo(b);
  const lift = Math.min(3.2, 1.1 + span * 0.2);
  const a2 = a.clone().setY(0.15), b2 = b.clone().setY(0.15);
  const curve = new THREE.CurvePath<THREE.Vector3>();
  curve.add(new THREE.LineCurve3(a, a2));
  curve.add(new THREE.CubicBezierCurve3(a2, a2.clone().setY(lift), b2.clone().setY(lift), b2));
  curve.add(new THREE.LineCurve3(b2, b));
  return curve;
}

/** Lead from the bench supply to a rail hole (dx picks the + or - terminal side). */
export function supplyLeadCurve(to: HoleId, dx: number): THREE.CatmullRomCurve3 {
  const from = new THREE.Vector3(SUPPLY_BOX[0] + dx, 0.6, SUPPLY_BOX[2] + 0.9);
  const end = new THREE.Vector3(...at(to, -0.2));
  const c = from.clone().add(end).multiplyScalar(0.5).setY(1.6);
  return new THREE.CatmullRomCurve3([from, c, end.clone().setY(0.4), end]);
}

/** Resistor body end points along the leg-to-leg direction. */
export function resistorGeometry(part: BoardPart) {
  const a = new THREE.Vector3(...at(part.h1)), b = new THREE.Vector3(...at(part.h2));
  const dir = b.clone().sub(a);
  const bodyLen = Math.min(2.0, Math.max(dir.length() - 0.5, 0.6));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const u = dir.clone().normalize();
  const e1 = mid.clone().addScaledVector(u, -bodyLen / 2), e2 = mid.clone().addScaledVector(u, bodyLen / 2);
  return { a, b, mid, u, e1, e2, bodyLen };
}

export const ledMid = (part: BoardPart): V3 => {
  const a = at(part.h1), b = at(part.h2);
  return [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2];
};

/** Polyline from leg h1 to leg h2 through the part. */
export function partPoints(part: BoardPart): V3[] {
  const a = at(part.h1), b = at(part.h2);
  switch (part.kind) {
    case 'resistor': {
      const { e1, e2 } = resistorGeometry(part);
      const y = RESISTOR_Y;
      return [a, [a[0], y, a[2]], [e1.x, y, e1.z], [e2.x, y, e2.z], [b[0], y, b[2]], b];
    }
    case 'led': {
      const m = ledMid(part);
      return [a, [m[0] - 0.1, 0.9, m[2]], [m[0], 1.25, m[2]], [m[0] + 0.1, 0.8, m[2]], b];
    }
    case 'battery': {
      const m = ledMid(part);
      return [a, [a[0], 0.5, a[2]], [m[0], 0.9, m[2]], [b[0], 0.5, b[2]], b];
    }
    case 'button':
      return [a, [a[0], 0.25, a[2]], [b[0], 0.25, b[2]], b];
    case 'capacitor': {
      const m = ledMid(part);
      return [a, [a[0], 0.35, a[2]], [m[0], CAP_Y, m[2]], [b[0], 0.35, b[2]], b];
    }
    case 'generator': {
      const m = ledMid(part);
      return [a, [a[0], 0.6, a[2]], [m[0], 1.1, m[2]], [b[0], 0.6, b[2]], b];
    }
    case 'wire':
      return wireCurve(part.h1, part.h2).getSpacedPoints(24).map((p) => [p.x, p.y, p.z] as V3);
  }
}

/** Path through the bench supply: + rail hole, up the red lead, through the box, down the black lead. */
export function supplyPoints(): V3[] {
  const plus = supplyLeadCurve(SUPPLY_HOLES.plus, 0.7).getSpacedPoints(16).reverse();
  const minus = supplyLeadCurve(SUPPLY_HOLES.minus, -0.7).getSpacedPoints(16);
  return [...plus, ...minus].map((p) => [p.x, p.y, p.z] as V3);
}

export function polylineLength(pts: V3[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, z0] = pts[i - 1]!, [x1, y1, z1] = pts[i]!;
    L += Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  }
  return L;
}

/** Point at distance s along a polyline (clamped). */
export function pointAt(pts: V3[], s: number, out: THREE.Vector3): THREE.Vector3 {
  let rest = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, z0] = pts[i - 1]!, [x1, y1, z1] = pts[i]!;
    const seg = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    if (rest <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, rest / seg) : 0;
      return out.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t);
    }
    rest -= seg;
  }
  const [x, y, z] = pts[pts.length - 1]!;
  return out.set(x, y, z);
}
