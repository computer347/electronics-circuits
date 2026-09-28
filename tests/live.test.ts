import { describe, expect, it } from 'vitest';
import { LiveBench } from '../src/breadboard/live';
import { analyzeBoard, boardToCircuit, isDynamicBoard, reversedElectrolytics, type BoardState } from '../src/breadboard/model';
import { BENCH_PRESETS } from '../src/breadboard/store';
import { measure, simRate, sweepSeconds } from '../src/instruments/scope';

const preset = (name: string): BoardState => structuredClone(BENCH_PRESETS[name]!);

/** Run a live bench for `seconds` of wall-clock time at 60 fps. */
function runFor(lb: LiveBench, seconds: number, probes: { ch1: string | null; ch2: string | null }) {
  for (let i = 0; i < Math.round(seconds * 60); i++) lb.advance(1 / 60, probes);
}

describe('breadboard capacitors and generators', () => {
  it('turn into circuit parts', () => {
    const { circuit } = boardToCircuit(preset('RC filter'));
    const c = circuit.components.find((x) => x.id === 'C1')!;
    const fg = circuit.components.find((x) => x.id === 'FG1')!;
    expect(c).toMatchObject({ kind: 'capacitor', farads: 100e-9, a: 'U10', b: '0' });
    expect(fg).toMatchObject({ kind: 'vsource', a: 'U4', b: '0', wave: { shape: 'square', freq: 1000 } });
    expect(isDynamicBoard(preset('RC filter'))).toBe(true);
    expect(isDynamicBoard(preset('LED + resistor'))).toBe(false);
  });

  it('flags an electrolytic put in backwards', () => {
    const board: BoardState = {
      supply: { volts: 9, on: true },
      parts: [
        { id: 'W1', kind: 'wire', h1: 'T+:3', h2: 'j3' },
        { id: 'R1', kind: 'resistor', h1: 'g3', h2: 'g8', ohms: 1000 },
        { id: 'C1', kind: 'capacitor', h1: 'T-:8', h2: 'h8', farads: 100e-6 },
      ],
    };
    const a = analyzeBoard(board);
    expect(reversedElectrolytics(board, a.nodeOf, a.result)).toEqual(['C1']);
    board.parts[2] = { ...board.parts[2]!, h1: 'h8', h2: 'T-:8' };
    const b = analyzeBoard(board);
    expect(reversedElectrolytics(board, b.nodeOf, b.result)).toEqual([]);
    // small ceramics aren't polarised
    board.parts[2] = { id: 'C1', kind: 'capacitor', h1: 'T-:8', h2: 'h8', farads: 100e-9 };
    const c = analyzeBoard(board);
    expect(reversedElectrolytics(board, c.nodeOf, c.result)).toEqual([]);
  });
});

describe('live bench', () => {
  it('shows the RC filter on the scope: square in, rounded ripple out', () => {
    const lb = new LiveBench(1e-3);
    lb.setBoard(preset('RC filter'));
    lb.scope.trigger = { source: 'ch1', level: 2.5, edge: 'rise', mode: 'auto' };
    // a few sweeps of wall-clock time (each sweep takes 0.5 s at 1 ms/div)
    runFor(lb, 3, { ch1: 'i4', ch2: 'i10' });
    expect(lb.scope.triggered).toBe(true);
    const inp = measure(lb.scope.lastSweep, 'ch1')!;
    const out = measure(lb.scope.lastSweep, 'ch2')!;
    expect(inp.vpp).toBeCloseTo(5, 5);
    expect(inp.freq).toBeCloseTo(1000, -1);
    expect(out.freq).toBeCloseTo(1000, -1);
    const k = Math.exp(-5);
    expect(out.vpp).toBeCloseTo((5 * (1 - k)) / (1 + k), 1);
    expect(out.mean).toBeCloseTo(2.5, 1);
  });

  it('runs 1 ms/div in slow motion and 100 ms/div in real time', () => {
    const lb = new LiveBench(1e-3);
    lb.setBoard(preset('RC filter'));
    runFor(lb, 1, { ch1: null, ch2: null });
    expect(lb.sim.time).toBeCloseTo(simRate(1e-3), 3);
    expect(sweepSeconds(1e-3)).toBe(0.5);
    const slow = new LiveBench(100e-3);
    slow.setBoard(preset('RC charge'));
    runFor(slow, 1, { ch1: null, ch2: null });
    expect(slow.sim.time).toBeCloseTo(1, 2);
  });

  it('keeps capacitor charge when the board changes', () => {
    const lb = new LiveBench(100e-3);
    const board = preset('RC charge');
    board.parts = board.parts.map((p) => (p.id === 'SW1' ? { ...p, pressed: true } : p));
    lb.setBoard(board);
    runFor(lb, 1, { ch1: 'j13', ch2: null });
    const charged = lb.voltageAt(lb.sim.last, 'j13')!;
    // 9 V through 10 kΩ with 22 kΩ to ground: heads for 6.19 V with τ ≈ 0.69 s
    expect(charged).toBeGreaterThan(3.5);
    expect(charged).toBeLessThan(6.2);
    // let go: it starts discharging from where it was, not from zero
    lb.setBoard({ ...board, parts: board.parts.map((p) => (p.id === 'SW1' ? { ...p, pressed: false } : p)) });
    lb.advance(1 / 60, { ch1: 'j13', ch2: null });
    expect(lb.voltageAt(lb.sim.last, 'j13')!).toBeCloseTo(charged, 1);
  });

  it('publishes average and peak currents for LEDs', () => {
    const lb = new LiveBench(1e-3);
    const board: BoardState = {
      supply: { volts: 9, on: false },
      parts: [
        { id: 'FG1', kind: 'generator', h1: 'j4', h2: 'T-:3', wave: { shape: 'square', freq: 1000, vpp: 5, offset: 2.5 } },
        { id: 'R1', kind: 'resistor', h1: 'g4', h2: 'g10', ohms: 150 },
        { id: 'LED1', kind: 'led', h1: 'h10', h2: 'h12', color: 'red' },
        { id: 'W1', kind: 'wire', h1: 'j12', h2: 'T-:11' },
      ],
    };
    lb.setBoard(board);
    runFor(lb, 0.5, { ch1: null, ch2: null });
    const snap = lb.publish(true)!;
    // on half the time at (5 - 2) / 150 = 20 mA
    expect(snap.peakCurrents.LED1).toBeCloseTo(0.02, 3);
    expect(snap.avgCurrents.LED1).toBeCloseTo(0.01, 2);
  });
});
