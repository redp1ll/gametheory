/* Gambit — Service Worker: App-Shell cachen, damit die App offline läuft. */
const CACHE = 'gambit-v26';
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

/* App-Dateien: erst das Netz, Cache als Rueckfall.
 *
 * Zuvor galt Cache-first. Damit lieferte ein Start nach einer Aktualisierung
 * noch die alten Dateien aus und erst der naechste den neuen Stand - in der
 * Praxis mischten sich dabei neues HTML und altes CSS, was die Oberflaeche
 * zerlegte. Jetzt entscheidet die Verbindung: online immer der aktuelle
 * Stand, offline weiterhin der zuletzt gesicherte. */
const APP_DATEI = /\.(?:html|css|js|webmanifest)$/;

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const istAppDatei = e.request.mode === 'navigate'
    || (url.origin === self.location.origin && APP_DATEI.test(url.pathname));

  if (istAppDatei) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Bilder und Schriften aendern sich kaum: erst Cache, dann Netz.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
