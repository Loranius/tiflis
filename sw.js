// Tiflis Portal — Service Worker v5
// network-first для HTML + JS + CSS (оновлення завжди свіжі)
// cache-first тільки для іконок і manifest

const CACHE_NAME = 'tiflis-portal-v5';

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

// Встановлення — кешуємо тільки іконки і маніфест
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // активуємось одразу, не чекаємо закриття вкладок
});

// Активація — видаляємо всі старі кеші (v1-v4)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // перехоплюємо всі відкриті вкладки одразу
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Не чіпаємо зовнішні запити (Supabase, Telegram, Google Fonts тощо)
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // cache-first тільки для іконок і маніфесту — вони не змінюються
  const isStatic = path.endsWith('.png') || path.endsWith('.ico') || path.endsWith('manifest.json');
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // network-first для ВСЬОГО іншого: HTML, JS, CSS
  // Завжди тягнемо з мережі, фолбек на кеш тільки якщо немає інтернету
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
