const CACHE_NAME = 'pincho-shell-v22';
const SHELL_ASSETS = [
  './', './index.html', './styles.css', './data.js', './firebase.js', './app.js',
  './manifest.json', './assets/icon-192.png', './assets/icon-512.png',
  './assets/icon-192-any.png', './assets/icon-512-any.png',
  './assets/board-bm1000.png', './assets/board-bm2000.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(url).catch((err) => console.warn('SW: konnte nicht cachen:', url, err)))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Nur eigene Dateien cachen. Firebase-Aufrufe (andere Domain) gehen immer
  // direkt ans Netz, damit Trainingsdaten nie veraltet angezeigt werden.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // "Netzwerk zuerst": neueste Version laden, wenn online; nur offline auf
  // den Zwischenspeicher zurückfallen.
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse.clone()));
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
