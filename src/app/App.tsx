import { useMemo, useState } from 'react';
import { DrillView } from '../drills/DrillView';
import { parseNetlist, solve, type SolveResult } from '../sim';
import { CurrentStrip } from './CurrentStrip';
import { PRESETS } from './presets';

const fmtV = (v: number) => `${v.toFixed(3)} V`;
function fmtA(a: number) {
  const x = Math.abs(a);
  if (x >= 1) return `${a.toFixed(3)} A`;
  if (x >= 1e-3) return `${(a * 1e3).toFixed(2)} mA`;
  if (x >= 1e-6) return `${(a * 1e6).toFixed(2)} µA`;
  return '0 A';
}

type Outcome = { result: SolveResult; error?: undefined } | { result?: undefined; error: string };

export function App() {
  const [tab, setTab] = useState<'drills' | 'bench'>('drills');
  const [text, setText] = useState(PRESETS['LED + resistor']!);

  const outcome: Outcome = useMemo(() => {
    try {
      return { result: solve(parseNetlist(text)) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text]);

  const r = outcome.result;
  const hasError = !!r?.faults.some((f) => f.severity === 'error');
  // Current shown in the strip: the largest branch current in the circuit.
  const peak = r ? Math.max(0, ...Object.values(r.currents).map(Math.abs)) : 0;

  return (
    <div className="app">
      <header className="header">
        <h1>SIGNAL PATH</h1>
        <span>phase 0 · prototype</span>
        <nav className="tabs">
          <button className={tab === 'drills' ? 'active' : ''} onClick={() => setTab('drills')}>Exam drills</button>
          <button className={tab === 'bench' ? 'active' : ''} onClick={() => setTab('bench')}>Solver bench</button>
        </nav>
      </header>

      {tab === 'drills' ? <DrillView /> : (
      <main className="bench">
        <section className="panel">
          <h2>Netlist</h2>
          <div className="presets">
            {Object.keys(PRESETS).map((name) => (
              <button key={name} onClick={() => setText(PRESETS[name]!)}>{name}</button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Netlist" />
        </section>

        <section className="panel">
          <h2>Electron flow</h2>
          <div className="scope">
            <CurrentStrip amps={r?.ok ? peak : 0} fault={hasError} />
          </div>

          {outcome.error && <p className="parse-error">{outcome.error}</p>}
          {r && (
            <>
              {r.faults.length > 0 ? (
                <ul className="faults">
                  {r.faults.map((f, i) => <li key={i} className={f.severity}>{f.message}</li>)}
                </ul>
              ) : (
                <p className="ok">● Circuit OK</p>
              )}
              {r.ok && (
                <div className="grid2">
                  <table>
                    <thead><tr><th>Node</th><th className="num">Voltage</th></tr></thead>
                    <tbody>
                      {Object.entries(r.nodeVoltages).map(([n, v]) => (
                        <tr key={n}><td>{n}</td><td className="num">{fmtV(v)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <table>
                    <thead><tr><th>Part</th><th className="num">Current</th></tr></thead>
                    <tbody>
                      {Object.entries(r.currents).map(([id, a]) => (
                        <tr key={id}>
                          <td>{id}{r.diodeStates[id] ? ` (${r.diodeStates[id]})` : ''}</td>
                          <td className="num">{fmtA(a)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </main>
      )}
    </div>
  );
}
