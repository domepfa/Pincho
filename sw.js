const CACHE_NAME = 'pincho-shell-v124';
const SHELL_ASSETS = [
  './', './index.html', './styles.css', './data.js', './firebase.js', './app.js',
  './manifest.json', './assets/icon-512-any.png', './assets/icon-192-any.png', './assets/icon-512-transparent.png', './assets/icon-512-maskable.png',
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
    // Nur eigene alte Caches löschen — App und Beta (/beta/) liegen auf
    // derselben Domain und dürfen sich den Offline-Speicher nicht wegräumen.
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pincho-shell-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

/* Code/Seiten: Netz mit kurzem Zeitlimit, sonst sofort die gespeicherte
   Kopie. Bei gutem Netz kommt so immer die neueste Version; bei schlechtem
   Netz (z. B. im Gym) startet die App trotzdem sofort, statt minutenlang
   auf eine hängende Verbindung zu warten. Die Netz-Antwort aktualisiert
   die Kopie auch dann noch, wenn sie erst nach dem Zeitlimit ankommt —
   beim nächsten Öffnen ist die neue Version da. */
const NETWORK_GRACE_MS = 2500;

function networkThenCache(request) {
  const fetchPromise = fetch(request, { cache: 'no-store' })
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return networkResponse;
    });
  return caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((cached) => {
    if (!cached) {
      // Keine Kopie: auf das Netz warten (bei Navigation notfalls die
      // gespeicherte Startseite, z. B. bei Aufruf mit anderem Pfad/Hash).
      return fetchPromise.catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    }
    const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_GRACE_MS));
    return Promise.race([fetchPromise.catch(() => cached), timeout]);
  });
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request)
      .then((networkResponse) => {
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(() => cached);
    return cached || fetchPromise;
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Schriften (Google Fonts): ändern sich nie — Cache zuerst, sonst
  // blockiert das Laden der Schrift-CSS ohne Netz die ganze Anzeige.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // Firebase-Aufrufe (andere Domain) gehen direkt ans Netz — deren
  // Offline-Kopie verwaltet firebase.js selbst (localStorage).
  if (url.origin !== location.origin) return;

  // Bilder (Board-Fotos, Icons) ändern sich praktisch nie: Cache zuerst,
  // im Hintergrund trotzdem nachladen, damit eine Änderung beim nächsten
  // Öffnen ankommt.
  const isImage = e.request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname);
  if (isImage) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  e.respondWith(networkThenCache(e.request));
});
