/** SI formatting for display: formatSI(0.0212, 'A') -> "21.2 mA". */

const PREFIXES: [number, string][] = [
  [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'],
];

export function formatSI(value: number, unit: string, sig = 3): string {
  if (!Number.isFinite(value)) return `— ${unit}`;
  if (value === 0) return `0 ${unit}`;
  const abs = Math.abs(value);
  const [scale, prefix] = PREFIXES.find(([s]) => abs >= s * 0.9995) ?? PREFIXES[PREFIXES.length - 1]!;
  const n = Number((value / scale).toPrecision(sig));
  return `${n} ${prefix}${unit}`;
}

export const UNIT_SYMBOL = { ohm: 'Ω', volt: 'V', amp: 'A', farad: 'F', second: 's' } as const;
