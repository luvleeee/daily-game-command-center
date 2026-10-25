/*
 * Offline service worker for the app shell.
 *
 *  - Navigations (index.html): NETWORK-FIRST → you always get the latest deploy when online,
 *    and the cached shell when offline.
 *  - Same-origin static files (hashed JS/CSS, icons): CACHE-FIRST, cached on first use.
 *    Vite fingerprints filenames, so a new deploy = new URLs = no stale code.
 *  - Cross-origin requests (game favicons, game sites): untouched. Offline, icons fall
 *    back to generated monograms in the UI.
 *
 * Bump VERSION to force-clear old caches.
 */
const VERSION = 'v2';
const CACHE = `gcc-shell-${VERSION}`;
const SCOPE = self.registration.scope; // works on any sub-path
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg'].map(
  (p) => new URL(p, SCOPE).href,
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Also precache the hashed JS/CSS referenced by index.html, so the app
      // works offline right after the very first visit.
      try {
        const html = await (await fetch(new URL('./index.html', SCOPE).href, { cache: 'no-store' })).text();
        const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => new URL(m[1], SCOPE).href);
        await cache.addAll(assets);
      } catch {
        /* non-fatal: assets get cached on first use instead */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gcc-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations → network first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(new URL('./index.html', SCOPE).href, copy));
          return res;
        })
        .catch(async () => (await caches.match(new URL('./index.html', SCOPE).href)) || caches.match(new URL('./', SCOPE).href)),
    );
    return;
  }

  // Static assets → cache first, then network (and remember it)
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
