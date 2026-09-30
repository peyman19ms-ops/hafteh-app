// هفته — service worker: cache-first for offline relaunch.
// The app itself is 100% local computation (no network calls at runtime),
// so the only job here is making the shell itself available without a network.
// build.mjs replaces 14a9703dd8 with a hash of index.html, so every release gets a fresh cache
// and the activate step below drops the old one.
const CACHE = 'hafteh-14a9703dd8';
const SHELL = ['./', './manifest.json', './icons/app_128.png', './icons/app_256.png', './icons/app_512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
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
  // Navigations (the app shell) go network-first so a new release is picked up on the next
  // online launch; the cached copy is only the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((res) => {
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
