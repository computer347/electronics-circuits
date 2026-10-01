/*
 * SIGNAL PATH service worker: makes the game work offline once it has been opened.
 * - /assets/* are hashed by the build, so they never change: cache first.
 * - The page itself: network first, falling back to the cached copy offline.
 * - Fonts from Google: cache first.
 * On install it precaches everything the build lists in /precache.json, so screens not yet
 * opened work offline too. The page registers this file as /sw.js?v=<build>, so every release
 * installs afresh, and activating drops the old release's assets.
 */
const CACHE = 'signal-path-v1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const list = await (await fetch('/precache.json', { cache: 'no-store' })).json();
      await cache.addAll(['/', ...list]);
    } catch { /* offline install: the runtime cache fills in as screens open */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    try {
      const keep = new Set(await (await fetch('/precache.json', { cache: 'no-store' })).json());
      const cache = await caches.open(CACHE);
      for (const req of await cache.keys()) {
        const path = new URL(req.url).pathname;
        if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(req);
      }
    } catch { /* offline: prune next time */ }
    await self.clients.claim();
  })());
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) ?? (await cache.match('/')) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (/^\/(assets|icons|landing)\//.test(url.pathname)) event.respondWith(cacheFirst(req));
    else if (req.mode === 'navigate') event.respondWith(networkFirst(req));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
});
