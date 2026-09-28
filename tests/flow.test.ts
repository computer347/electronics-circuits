import { describe, expect, it } from 'vitest';
import { buildFlow, MIN_AMPS } from '../src/breadboard/flow';
import { analyzeBoard, type BoardState } from '../src/breadboard/model';
import { BENCH_PRESETS } from '../src/breadboard/store';
import { DIODE_KEY } from '../src/sim';

/** Net conventional current flowing into each hole along the flow edges. */
function holeBalance(edges: ReturnType<typeof buildFlow>) {
  const m = new Map<string, number>();
  for (const e of edges) {
    m.set(e.from, (m.get(e.from) ?? 0) - e.amps);
    m.set(e.to, (m.get(e.to) ?? 0) + e.amps);
  }
  return m;
}

describe('flow graph', () => {
  it('LED preset: every hole balances (KCL) and the LED edge carries 21.2 mA', () => {
    const board = structuredClone(BENCH_PRESETS['LED + resistor']!);
    const a = analyzeBoard(board);
    const edges = buildFlow(board, a);
    const led = edges.find((e) => e.id === 'LED1')!;
    expect(led.amps).toBeCloseTo(7 / 330, 5);
    for (const [h, net] of holeBalance(edges)) expect(Math.abs(net), h).toBeLessThan(1e-6);
    // wire currents are real now
    expect(Math.abs(edges.find((e) => e.id === 'W1')!.amps)).toBeCloseTo(7 / 330, 5);
    // supply delivers: conventional current flows - to + inside it
    expect(edges.find((e) => e.id === 'SUPPLY')!.amps).toBeLessThan(0);
  });

  it('two sources: the shared LED current is split between them, and shares sum to the total', () => {
    const board = structuredClone(BENCH_PRESETS['Two sources']!);
    const a = analyzeBoard(board);
    expect(a.result.ok).toBe(true);
    const edges = buildFlow(board, a);
    const led = edges.find((e) => e.id === 'LED1')!;
    expect(led.shares.SUPPLY).toBeGreaterThan(0);
    expect(led.shares.B1).toBeGreaterThan(0);
    expect(led.shares[DIODE_KEY]).toBeLessThan(0);
    const sum = Object.values(led.shares).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(led.amps, 9);
    for (const [h, net] of holeBalance(edges)) expect(Math.abs(net), h).toBeLessThan(1e-6);
  });

  it('a reversed LED means no current anywhere', () => {
    const board: BoardState = structuredClone(BENCH_PRESETS['LED + resistor']!);
    const led = board.parts.find((p) => p.id === 'LED1')!;
    [led.h1, led.h2] = [led.h2, led.h1];
    const edges = buildFlow(board, analyzeBoard(board));
    expect(edges.every((e) => Math.abs(e.amps) < MIN_AMPS)).toBe(true);
  });

  it('a failed solve gives an empty graph', () => {
    const board: BoardState = { supply: { volts: 9, on: true }, parts: [{ id: 'W1', kind: 'wire', h1: 'T+:5', h2: 'T-:5' }] };
    expect(buildFlow(board, analyzeBoard(board))).toEqual([]);
  });
});
