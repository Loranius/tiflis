// Tiflis Portal — Service Worker
// Потрібен для встановлення PWA (Add to Home Screen)
// + кешування статичних ресурсів для офлайн-старту.
// Після переходу на модульну структуру кешуємо всі css/js файли.

const CACHE_NAME = 'tiflis-portal-v4';
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // CSS
  './css/01-base.css',
  './css/02-login.css',
  './css/03-interface.css',
  './css/04-schedule.css',
  './css/05-cash.css',
  './css/06-rating.css',
  './css/07-staff.css',
  './css/08-duties.css',
  './css/09-calendar-menu.css',
  // JS (порядок = порядок виконання)
  './js/00-utils-security.js',
  './js/01-supabase-db.js',
  './js/02-uploads.js',
  './js/03-menu.js',
  './js/04-utils.js',
  './js/05-app.js',
  './js/06-schedule.js',
  './js/07-cash.js',
  './js/08-rating.js',
  './js/09-staff.js',
  './js/10-duties.js',
  './js/11-telegram.js',
  './js/12-admin.js',
  './js/13-home.js',
  './js/14-theme.js',
  './js/15-notify.js',
  './js/16-interactive.js',
  './js/17-horoscope.js',
  './js/18-reserve.js',
  './js/19-shiftswap.js',
  './js/20-eventlog.js',
  './js/21-bootstrap.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// network-first для HTML (щоб завжди тягнути оновлення),
// cache-first для css/js/іконок.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // не кешуємо Supabase / Telegram / зовнішнє

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
