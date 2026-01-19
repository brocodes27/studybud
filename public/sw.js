// Legacy dev-only Service Worker stub.
//
// The real PWA Service Worker is built from src/sw.ts via vite-plugin-pwa
// (injectManifest) and emitted to dist/sw.js in production builds.
//
// Keeping this file as a self-unregistering stub prevents accidental manual
// registration during development (which can cause "zombie localhost" issues).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch {
        // Ignore
      }
    })()
  );
});