import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/base.css';

const Gallery = lazy(() => import('./parts3d/Gallery').then((m) => ({ default: m.Gallery })));
const PartViewer = lazy(() => import('./parts3d/PartViewer').then((m) => ({ default: m.PartViewer })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ?gallery opens the parts gallery, a testing page for every 3D model; ?parts the one-at-a-time viewer. */}
    {new URLSearchParams(location.search).has('gallery') ? <Suspense fallback={null}><Gallery /></Suspense>
      : new URLSearchParams(location.search).has('parts') ? <Suspense fallback={null}><PartViewer /></Suspense> : <App />}
  </StrictMode>,
);

// The service worker (production only): installable, and offline once opened.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { void navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`); });
}

// Dev only: expose the stores for debugging and browser tests.
if (import.meta.env.DEV) {
  void Promise.all([import('./breadboard/store'), import('./instruments/scopeStore'), import('./breadboard/live'), import('./desk/store'), import('./levels/session'), import('./repair/store'), import('./app/nav')]).then(([b, sc, l, d, se, r, n]) => {
    (window as unknown as Record<string, unknown>).__signalPath = { useBench: b.useBench, useScope: sc.useScope, bench: l.bench, useLive: l.useLive, useDesk: d.useDesk, useSession: se.useSession, useRepair: r.useRepair, useNav: n.useNav };
  });
}
