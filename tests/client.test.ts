import { describe, expect, it } from 'vitest';
import { CLIENT_JOBS, clockAt, clockText, DEAD_TORCH, holdProgress, jobLevel, payout } from '../src/jobs/client';
import { applyFaults } from '../src/levels/faults';
import { analyzeBoard } from '../src/breadboard/model';

describe('client jobs', () => {
  it('each job wraps a real level, with a story, a skill and a real-life reason', () => {
    for (const j of CLIENT_JOBS) {
      expect(jobLevel(j), j.id).toBeDefined();
      expect(j.intro.length).toBeGreaterThanOrEqual(3);
      expect(j.outro.length).toBeGreaterThanOrEqual(2);
      expect(j.intro[0]!.who).toBe('client');
      expect(j.skill.length).toBeGreaterThan(25);
      expect(j.realLife.length).toBeGreaterThan(60);
      expect(j.due).toBeGreaterThan(j.opens);
    }
  });

  it('tells the truth: the torch level really has a reversed cell, and its LED is blue', () => {
    const l = jobLevel(DEAD_TORCH)!;
    expect(l.faults?.some((f) => f.kind === 'reverse')).toBe(true);
    const board = applyFaults(l.board, l.faults);
    expect(board.parts.find((p) => p.kind === 'led')?.color).toBe('blue');
    // Three cells, one backwards: the LED stays dark, as Sam says.
    const a = analyzeBoard(board);
    const led = board.parts.find((p) => p.kind === 'led')!;
    expect(Math.abs(a.result.currents[led.id] ?? 0)).toBeLessThan(1e-4);
  });

  it('keeps a workshop clock: a real second is a game minute', () => {
    expect(clockText(DEAD_TORCH.opens)).toBe('16:40');
    expect(clockText(clockAt(DEAD_TORCH, 90_000))).toBe('18:10');
    expect(clockText(24 * 60 + 5)).toBe('00:05');
  });

  it('pays the job, per star, and a tip for being on time', () => {
    expect(payout(DEAD_TORCH, 3, DEAD_TORCH.due - 1)).toEqual({ total: 12 + 9 + 5, lines: [['The job', 12], ['Quality (3 ★)', 9], ['Ready by 17:30', 5]] });
    expect(payout(DEAD_TORCH, 1, DEAD_TORCH.due + 10).total).toBe(15);
  });

  it('needs a real hold to continue a line, not a stray tap', () => {
    expect(holdProgress(0)).toBe(0);
    expect(holdProgress(200)).toBeLessThan(1);
    expect(holdProgress(600)).toBe(1);
  });
});
