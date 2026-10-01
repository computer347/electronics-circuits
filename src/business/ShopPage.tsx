/**
 * The shop: tools (each opens a tier of jobs) and stock for the shelf, paid for from your
 * takings. Prices follow real hobby prices, and every tool costs several good jobs of the
 * tier below it, so you save up for it.
 */
import { useEffect, useState } from 'react';
import '../desk/desk.css';
import './business.css';
import { useWallet } from '../jobs/wallet';
import { LABOUR, PACKS, PART_PRICE, STOCK_NAME, stockOnSale, TOOLS, toolTier, typicalPay } from './economy';
import { useBusiness } from './store';

export function ShopPage({ onBack, onCareer }: { onBack: () => void; onCareer: () => void }) {
  const credits = useWallet((s) => s.credits);
  const tools = useBusiness((s) => s.tools);
  const stock = useBusiness((s) => s.stock);
  const [note, setNote] = useState<string | null>(null);
  const onSale = stockOnSale(tools);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const say = (r: string, what: string) => setNote(r === 'ok' ? `Bought: ${what}.` : r === 'broke' ? `Not enough credits for ${what} yet.` : r === 'owned' ? `You already own ${what}.` : `${what} isn’t on sale to you yet.`);

  return (
    <main className="riso biz" aria-label="Shop">
      <button className="desk-back" onClick={onBack}>‹ Menu <kbd>Esc</kbd></button>
      <header className="biz-head">
        <h1 className="workshop-title">SHOP</h1>
        <p className="biz-stats"><span className="biz-credits">{credits} credits</span><span>your tools open tier {toolTier(tools)} jobs</span>
          <button className="landing-link" onClick={onCareer}>Career →</button></p>
        {note && <p className="biz-note" role="status">{note}</p>}
      </header>

      <section aria-label="Tools" className="biz-section">
        <h2>Tools <small>each opens a tier of jobs; a tool costs about 7–9 good jobs of the tier below</small></h2>
        <ul className="biz-tools">
          {TOOLS.map((t) => {
            const owned = tools.includes(t.id);
            return (
              <li key={t.id} className={owned ? 'owned' : ''}>
                <span className="nb-kicker">tier {t.tier}</span>
                <b>{t.name}</b>
                <span>{t.what}</span>
                {owned ? <em>owned</em> : (
                  <button className="desk-chip" disabled={credits < t.price} onClick={() => say(useBusiness.getState().buyTool(t.id), t.name)}>
                    Buy · {t.price} credits
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Stock" className="biz-section">
        <h2>Stock <small>design jobs use parts from your shelf; repairs use the replacements</small></h2>
        <table className="biz-stock">
          <thead><tr><th>Part</th><th>On the shelf</th><th>Each</th><th>Pack</th><th /></tr></thead>
          <tbody>
            {PACKS.map((p) => {
              const sale = onSale.includes(p.kind);
              const needs = TOOLS.find((t) => t.stocks?.includes(p.kind));
              return (
                <tr key={p.kind} className={sale ? '' : 'locked'}>
                  <td>{STOCK_NAME[p.kind]}</td>
                  <td>{stock[p.kind] ?? 0}</td>
                  <td>{PART_PRICE[p.kind]}</td>
                  <td>{p.count} for {p.price}</td>
                  <td>{sale
                    ? <button className="desk-chip" disabled={credits < p.price} onClick={() => say(useBusiness.getState().buyPack(p.kind), `${p.count} ${STOCK_NAME[p.kind].toLowerCase()}`)}>Buy pack</button>
                    : <small>with the {needs?.name.toLowerCase()}</small>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-label="How pay works" className="biz-section biz-pay">
        <h2>How jobs pay</h2>
        <p>Pay follows cost: <b>parts × 1.5 + labour</b>, with labour set by the job’s tier and difficulty, scaled by your stars, plus a bonus for being on time. A good job pays about {typicalPay(0)} credits at tier 0 and {typicalPay(4)} at tier 4, and higher tiers use dearer parts, so the money keeps moving.</p>
        <p className="biz-small">Labour by tier: {LABOUR.map((l, i) => `${i}: ${l}`).join(' · ')}</p>
      </section>
    </main>
  );
}
