import { describe, expect, it } from 'vitest';
import { BOARDS } from '../src/parts3d/boards';
import { boardPads, footprint, generateBoard, layoutBoard, partBox, resistorCode } from '../src/parts3d/pcbgen';

describe('procedural PCB', () => {
  it('gives every part on every board its footprint, with pads on the board', () => {
    for (const b of BOARDS) {
      for (const p of b.parts) if (p.kind !== 'display' && p.kind !== 'jumper') expect(footprint(p).length, `${b.id} ${p.id} (${p.kind})`).toBeGreaterThan(0);
      for (const pad of boardPads(b)) {
        expect(Math.abs(pad.x), `${b.id} ${pad.id}`).toBeLessThan(b.w / 2 + 3);
        expect(Math.abs(pad.z), `${b.id} ${pad.id}`).toBeLessThan(b.d / 2 + 3);
      }
    }
  });

  it('puts an 0603’s pads 1.6 mm apart, centred on the part, and turns them with it', () => {
    const p = { id: 'R1', kind: 'chipR' as const, at: [10, 5] as [number, number], rot: 90, props: { size: '0603' } };
    const pads = boardPads({ id: 't', name: 't', w: 30, d: 20, color: '#000', parts: [p] });
    expect(Math.hypot(pads[0]!.x - pads[1]!.x, pads[0]!.z - pads[1]!.z)).toBeCloseTo(1.6, 3);
    expect(pads[0]!.x).toBeCloseTo(10, 3);
  });

  it('routes every net it makes, and the traces start and end on the net’s pads', () => {
    for (const b of BOARDS) {
      const l = layoutBoard(b);
      const pad = new Map(l.pads.map((p) => [p.id, p]));
      for (const [net, ids] of Object.entries(l.nets)) {
        expect(ids.length, `${b.id} ${net}`).toBeGreaterThanOrEqual(2);
        const ends = l.traces.filter((t) => t.net === net).flatMap((t) => [t.pts[0]!, t.pts[t.pts.length - 1]!]);
        for (const id of ids) {
          const p = pad.get(id)!;
          expect(ends.some(([x, z]) => Math.abs(x - p.x) < 1e-6 && Math.abs(z - p.z) < 1e-6), `${b.id} ${net} ${id}`).toBe(true);
        }
      }
    }
  });

  it('generates the same board for the same seed, a different one for another, with no parts overlapping', () => {
    expect(JSON.stringify(generateBoard(7))).toBe(JSON.stringify(generateBoard(7)));
    expect(JSON.stringify(generateBoard(7))).not.toBe(JSON.stringify(generateBoard(8)));
    for (let s = 1; s <= 25; s++) {
      const b = generateBoard(s);
      expect(b.parts.some((p) => p.kind === 'qfp'), `seed ${s}`).toBe(true);
      expect(b.parts.length, `seed ${s}`).toBeGreaterThan(8);
      for (let i = 0; i < b.parts.length; i++) for (let j = i + 1; j < b.parts.length; j++) {
        const x = partBox(b.parts[i]!), y = partBox(b.parts[j]!);
        const hit = x.x0 < y.x1 && y.x0 < x.x1 && x.z0 < y.z1 && y.z0 < x.z1;
        expect(hit, `seed ${s}: ${b.parts[i]!.id} / ${b.parts[j]!.id}`).toBe(false);
      }
      expect(Object.keys(layoutBoard(b).nets).length).toBeGreaterThan(3);
    }
  });

  it('gives a TSOP-48 its 48 legs, 0.5 mm apart, on the two short ends only', () => {
    const f = footprint({ id: 'U1', kind: 'tsop48', at: [0, 0] });
    expect(f.length).toBe(48);
    expect(new Set(f.map((p) => p.x)).size).toBe(2);
    const left = f.filter((p) => p.x < 0).map((p) => p.z).sort((a, b) => a - b);
    expect(left[1]! - left[0]!).toBeCloseTo(0.5, 6);
  });

  it('lays the Uno, Nano, ESP32 DevKit and USB stick out with no two parts on top of each other', () => {
    for (const id of ['esp32-devkit', 'usb-stick', 'arduino-uno', 'arduino-nano']) {
      const parts = BOARDS.find((b) => b.id === id)!.parts.filter((p) => p.kind !== 'header' && p.kind !== 'wroom' && p.kind !== 'usbA' && (p.rot ?? 0) % 90 === 0); // boxes are axis-aligned: parts at 45° are left out
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const x = partBox(parts[i]!), y = partBox(parts[j]!);
        expect(x.x0 < y.x1 && y.x0 < x.x1 && x.z0 < y.z1 && y.z0 < x.z1, `${id}: ${parts[i]!.id} / ${parts[j]!.id}`).toBe(false);
      }
    }
  });

  it('prints resistor codes like the real parts: 4.7 kΩ is 472, 100 Ω is 101, 22 kΩ is 223', () => {
    expect(resistorCode(4700)).toBe('472');
    expect(resistorCode(100)).toBe('101');
    expect(resistorCode(22000)).toBe('223');
    expect(resistorCode(10)).toBe('100');
  });
});
