/**
 * What you can do in the circuit world, as pure functions: the things you can use (a door to
 * turn round, a drawbridge to hold, the power panel), and a walkable route to a place for
 * click-to-walk (through links you can pass; ledges only downhill).
 */
import * as THREE from 'three';
import type { Walker } from './walker';
import { linkPoint, type Link, type World } from './world';

export type Target = { kind: 'door' | 'bridge' | 'panel'; id: string; pos: THREE.Vector3; label: string };

/** Things you can use, where they are. */
export function targets(w: World): Target[] {
  const out: Target[] = [];
  for (const l of w.links) {
    if (l.kind === 'door' && l.room?.fault === 'reversed') out.push({ kind: 'door', id: l.id, pos: linkPoint(l, l.at).setY(l.h0 + 1.4), label: `turn ${l.id}'s door round` });
    if (l.kind === 'bridge') out.push({ kind: 'bridge', id: l.id, pos: linkPoint(l, l.at - 0.25).setY(l.h0 + 1.2), label: `hold ${l.id} down` });
  }
  // The power panel stands on the top plaza, beside where the stair arrives.
  const stair = w.links[0]!;
  const top = w.plazas[stair.to]!;
  const [ax, az] = stair.path[stair.path.length - 1]!;
  const dx = ax - top.center[0], dz = az - top.center[1], d = Math.hypot(dx, dz) || 1;
  const side = [-dz / d, dx / d];
  out.push({ kind: 'panel', id: 'PANEL', pos: new THREE.Vector3(top.center[0] + (dx / d) * 2.2 + side[0]! * 2.2, top.height + 1.2, top.center[1] + (dz / d) * 2.2 + side[1]! * 2.2), label: 'switch the power on' });
  return out;
}

/** A route to a plaza from where you are, through links you can pass (ledges only downhill). */
export function routeTo(w: World, s: Walker, target: number): [number, number][] {
  let here = 0, best = Infinity;
  w.plazas.forEach((p, i) => { const d = Math.hypot(p.center[0] - s.x, p.center[1] - s.z); if (d < best) { best = d; here = i; } });
  const prev = new Map<number, { from: number; link: Link; forward: boolean }>();
  const queue = [here];
  const visited = new Set([here]);
  while (queue.length) {
    const a = queue.shift()!;
    for (const l of w.links) {
      if (!l.passable) continue;
      const pairs: [number, number, boolean][] = [[l.from, l.to, true]];
      if (l.profile === 'slope') pairs.push([l.to, l.from, false]);
      for (const [x, y, fwd] of pairs) {
        if (x !== a || visited.has(y)) continue;
        visited.add(y); prev.set(y, { from: x, link: l, forward: fwd }); queue.push(y);
      }
    }
  }
  if (!visited.has(target)) return [];
  const steps: [number, number][] = [];
  let at = target;
  while (at !== here) {
    const p = prev.get(at)!;
    const pts = p.forward ? p.link.path : [...p.link.path].reverse();
    steps.unshift(...pts, w.plazas[at]!.center);
    at = p.from;
  }
  return [w.plazas[here]!.center, ...steps];
}
