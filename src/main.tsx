import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev only: expose the stores for debugging and browser tests.
if (import.meta.env.DEV) {
  void Promise.all([import('./breadboard/store'), import('./instruments/scopeStore'), import('./breadboard/live'), import('./desk/store'), import('./levels/session')]).then(([b, sc, l, d, se]) => {
    (window as unknown as Record<string, unknown>).__signalPath = { useBench: b.useBench, useScope: sc.useScope, bench: l.bench, useLive: l.useLive, useDesk: d.useDesk, useSession: se.useSession };
  });
}
