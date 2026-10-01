/** The background jazz, as theory: chords, voicings, the walking bass, swing and the tracks. */
import { describe, expect, it } from 'vitest';
import { hz, parseChord, phrase, rng, swing, TRACKS, voice, walk } from '../src/audio/jazz';

describe('the music theory', () => {
  it('reads chord symbols: roots, sharps and flats, qualities', () => {
    expect(parseChord('Dm7')).toMatchObject({ root: 2, third: 3, seventh: 10 });
    expect(parseChord('Bbmaj7')).toMatchObject({ root: 10, third: 4, seventh: 11 });
    expect(parseChord('F#m7b5')).toMatchObject({ root: 6, fifth: 6 });
    expect(() => parseChord('H7')).toThrow();
  });

  it('voices chords without the root, in the middle of the piano, gliding from one to the next', () => {
    for (const t of TRACKS) {
      let prev: number[] | undefined;
      for (const sym of t.bars) {
        const c = parseChord(sym);
        const v = voice(c, prev);
        expect(v).toHaveLength(4);
        expect(Math.min(...v)).toBeGreaterThanOrEqual(52);
        expect(Math.max(...v)).toBeLessThanOrEqual(76);
        const pcs = v.map((n) => n % 12);
        expect(pcs).toContain((c.root + c.third) % 12);
        expect(pcs).toContain((c.root + c.seventh) % 12);
        if (prev) {
          const centre = (x: number[]) => x.reduce((s, n) => s + n, 0) / x.length;
          expect(Math.abs(centre(v) - centre(prev)), `${t.id} ${sym}`).toBeLessThanOrEqual(6);
        }
        prev = v;
      }
    }
  });

  it('walks the bass from the root to a note a step from the next chord’s root', () => {
    const r = rng(1);
    for (const t of TRACKS) {
      t.bars.forEach((sym, i) => {
        const c = parseChord(sym), next = parseChord(t.bars[(i + 1) % t.bars.length]!);
        const line = walk(c, next, r);
        expect(line).toHaveLength(4);
        expect(line[0]! % 12).toBe(c.root);
        const toNext = ((next.root - line[3]!) % 12 + 12) % 12;
        expect([1, 11]).toContain(toNext);
        for (const n of line) { expect(n).toBeGreaterThanOrEqual(33); expect(n).toBeLessThanOrEqual(52); }
      });
    }
  });

  it('swings the off-beat eighths only, and keeps melody phrases inside the bar', () => {
    expect(swing(1)).toBe(1);
    expect(swing(1.5)).toBeGreaterThan(1.5);
    expect(swing(1.5)).toBeLessThan(1.67);
    const r = rng(7);
    for (let i = 0; i < 200; i++) for (const p of phrase(parseChord('Cmaj7'), 0, r)) { expect(p.beat).toBeLessThan(4); expect(p.note).toBeGreaterThan(60); }
  });

  it('has five tracks at a chill tempo, and A4 at 440 Hz', () => {
    expect(TRACKS).toHaveLength(5);
    for (const t of TRACKS) { expect(t.bpm).toBeGreaterThanOrEqual(60); expect(t.bpm).toBeLessThanOrEqual(80); }
    expect(hz(69)).toBe(440);
  });
});
