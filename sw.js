/*
 * Legacy Tiflis service worker retirement shim.
 *
 * The React portal no longer registers a service worker. Existing installations may
 * still have the old worker, so this file activates once, removes only Tiflis caches,
 * unregisters itself, and lets the browser use the atomic GitHub Pages deployment.
 */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.allSettled(
      keys
        .filter((key) => key.toLowerCase().startsWith('tiflis'))
        .map((key) => caches.delete(key)),
    );

    await self.registration.unregister();
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      if ('navigate' in client) void client.navigate(client.url);
    });
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally empty: never intercept requests during retirement.
});
