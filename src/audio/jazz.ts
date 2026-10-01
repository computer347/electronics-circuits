/**
 * The music, as theory: chord symbols to notes, smooth rootless voicings, a walking bass line,
 * swung comping and drum patterns, and the tracks themselves. Pure functions, so they can be
 * tested; src/audio/engine.ts turns them into sound with Web Audio.
 *
 * Notes are MIDI numbers (60 = middle C). A bar is 4 beats; a beat splits into swung eighths.
 */

export type Rng = () => number;
export const rng = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Chord qualities: intervals from the root (3rd, 5th, 7th, and the 9th for colour). */
const QUALITY: Record<string, { third: number; fifth: number; seventh: number; ninth: number }> = {
  maj7: { third: 4, fifth: 7, seventh: 11, ninth: 14 },
  m7: { third: 3, fifth: 7, seventh: 10, ninth: 14 },
  '7': { third: 4, fifth: 7, seventh: 10, ninth: 14 },
  m7b5: { third: 3, fifth: 6, seventh: 10, ninth: 13 },
  '6': { third: 4, fifth: 7, seventh: 9, ninth: 14 },
};

export interface Chord { symbol: string; root: number; third: number; fifth: number; seventh: number; ninth: number }

/** "Dm7", "Bbmaj7", "F#m7b5", "G7" → root pitch class and intervals. */
export function parseChord(symbol: string): Chord {
  const m = /^([A-G])([b#]?)(maj7|m7b5|m7|7|6)$/.exec(symbol);
  if (!m) throw new Error(`Can't read the chord ${symbol}`);
  const root = (NOTE[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { symbol, root, ...QUALITY[m[3]!]! };
}

/**
 * A rootless voicing (3rd, 7th, 9th and 5th, the way jazz pianists leave the root to the bass),
 * placed between E3 and E5 as close as possible to the previous voicing so the chords glide.
 */
export function voice(c: Chord, previous?: number[]): number[] {
  const tones = [c.third, c.seventh, c.ninth, c.fifth].map((i) => (c.root + i) % 12);
  // every way of placing each tone in an octave between E3 and E5, kept if it's a close
  // voicing (all four within an octave), then the one nearest the last chord
  const places = tones.map((pc) => [40, 52, 64, 76].map((o) => o + ((pc - o) % 12 + 12) % 12).filter((n) => n >= 52 && n <= 76));
  const candidates: number[][] = [];
  const pick = (i: number, acc: number[]) => {
    if (i === places.length) { const v = [...acc].sort((x, y) => x - y); if (v[v.length - 1]! - v[0]! <= 12 && new Set(v).size === v.length) candidates.push(v); return; }
    for (const n of places[i]!) pick(i + 1, [...acc, n]);
  };
  pick(0, []);
  const centre = (v: number[]) => v.reduce((s, n) => s + n, 0) / v.length;
  const target = previous ? centre(previous) : 62;
  return candidates.reduce((best, v) => (Math.abs(centre(v) - target) < Math.abs(centre(best) - target) ? v : best));
}

/**
 * A walking bass bar: four quarter notes, starting on the root, through chord tones, and the
 * last one a step above or below the next chord's root so it leads into it.
 */
export function walk(c: Chord, next: Chord, r: Rng): number[] {
  const low = 36; // C2
  const at = (pc: number) => low + ((pc - low) % 12 + 12) % 12;
  const root = at(c.root);
  const second = root + (r() < 0.5 ? c.third : c.fifth);
  const third = root + (r() < 0.5 ? c.fifth : c.seventh > 10 ? c.seventh - 12 : c.third);
  const target = at(next.root);
  const lead = target + (r() < 0.5 ? 1 : -1);
  return [root, second, third, lead].map((n) => (n > 52 ? n - 12 : n < 33 ? n + 12 : n));
}

/** Where in a bar the piano comps (in beats), picked from relaxed patterns: never busy. */
export const COMP_PATTERNS: number[][] = [[0, 2.5], [0.5, 2], [1.5, 3], [0, 1.5, 3], [2.5], [0, 2]];

/** Swing: the off-beat eighth lands two-thirds of the way through the beat, softened. */
export const swing = (beat: number, amount = 0.6) => {
  const whole = Math.floor(beat), frac = beat - whole;
  return Math.abs(frac - 0.5) < 1e-9 ? whole + 0.5 + (amount - 0.5) * 0.5 : beat;
};

/** A melody phrase over a chord: a few notes from the chord and the key's pentatonic, near E5. */
export function phrase(c: Chord, key: number, r: Rng): { beat: number; note: number; len: number }[] {
  if (r() < 0.45) return []; // space is the point
  const pent = [0, 2, 4, 7, 9].map((i) => (key + i) % 12);
  const chord = [c.third, c.fifth, c.seventh, c.ninth].map((i) => (c.root + i) % 12);
  const pool = [...new Set([...chord, ...pent])];
  const out: { beat: number; note: number; len: number }[] = [];
  let beat = [0.5, 1, 1.5, 2][Math.floor(r() * 4)]!;
  let note = 72 + ((pool[Math.floor(r() * pool.length)]! - 72) % 12 + 12) % 12;
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n && beat < 4; k++) {
    const len = [0.5, 0.5, 1, 1.5][Math.floor(r() * 4)]!;
    out.push({ beat, note, len });
    // step to a nearby note of the pool
    const near = pool.map((pc) => { let x = note - 5; while ((x % 12 + 12) % 12 !== pc) x++; return x; }).filter((x) => x !== note && Math.abs(x - note) <= 5);
    note = near[Math.floor(r() * near.length)] ?? note;
    beat += len;
  }
  return out;
}

export type Style = 'swing' | 'bossa' | 'lofi' | 'ballad';
/** Sampled instruments (public/music/samples): electric piano, acoustic bass, vibraphone, nylon guitar, grand piano. */
export type Instrument = 'epiano' | 'bass' | 'vibes' | 'guitar' | 'piano';

export interface Track {
  id: string;
  name: string;
  bpm: number;
  /** Key, as a pitch class (for the melody's pentatonic; minor keys use their relative major). */
  key: number;
  /** One chord a bar. */
  bars: string[];
  style: Style;
  /** Who plays the chords, and who plays the tune. */
  comp: Instrument;
  lead: Instrument;
}

export const TRACKS: Track[] = [
  { id: 'solder-smoke', name: 'Solder Smoke', bpm: 72, key: 0, style: 'swing', comp: 'epiano', lead: 'vibes', bars: ['Dm7', 'G7', 'Cmaj7', 'A7', 'Dm7', 'G7', 'Cmaj7', 'Cmaj7'] },
  { id: 'late-bench', name: 'Late Bench', bpm: 66, key: 0, style: 'swing', comp: 'epiano', lead: 'vibes', bars: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7', 'G7'] },
  { id: 'warm-resistor', name: 'Warm Resistor', bpm: 76, key: 7, style: 'swing', comp: 'piano', lead: 'vibes', bars: ['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'F#m7b5', 'B7', 'Em7', 'Em7'] },
  { id: 'blue-led', name: 'Blue LED', bpm: 70, key: 3, style: 'swing', comp: 'epiano', lead: 'vibes', bars: ['Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Ebmaj7', 'Cm7', 'Fm7', 'Bb7'] },
  { id: 'low-tide-lab', name: 'Low Tide Lab', bpm: 68, key: 5, style: 'swing', comp: 'epiano', lead: 'piano', bars: ['Bbmaj7', 'Bbmaj7', 'Am7', 'D7', 'Gm7', 'C7', 'Fmaj7', 'F6'] },
  { id: 'copper-rain', name: 'Copper Rain', bpm: 116, key: 0, style: 'bossa', comp: 'guitar', lead: 'vibes', bars: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7', 'Cm7', 'F7', 'Bbmaj7', 'Bbmaj7'] },
  { id: 'sunday-soldering', name: 'Sunday Soldering', bpm: 110, key: 5, style: 'bossa', comp: 'guitar', lead: 'piano', bars: ['Fmaj7', 'Gm7', 'C7', 'Fmaj7', 'Am7', 'D7', 'Gm7', 'C7'] },
  { id: 'night-shift', name: 'Night Shift', bpm: 78, key: 0, style: 'lofi', comp: 'epiano', lead: 'vibes', bars: ['Am7', 'Fmaj7', 'Dm7', 'E7', 'Am7', 'Fmaj7', 'Dm7', 'E7'] },
  { id: 'low-battery', name: 'Low Battery', bpm: 74, key: 3, style: 'lofi', comp: 'epiano', lead: 'piano', bars: ['Ebmaj7', 'Dm7', 'Cm7', 'Bb6', 'Ebmaj7', 'Dm7', 'Cm7', 'Bb6'] },
  { id: 'pull-up', name: 'Pull-up', bpm: 82, key: 5, style: 'lofi', comp: 'piano', lead: 'epiano', bars: ['Gm7', 'C7', 'Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7', 'Fmaj7'] },
  { id: 'ground-loop', name: 'Ground Loop', bpm: 58, key: 0, style: 'ballad', comp: 'piano', lead: 'vibes', bars: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', 'G7'] },
];

/**
 * A track's melody motif: a two-bar rhythm with a melodic shape (steps up or down through the
 * chord and pentatonic tones), the same every time the track plays, so the tune has a hook.
 */
export interface Motif { notes: { beat: number; len: number; step: number }[] }

export function motif(trackId: string): Motif {
  const r = rng([...trackId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 11));
  const notes: Motif['notes'] = [];
  let beat = [0, 0.5, 1][Math.floor(r() * 3)]!;
  while (beat < 7) {
    const len = [0.5, 0.5, 1, 1, 1.5, 2][Math.floor(r() * 6)]!;
    notes.push({ beat, len: Math.min(len, 8 - beat), step: [-2, -1, -1, 1, 1, 2, 0][Math.floor(r() * 7)]! });
    beat += len + (r() < 0.3 ? 0.5 : 0);
  }
  return { notes };
}

/**
 * The motif played over a chord: each step moves through the pool of chord and pentatonic
 * tones, starting near `start`. `bar` is 0 or 1 (which half of the motif). Variation lets the
 * answer phrase differ from the call.
 */
export function playMotif(m: Motif, bar: 0 | 1, c: Chord, key: number, start: number, vary: number, r: Rng): { beat: number; note: number; len: number }[] {
  const pent = [0, 2, 4, 7, 9].map((i) => (key + i) % 12);
  const chord = [c.third, c.fifth, c.seventh, c.ninth].map((i) => (c.root + i) % 12);
  const pool = [...new Set([...chord, ...pent])];
  const ladder: number[] = [];
  for (let n = 60; n <= 88; n++) if (pool.includes(n % 12)) ladder.push(n);
  let idx = ladder.reduce((best, n, i) => (Math.abs(n - start) < Math.abs(ladder[best]! - start) ? i : best), 0);
  const out: { beat: number; note: number; len: number }[] = [];
  for (const n of m.notes) {
    idx = Math.max(0, Math.min(ladder.length - 1, idx + n.step + (r() < vary ? (r() < 0.5 ? 1 : -1) : 0)));
    const inBar = n.beat - bar * 4;
    if (inBar >= 0 && inBar < 4) out.push({ beat: inBar, note: ladder[idx]!, len: n.len });
  }
  return out;
}

/** Bossa nova: the guitar's syncopated comping (two-bar cycle), the bass's root–fifth, the rim clave. */
export const BOSSA_COMP = [[0, 1.5, 3], [0.5, 2, 3.5]] as const;
export const BOSSA_BASS = [{ beat: 0, len: 1.5, tone: 'root' }, { beat: 1.5, len: 0.5, tone: 'fifth' }, { beat: 2, len: 1.5, tone: 'fifth' }, { beat: 3.5, len: 0.5, tone: 'root' }] as const;
export const BOSSA_CLAVE = [[0, 1.5, 3], [1, 2]] as const;
/** Lo-fi: a lazy boom-bap kick, snare on 2 and 4, eighth hats; the chord held across the bar. */
export const LOFI_KICK = [[0, 2.5], [0, 1.75, 2.5]] as const;

/** Hz from a MIDI note. */
export const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
