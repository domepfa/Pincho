const CACHE_NAME = 'pincho-shell-v98';
const SHELL_ASSETS = [
  './', './index.html', './styles.css', './data.js', './firebase.js', './app.js',
  './manifest.json', './assets/icon-512-any.png',
  './assets/board-bm1000.png', './assets/board-bm2000.png', './assets/board-campus.jpg',
  './assets/ki-anleitung-json.md',
  './assets/ki-anleitung-flow-json.md',
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

  // Bilder (Board-Fotos, Icons) ändern sich praktisch nie, sobald sie einmal
  // ausgeliefert wurden — anders als app.js/data.js/styles.css also NICHT
  // "Netzwerk zuerst" (das liess das Board-Bild bei jedem Öffnen unnötig
  // langsam über die Leitung nachladen, obwohl längst eine lokale Kopie
  // existiert). Stattdessen "Cache zuerst": sofort die lokale Kopie zeigen,
  // im Hintergrund trotzdem einmal nachladen, damit eine echte Änderung
  // (oder ein neues Bild) beim nächsten Öffnen ankommt.
  const isImage = e.request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname);
  if (isImage) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request)
          .then((networkResponse) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse.clone()));
            return networkResponse;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // "Netzwerk zuerst" fürs Übrige (Code/Daten): neueste Version laden, wenn
  // online; nur offline auf den Zwischenspeicher zurückfallen.
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse.clone()));
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
