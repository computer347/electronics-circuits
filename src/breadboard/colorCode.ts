/** 4-band resistor colour code: two digits, multiplier, tolerance (gold = ±5 %). */

export const BAND_COLORS = [
  '#111111', // 0 black
  '#7a3b12', // 1 brown
  '#d42020', // 2 red
  '#ff7a00', // 3 orange
  '#ffd400', // 4 yellow
  '#1faa3a', // 5 green
  '#1f5fd4', // 6 blue
  '#8a3fd4', // 7 violet
  '#8c8c8c', // 8 grey
  '#f2f2f2', // 9 white
] as const;
export const GOLD = '#c9a227';
export const SILVER = '#b8b8b8';
const NAMES = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];

export interface Bands {
  colors: [string, string, string, string];
  names: [string, string, string, string];
}

export function colorBands(ohms: number): Bands {
  if (!(ohms > 0)) throw new Error('Resistance must be positive');
  let exp = Math.floor(Math.log10(ohms)) - 1;
  let digits = Math.round(ohms / 10 ** exp);
  if (digits >= 100) { digits = Math.round(digits / 10); exp += 1; }
  const d1 = Math.floor(digits / 10);
  const d2 = digits % 10;
  const multColor = exp >= 0 ? BAND_COLORS[exp]! : exp === -1 ? GOLD : SILVER;
  const multName = exp >= 0 ? NAMES[exp]! : exp === -1 ? 'gold' : 'silver';
  return {
    colors: [BAND_COLORS[d1]!, BAND_COLORS[d2]!, multColor, GOLD],
    names: [NAMES[d1]!, NAMES[d2]!, multName, 'gold'],
  };
}
