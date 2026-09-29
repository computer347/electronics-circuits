/**
 * Time-based easing for the desk (never per-frame steps, so slow machines don't crawl), and
 * the reduced-motion switch: with it on, every move is a cut.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

export const FOCUS_SECONDS = 0.7;

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** A number that eases to `target` over `seconds` whenever the target changes. Read `.current` in useFrame. */
export function useEased(target: number, seconds = FOCUS_SECONDS, ease = easeOutCubic) {
  const s = useRef({ from: target, to: target, t0: 0, value: target });
  if (s.current.to !== target) {
    s.current.from = s.current.value;
    s.current.to = target;
    s.current.t0 = performance.now();
  }
  useFrame(() => {
    const st = s.current;
    const dur = reducedMotion() ? 0 : seconds * 1000;
    const t = dur ? Math.min(1, (performance.now() - st.t0) / dur) : 1;
    st.value = st.from + (st.to - st.from) * ease(t);
  });
  return s.current;
}
