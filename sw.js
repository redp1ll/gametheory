/* Gambit — Service Worker: App-Shell cachen, damit die App offline läuft. */
const CACHE = 'gambit-v18';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './strategies.js',
  './store.js',
  './vendor/supabase.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-dark-192.png',
  './icon-dark-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first für die App-Dateien, Netz als Fallback (und Cache-Auffrischung).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fromNet = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fromNet;
    })
  );
});
