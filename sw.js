/* Тифліс v2 — service worker. Підніми VERSION після кожного деплою. */
const VERSION = 'tiflis2-v1';
const ASSETS = [
  './', 'index.html', 'config.js',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/pages.css',
  'js/lib/utils.js', 'js/lib/demo-data.js', 'js/lib/store.js',
  'js/core/ui.js', 'js/core/acl.js', 'js/core/auth.js', 'js/core/router.js',
  'js/pages/today.js', 'js/pages/schedule.js', 'js/pages/cash.js',
  'js/pages/staff.js', 'js/pages/menu.js', 'js/pages/reserve.js', 'js/pages/admin.js',
  'js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Supabase та шрифти — мимо кешу
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
