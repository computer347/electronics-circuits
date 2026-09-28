/** Small seeded RNG so every drill can be reproduced from its seed. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

/** A standard E12 resistor value between min and max ohms (inclusive). */
export function e12(rng: Rng, min: number, max: number): number {
  const values: number[] = [];
  for (let decade = 1; decade <= 1e6; decade *= 10) {
    for (const m of E12) {
      const v = Number((m * decade).toPrecision(2));
      if (v >= min && v <= max) values.push(v);
    }
  }
  return pick(rng, values);
}
