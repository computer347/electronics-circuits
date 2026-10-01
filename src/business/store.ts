/**
 * The business: tools owned, stock on the shelf, and when each achievement was earned. Money
 * itself lives in the wallet (src/jobs/wallet.ts), which jobs already pay into. Kept in
 * localStorage, guarded like the rest, so a blocked store just means it isn't remembered.
 */
import { create } from 'zustand';
import { useWallet } from '../jobs/wallet';
import { PACKS, STARTER_STOCK, STARTER_TOOLS, stockOnSale, toolById, type StockKind } from './economy';

const KEY = 'signal-path.business.v1';

interface Saved {
  tools: string[];
  stock: Partial<Record<StockKind, number>>;
  /** Achievement id → when it was first earned. */
  achievements: Record<string, string>;
}

function read(): Saved {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    return {
      tools: Array.isArray(v?.tools) ? [...new Set([...STARTER_TOOLS, ...v.tools])] : [...STARTER_TOOLS],
      stock: v?.stock && typeof v.stock === 'object' ? v.stock : { ...STARTER_STOCK },
      achievements: v?.achievements && typeof v.achievements === 'object' ? v.achievements : {},
    };
  } catch { return { tools: [...STARTER_TOOLS], stock: { ...STARTER_STOCK }, achievements: {} }; }
}

const write = (s: Saved) => { try { globalThis.localStorage?.setItem(KEY, JSON.stringify(s)); } catch { /* not saved */ } };

export type BuyResult = 'ok' | 'owned' | 'broke' | 'not-on-sale';

interface Business extends Saved {
  buyTool: (id: string) => BuyResult;
  buyPack: (kind: StockKind) => BuyResult;
  /** Take parts off the shelf; false (and nothing taken) if there aren't enough. */
  use: (kind: StockKind, n: number) => boolean;
  /** Mark achievements as earned now; returns the ones that are new. */
  award: (ids: string[]) => string[];
}

export const useBusiness = create<Business>((set, get) => {
  const save = (patch: Partial<Saved>) => { const next = { ...pick(get()), ...patch }; write(next); set(next); };
  return {
    ...read(),
    buyTool: (id) => {
      const t = toolById(id);
      if (!t) return 'not-on-sale';
      if (get().tools.includes(id)) return 'owned';
      if (!useWallet.getState().spend(t.price)) return 'broke';
      save({ tools: [...get().tools, id] });
      return 'ok';
    },
    buyPack: (kind) => {
      const pack = PACKS.find((p) => p.kind === kind);
      if (!pack || !stockOnSale(get().tools).includes(kind)) return 'not-on-sale';
      if (!useWallet.getState().spend(pack.price)) return 'broke';
      save({ stock: { ...get().stock, [kind]: (get().stock[kind] ?? 0) + pack.count } });
      return 'ok';
    },
    use: (kind, n) => {
      const have = get().stock[kind] ?? 0;
      if (n > have) return false;
      save({ stock: { ...get().stock, [kind]: have - n } });
      return true;
    },
    award: (ids) => {
      const fresh = ids.filter((id) => !get().achievements[id]);
      if (fresh.length) save({ achievements: { ...get().achievements, ...Object.fromEntries(fresh.map((id) => [id, new Date().toISOString()])) } });
      return fresh;
    },
  };
});

const pick = (b: Saved): Saved => ({ tools: b.tools, stock: b.stock, achievements: b.achievements });
