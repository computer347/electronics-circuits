/**
 * The workshop's economy: what parts and tools cost, and what a job pays. Pay follows cost
 * (parts × 1.5 + labour by tier), and every tool costs several jobs of the tier below it, so
 * no single job sets you up: you earn more as you go, and spend more to earn it.
 * 1 credit is roughly €0.10 at hobby prices. See docs/design/tycoon.md.
 */

/** Stock you keep on the shelf, by kind of part. */
export type StockKind = 'resistor' | 'led' | 'capacitor' | 'switch' | 'diode' | 'transistor' | 'pot' | 'mosfet' | 'regulator' | 'chip';

/** What one part costs, in credits. */
export const PART_PRICE: Record<StockKind, number> = {
  resistor: 1, led: 2, capacitor: 2, switch: 3, diode: 1, transistor: 3, pot: 6, mosfet: 10, regulator: 8, chip: 6,
};

export const STOCK_NAME: Record<StockKind, string> = {
  resistor: 'Resistors', led: 'LEDs', capacitor: 'Capacitors', switch: 'Switches and buttons', diode: 'Diodes', transistor: 'Transistors',
  pot: 'Potentiometers', mosfet: 'MOSFETs', regulator: 'Regulators', chip: 'Logic chips',
};

/** Packs the shop sells: a bit cheaper per part than buying singly would be. */
export const PACKS: { kind: StockKind; count: number; price: number }[] = (Object.keys(PART_PRICE) as StockKind[]).map((kind) => {
  const count = PART_PRICE[kind] <= 2 ? 20 : PART_PRICE[kind] <= 6 ? 10 : 5;
  return { kind, count, price: Math.round(count * PART_PRICE[kind] * 0.85) };
});

/** What you start with on the shelf. */
export const STARTER_STOCK: Partial<Record<StockKind, number>> = { resistor: 30, led: 10, switch: 4 };

export interface Tool {
  id: string;
  name: string;
  /** The job tier it opens. */
  tier: number;
  price: number;
  /** What it lets you do, in one line. */
  what: string;
  /** Stock kinds the shop only sells once you own it. */
  stocks?: StockKind[];
}

/** Labour rate by tier, credits per job of average difficulty. */
export const LABOUR = [10, 16, 26, 40, 60, 90] as const;
/** What a typical job of each tier uses in parts, in credits. */
export const TYPICAL_PARTS = [6, 10, 16, 22, 34, 50] as const;

/** Pay for a job: parts at 1.5×, labour by tier and difficulty, scaled by quality, plus a bonus for being on time. */
export function jobPay(o: { tier: number; partsCost: number; difficulty?: 1 | 2 | 3; stars: 1 | 2 | 3; onTime?: boolean }): number {
  const labour = LABOUR[Math.max(0, Math.min(LABOUR.length - 1, o.tier))]! * (0.6 + 0.4 * (o.difficulty ?? 2));
  const quality = [0, 0.6, 0.85, 1][o.stars]!;
  const onTime = o.onTime ? 0.15 * labour : 0;
  return Math.round(o.partsCost * 1.5 + labour * quality + onTime);
}

/** What a good (3-star, on time, average difficulty) job pays at a tier. */
export const typicalPay = (tier: number) => jobPay({ tier, partsCost: TYPICAL_PARTS[Math.min(tier, TYPICAL_PARTS.length - 1)]!, stars: 3, onTime: true });

/** Each tool opens a tier and costs about 6–10 good jobs of the tier below. */
export const TOOLS: Tool[] = [
  { id: 'meter-basic', name: 'Basic multimeter', tier: 0, price: 0, what: 'Volts only. Enough to find where the voltage goes missing.' },
  { id: 'supply', name: 'Bench supply', tier: 0, price: 0, what: 'A steady 0–30 V with a current limit, so mistakes don’t smoke.' },
  { id: 'meter-auto', name: 'Autoranging multimeter', tier: 1, price: Math.round(typicalPay(0) * 7), what: 'Adds Ω, the diode test and milliamps: find reversed parts and wrong values without guessing.' },
  { id: 'semis', name: 'Semiconductor drawer', tier: 2, price: Math.round(typicalPay(1) * 7), what: 'Diodes, transistors, MOSFETs and pots on the shelf: switching, sensors and protection jobs.', stocks: ['diode', 'transistor', 'pot', 'mosfet', 'regulator'] },
  { id: 'scope', name: 'Oscilloscope', tier: 3, price: Math.round(typicalPay(2) * 8), what: 'See voltage over time: timing, charging and anything that changes.', stocks: ['capacitor'] },
  { id: 'logic', name: 'Logic kit and probe', tier: 4, price: Math.round(typicalPay(3) * 8), what: 'A drawer of 74HC chips and a probe that reads high and low: logic design jobs.', stocks: ['chip'] },
  { id: 'iron', name: 'Soldering station', tier: 5, price: Math.round(typicalPay(4) * 9), what: 'Temperature-controlled, with a fine tip: repair real boards and modules.' },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
/** Every tool you start with. */
export const STARTER_TOOLS = TOOLS.filter((t) => t.price === 0).map((t) => t.id);
/** The highest job tier your tools open. */
export const toolTier = (owned: string[]) => Math.max(0, ...TOOLS.filter((t) => owned.includes(t.id)).map((t) => t.tier));
/** Stock kinds the shop sells you, given your tools. */
export function stockOnSale(owned: string[]): StockKind[] {
  const gated = new Set(TOOLS.flatMap((t) => t.stocks ?? []));
  const open = new Set(TOOLS.filter((t) => owned.includes(t.id)).flatMap((t) => t.stocks ?? []));
  return (Object.keys(PART_PRICE) as StockKind[]).filter((k) => !gated.has(k) || open.has(k));
}
