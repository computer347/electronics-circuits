/**
 * The workshop business: the economy's rules (pay follows cost; tools take several jobs to
 * afford), certificates built from real training levels, the ranks, the achievements, and
 * buying from the shop.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, CERTIFICATES, certState, rankIndex, RANKS, reputation, type CareerInput } from '../src/business/career';
import { jobPay, LABOUR, PACKS, PART_PRICE, STARTER_TOOLS, stockOnSale, TOOLS, toolTier, typicalPay, TYPICAL_PARTS } from '../src/business/economy';
import { useBusiness } from '../src/business/store';
import { useWallet } from '../src/jobs/wallet';
import { ALL_LEVELS, levelById } from '../src/levels';

const rec = (stars: 1 | 2 | 3 = 3) => ({ stars, seconds: 120, firstPassed: '2026-10-01' });
const blank = (patch: Partial<CareerInput> = {}): CareerInput => ({ records: {}, credits: 0, done: {}, tools: [...STARTER_TOOLS], ...patch });

describe('the economy', () => {
  it('pays for the parts and the time: always more than the parts cost, more for better work', () => {
    for (let tier = 0; tier < LABOUR.length; tier++) {
      for (const parts of [0, 5, TYPICAL_PARTS[tier]!, 80]) {
        const one = jobPay({ tier, partsCost: parts, stars: 1 });
        const three = jobPay({ tier, partsCost: parts, stars: 3 });
        expect(one).toBeGreaterThan(parts);
        expect(three).toBeGreaterThan(one);
        expect(jobPay({ tier, partsCost: parts, stars: 3, onTime: true })).toBeGreaterThan(three);
      }
    }
  });

  it('pays more at higher tiers, but no single job comes near a tool of the next tier', () => {
    for (let t = 1; t < LABOUR.length; t++) expect(typicalPay(t)).toBeGreaterThan(typicalPay(t - 1));
    for (const tool of TOOLS.filter((x) => x.price > 0)) {
      const jobs = tool.price / typicalPay(tool.tier - 1);
      expect(jobs, tool.id).toBeGreaterThanOrEqual(6);
      expect(jobs, tool.id).toBeLessThanOrEqual(10);
    }
  });

  it('prices tools in tier order and starts you with the free ones', () => {
    const bought = TOOLS.filter((t) => t.price > 0);
    for (let i = 1; i < bought.length; i++) expect(bought[i]!.price).toBeGreaterThan(bought[i - 1]!.price);
    expect(toolTier(STARTER_TOOLS)).toBe(0);
    expect(toolTier(TOOLS.map((t) => t.id))).toBe(5);
  });

  it('sells packs a little cheaper than single parts, and gated stock only with its tool', () => {
    for (const p of PACKS) expect(p.price).toBeLessThan(p.count * PART_PRICE[p.kind]);
    expect(stockOnSale(STARTER_TOOLS)).not.toContain('chip');
    expect(stockOnSale([...STARTER_TOOLS, 'logic'])).toContain('chip');
  });
});

describe('the career', () => {
  it('builds every certificate from real training levels, each level in at most one', () => {
    const seen = new Set<string>();
    for (const c of CERTIFICATES) {
      expect(c.levels.length, c.id).toBeGreaterThanOrEqual(3);
      for (const id of c.levels) {
        expect(levelById(id), id).toBeDefined();
        expect(seen.has(id), `${id} is in two certificates`).toBe(false);
        seen.add(id);
      }
    }
    // nearly every level counts towards a certificate
    expect(seen.size).toBeGreaterThanOrEqual(ALL_LEVELS.length - 2);
  });

  it('earns a certificate when every level in it is passed, with distinction at three stars on all', () => {
    const c = CERTIFICATES[0]!;
    expect(certState(c, {}).earned).toBe(false);
    const all = Object.fromEntries(c.levels.map((id) => [id, rec(3)]));
    expect(certState(c, all)).toMatchObject({ earned: true, distinction: true, passed: c.levels.length });
    expect(certState(c, { ...all, [c.levels[0]!]: rec(2) }).distinction).toBe(false);
  });

  it('climbs the ranks in order, and the top needs every certificate', () => {
    expect(rankIndex(blank())).toBe(0);
    const twoCerts = Object.fromEntries(CERTIFICATES.slice(0, 2).flatMap((c) => c.levels.map((id) => [id, rec(2)])));
    expect(RANKS[rankIndex(blank({ records: twoCerts }))]!.name).toBe('Apprentice');
    // everything passed with three stars, every tool and plenty of jobs: Master Engineer
    const everything = Object.fromEntries(ALL_LEVELS.map((l) => [l.id, rec(3)]));
    const jobs = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`job-${i}`, { paid: 30, stars: 3 as const }]));
    expect(rankIndex(blank({ records: everything, done: jobs, tools: TOOLS.map((t) => t.id) }))).toBe(RANKS.length - 1);
    // a rank can't be skipped: no tools means stuck at Apprentice, whatever else
    expect(rankIndex(blank({ records: everything, done: jobs }))).toBe(1);
  });

  it('counts reputation from workshop jobs only', () => {
    expect(reputation(blank({ done: { 'repair-x': { paid: 20, stars: 3 }, 'lab:led': { paid: 0, stars: 3 } } }))).toBe(15);
  });

  it('awards achievements from what’s saved', () => {
    const got = (i: CareerInput) => ACHIEVEMENTS.filter((a) => a.got(i)).map((a) => a.id);
    expect(got(blank())).toEqual([]);
    expect(got(blank({ records: { [ALL_LEVELS[0]!.id]: rec(3) } }))).toContain('first-light');
    expect(got(blank({ credits: 300 }))).toContain('saver');
    expect(got(blank({ tools: TOOLS.map((t) => t.id) }))).toEqual(expect.arrayContaining(['first-tool', 'toolbox']));
  });
});

describe('the shop', () => {
  beforeEach(() => {
    useWallet.setState({ credits: 0, done: {} });
    useBusiness.setState({ tools: [...STARTER_TOOLS], stock: {}, achievements: {} });
  });

  it('won’t sell what you can’t afford, takes the money when you can, and won’t sell it twice', () => {
    const meter = TOOLS.find((t) => t.id === 'meter-auto')!;
    expect(useBusiness.getState().buyTool(meter.id)).toBe('broke');
    useWallet.setState({ credits: meter.price + 5 });
    expect(useBusiness.getState().buyTool(meter.id)).toBe('ok');
    expect(useWallet.getState().credits).toBe(5);
    expect(useBusiness.getState().buyTool(meter.id)).toBe('owned');
  });

  it('stocks the shelf with packs, only of what your tools allow, and uses parts from it', () => {
    useWallet.setState({ credits: 500 });
    expect(useBusiness.getState().buyPack('chip')).toBe('not-on-sale');
    expect(useBusiness.getState().buyPack('resistor')).toBe('ok');
    expect(useBusiness.getState().stock.resistor).toBe(20);
    expect(useBusiness.getState().use('resistor', 25)).toBe(false);
    expect(useBusiness.getState().use('resistor', 5)).toBe(true);
    expect(useBusiness.getState().stock.resistor).toBe(15);
  });

  it('records each achievement once', () => {
    expect(useBusiness.getState().award(['a', 'b'])).toEqual(['a', 'b']);
    expect(useBusiness.getState().award(['a', 'c'])).toEqual(['c']);
  });
});
