/**
 * Parts move like real ones. The part is always drawn at its new holes; this wrapper starts it
 * off at its old pose and eases it home:
 * - placed: drops into its holes with a small bounce,
 * - flipped (legs swapped): lifts, turns round about its middle and settles back down,
 * - moved: lifts, glides and turns to the new spot.
 * Time-based, and skipped entirely with reduced motion or when a whole board is loaded.
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { hole } from './layout';
import type { BoardPart } from './model';
import { useBench } from './store';

type Legs = { h1: string; h2: string };
type Anim =
  | { kind: 'drop'; t0: number }
  | { kind: 'flip'; t0: number }
  | { kind: 'move'; t0: number; from: Legs };

const DURATION = { drop: 420, flip: 800, move: 520 } as const;
/** Last legs seen for each part id, and the board load they belong to. */
const lastLegs = new Map<string, Legs>();
let seenGeneration = -1;
let seenGenerationAt = 0;

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const mid = (l: Legs) => { const a = hole(l.h1), b = hole(l.h2); return new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2); };
/** Heading of a part (h1 → h2) as a rotation about y. */
const yawOf = (l: Legs) => { const a = hole(l.h1), b = hole(l.h2); return Math.atan2(-(b.z - a.z), b.x - a.x); };
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
function bounce(t: number) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export function PartMotion({ part, still, children }: { part: BoardPart; still?: boolean; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const anim = useRef<Anim | null>(null);
  const generation = useBench((s) => s.generation);

  useLayoutEffect(() => {
    if (generation !== seenGeneration) { seenGeneration = generation; seenGenerationAt = performance.now(); lastLegs.clear(); }
    const prev = lastLegs.get(part.id);
    // A three-legged part turns about its middle leg, so its end legs stand for it.
    const now: Legs = { h1: part.h1, h2: part.h3 ?? part.h2 };
    lastLegs.set(part.id, now);
    if (still || reduced()) return;
    const t0 = performance.now();
    if (!prev) {
      // A part in a freshly loaded board just appears; one you place drops in.
      if (t0 - seenGenerationAt < 250) return;
      anim.current = { kind: 'drop', t0 };
    } else if (prev.h1 === now.h2 && prev.h2 === now.h1) anim.current = { kind: 'flip', t0 };
    else if (prev.h1 !== now.h1 || prev.h2 !== now.h2) anim.current = { kind: 'move', t0, from: prev };
  }, [part.id, part.h1, part.h2, part.h3, still, generation]);

  useFrame(() => {
    const group = g.current;
    if (!group) return;
    const a = anim.current;
    if (!a) { group.position.set(0, 0, 0); group.rotation.set(0, 0, 0); return; }
    const k = Math.min(1, (performance.now() - a.t0) / DURATION[a.kind]);
    const m = mid(part);
    let offset = new THREE.Vector3(), yaw = 0, lift = 0;
    if (a.kind === 'drop') lift = (1 - bounce(k)) * 2.2;
    if (a.kind === 'flip') {
      // Up, round, down: the turn happens while it's in the air.
      const e = easeInOut(Math.min(1, Math.max(0, (k - 0.15) / 0.7)));
      yaw = Math.PI * (1 - e);
      lift = Math.sin(Math.PI * k) * 1.8;
    }
    if (a.kind === 'move') {
      const e = easeInOut(k);
      offset = mid(a.from).sub(m).multiplyScalar(1 - e);
      yaw = wrapAngle(yawOf(a.from) - yawOf(part)) * (1 - e);
      lift = Math.sin(Math.PI * k) * 1.4;
    }
    // Rotate about the part's own middle, then offset and lift.
    const rotated = m.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    group.rotation.set(0, yaw, 0);
    group.position.copy(m).sub(rotated).add(offset).add(new THREE.Vector3(0, lift, 0));
    if (k >= 1) anim.current = null;
  });

  return <group ref={g}>{children}</group>;
}
