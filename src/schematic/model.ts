/**
 * Schematic model: parts are drawn between two grid points, and parts that share a
 * grid point are connected. The circuit (netlist) is DERIVED from the drawing, so the
 * picture and the simulation can never disagree.
 *
 * Connections happen only at part endpoints. A point in the middle of a wire is not a
 * junction; split the wire there instead.
 */

import type { Circuit, Component } from '../sim';

export type Pt = readonly [number, number];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A circuit component positioned on the grid. `p1` is terminal a (+ / anode), `p2` is b. */
export type SchPart = DistributiveOmit<Component, 'a' | 'b'> & {
  p1: Pt;
  p2: Pt;
  /** Overrides the value text under the part (e.g. "R = ?" in a drill). */
  label?: string;
};

export interface NodeLabel {
  at: Pt;
  name: string;
}

export interface Schematic {
  parts: SchPart[];
  /** Grid points connected to ground (drawn with a ground symbol). */
  grounds?: Pt[];
  /** Named nodes, e.g. "out" or "A". The name becomes the netlist node name. */
  labels?: NodeLabel[];
}

export const ptKey = (p: Pt) => `${p[0]},${p[1]}`;

export interface Converted {
  circuit: Circuit;
  /** Netlist node name at a grid point (undefined if nothing is connected there). */
  nodeAt: (p: Pt) => string | undefined;
  /** Points where three or more part ends meet (drawn as dots). */
  junctions: Pt[];
}

class UnionFind {
  private parent = new Map<string, string>();
  add(x: string) { if (!this.parent.has(x)) this.parent.set(x, x); }
  find(x: string): string {
    const p = this.parent.get(x) ?? x;
    if (p === x) return x;
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) { this.add(a); this.add(b); this.parent.set(this.find(a), this.find(b)); }
}

const GROUND_KEY = '#ground';

/**
 * Converts a schematic to a circuit. With `mergeWires` (default) wires simply join
 * their endpoints into one node and don't appear as components.
 */
export function toCircuit(s: Schematic, { mergeWires = true } = {}): Converted {
  const uf = new UnionFind();
  const order: string[] = [];
  const touch = (p: Pt) => {
    const k = ptKey(p);
    if (!order.includes(k)) order.push(k);
    uf.add(k);
    return k;
  };

  const endCount = new Map<string, number>();
  for (const part of s.parts) {
    for (const p of [part.p1, part.p2]) {
      const k = touch(p);
      endCount.set(k, (endCount.get(k) ?? 0) + 1);
    }
    if (mergeWires && part.kind === 'wire') uf.union(ptKey(part.p1), ptKey(part.p2));
  }
  uf.add(GROUND_KEY);
  for (const g of s.grounds ?? []) uf.union(touch(g), GROUND_KEY);

  const labelByRoot = new Map<string, string>();
  for (const l of s.labels ?? []) {
    const root = uf.find(touch(l.at));
    if (!labelByRoot.has(root)) labelByRoot.set(root, l.name);
  }

  const groundRoot = uf.find(GROUND_KEY);
  const names = new Map<string, string>();
  let auto = 1;
  const nameOf = (root: string) => {
    let n = names.get(root);
    if (n) return n;
    n = root === groundRoot ? '0' : labelByRoot.get(root) ?? `n${auto++}`;
    names.set(root, n);
    return n;
  };
  for (const k of order) nameOf(uf.find(k));

  const components: Component[] = [];
  for (const part of s.parts) {
    if (mergeWires && part.kind === 'wire') continue;
    const { p1, p2, label: _label, ...rest } = part;
    components.push({ ...rest, a: nameOf(uf.find(ptKey(p1))), b: nameOf(uf.find(ptKey(p2))) } as Component);
  }

  const junctions: Pt[] = [];
  for (const [k, n] of endCount) {
    if (n >= 3) {
      const [x, y] = k.split(',').map(Number);
      junctions.push([x!, y!]);
    }
  }

  return {
    circuit: { components },
    nodeAt: (p) => (order.includes(ptKey(p)) ? nameOf(uf.find(ptKey(p))) : undefined),
    junctions,
  };
}
