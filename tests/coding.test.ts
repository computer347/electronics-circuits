import { describe, expect, it } from 'vitest';
import { BLINK, checkCoding, CODING_JOBS, unoLedAmps } from '../src/coding/jobs';
import { codeOf, compile, levelAt, measureBlink, run, sketch, type Program, type ProgramNode } from '../src/coding/program';

let k = 0;
type NodeIn = ProgramNode extends infer T ? (T extends ProgramNode ? Omit<T, 'id'> : never) : never;
const n = (x: NodeIn): ProgramNode => ({ id: `t${++k}`, ...x }) as ProgramNode;
const blink = (on = 500, off = 500): Program => ({
  setup: [n({ kind: 'pinMode', pin: 13, mode: 'OUTPUT' })],
  loop: [n({ kind: 'write', pin: 13, level: 'HIGH' }), n({ kind: 'wait', ms: on }), n({ kind: 'write', pin: 13, level: 'LOW' }), n({ kind: 'wait', ms: off })],
});

describe('node programs', () => {
  it('prints each node as its Arduino line, and the program as a sketch', () => {
    const p = blink();
    expect(p.loop.map(codeOf)).toEqual(['digitalWrite(13, HIGH);', 'delay(500);', 'digitalWrite(13, LOW);', 'delay(500);']);
    expect(sketch(p)).toBe('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n');
  });

  it('runs setup once and the loop forever, as pin changes over time', () => {
    const r = run(blink(), 2100);
    expect(r.loopMs).toBe(1000);
    expect(r.changes.map((c) => [c.t, c.level])).toEqual([[0, 1], [500, 0], [1000, 1], [1500, 0], [2000, 1]]);
    expect(levelAt(r, 13, 250)).toBe(1);
    expect(levelAt(r, 13, 750)).toBe(0);
    expect(measureBlink(r, 13)).toEqual({ on: 500, off: 500 });
  });

  it('flips a pin with Flip, and times an uneven blink', () => {
    const p: Program = { setup: [n({ kind: 'pinMode', pin: 13, mode: 'OUTPUT' })], loop: [n({ kind: 'toggle', pin: 13 }), n({ kind: 'wait', ms: 250 })] };
    expect(measureBlink(run(p, 2000), 13)).toEqual({ on: 250, off: 250 });
    expect(measureBlink(run(blink(100, 900), 3000), 13)).toEqual({ on: 100, off: 900 });
  });

  it('warns about a pin that was never made an output, and only pulls it up', () => {
    const p = { ...blink(), setup: [] };
    const c = compile(p);
    expect(c.ok).toBe(true);
    expect(c.problems.some((x) => x.level === 'warning' && /isn't set as an output/.test(x.message))).toBe(true);
    expect(run(p, 2000).pulledUp).toEqual([13]);
    expect(run(p, 2000).changes).toEqual([]);
  });

  it('refuses a pin the board doesn’t have, and warns about a loop with no wait', () => {
    const bad: Program = { setup: [n({ kind: 'pinMode', pin: 20, mode: 'OUTPUT' })], loop: [n({ kind: 'toggle', pin: 20 })] };
    const c = compile(bad);
    expect(c.ok).toBe(false);
    expect(c.problems[0]!.message).toMatch(/no pin 20/);
    expect(compile({ ...blink(), loop: [n({ kind: 'toggle', pin: 13 })] }).problems.some((x) => /never waits/.test(x.message))).toBe(true);
  });

  it('warns that pin mode belongs in setup', () => {
    const p = { setup: [], loop: [n({ kind: 'pinMode', pin: 13, mode: 'OUTPUT' }), ...blink().loop] };
    expect(compile(p).problems.some((x) => /belongs in setup/.test(x.message))).toBe(true);
    // It still works, the same way it would on the real board.
    expect(checkCoding(BLINK, p).pass).toBe(true);
  });
});

describe('the Blink job', () => {
  it('passes with the classic blink, and fails with helpful messages otherwise', () => {
    expect(checkCoding(BLINK, blink())).toMatchObject({ pass: true, on: 500, off: 500 });
    expect(checkCoding(BLINK, blink(200, 200)).message).toMatch(/200 ms on and 200 ms off/);
    expect(checkCoding(BLINK, { ...blink(), setup: [] }).message).toMatch(/glows faintly/);
    expect(checkCoding(BLINK, { setup: blink().setup, loop: [n({ kind: 'write', pin: 13, level: 'HIGH' })] }).message).toMatch(/stays on/);
    expect(checkCoding(BLINK, BLINK.start).message).toMatch(/never comes on/);
  });

  it('lights the Uno’s L LED at about 3 mA through its own circuit when pin 13 is HIGH', () => {
    expect(unoLedAmps(1) * 1000).toBeCloseTo(3, 1);
    expect(unoLedAmps(0)).toBeLessThan(1e-6);
  });

  it('every coding job has a goal that matters, and three hints', () => {
    for (const j of CODING_JOBS) {
      expect(j.skill.length).toBeGreaterThan(25);
      expect(j.realLife.length).toBeGreaterThan(60);
      expect(j.hints).toHaveLength(3);
      expect(checkCoding(j, j.start).pass).toBe(false);
    }
  });
});
