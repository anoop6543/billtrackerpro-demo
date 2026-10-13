/* Zentu service worker — app shell only.
 *
 * Financial data is NEVER cached: /api/ requests are not intercepted at all,
 * so offline the app shows its own error states instead of stale numbers.
 * The shell (HTML/JS/CSS/icons) is runtime-cached so the app still opens
 * offline and can say "you're offline" instead of a browser error page.
 */
const CACHE = 'zentu-shell-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './zentu-logo.webp',
  './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // never touch API traffic

  if (request.mode === 'navigate') {
    // Network first for pages; fall back to the cached shell when offline.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Static assets: cache first, then network (and remember it).
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      });
    }),
  );
});
