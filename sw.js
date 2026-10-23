// هفته — service worker: cache-first for offline relaunch.
// The app is local computation; its one network call, the weather (api.open-meteo.com), is
// cross-origin and bypasses this worker. The job here is making the shell available offline.
// build.mjs replaces dea46525d1 with a hash of index.html, so every release gets a fresh cache
// and the activate step below drops the old one.
const CACHE = 'hafteh-dea46525d1';
const SHELL = ['./', './manifest.json', './icons/app_128.png', './icons/app_180.png', './icons/app_256.png', './icons/app_512.png'];

self.addEventListener('install', (event) => {
  // cache: 'reload' bypasses the HTTP cache, so a new release never precaches last release's icons.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Only our own files are cached. Cross-origin requests (the weather API) go straight to the network:
  // cached, a forecast would be served forever and the weather would never refresh.
  if (new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.endsWith('/version.json')) return; // always from the network: it is how a running app learns it is stale
  // Navigations (the app shell) go network-first so a new release is picked up on the next
  // online launch; the cached copy is only the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      // 'no-cache': revalidate with the server. Pages answers max-age=600, so without this a reload right after an update was served the OLD page from the HTTP cache.
      fetch(request, { cache: 'no-cache' }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      }).catch(() => caches.match(request).then((c) => c || caches.match('./'))),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return res;
    })),
  );
});
