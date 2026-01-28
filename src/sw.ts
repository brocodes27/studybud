/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();

// Precache build assets injected by Workbox at build time.
precacheAndRoute(self.__WB_MANIFEST);

// Supabase / API: network-first with a small cache.
registerRoute(
  ({ url }) => url.hostname.endsWith('supabase.co') || url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 25, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  })
);

// Videos: always network-only (avoid range/caching issues).
registerRoute(({ url }) => url.pathname.includes('/videos/'), new NetworkOnly());

// Other same-origin requests: SWR for speed.
registerRoute(
  ({ url }) => url.origin === self.location.origin,
  new StaleWhileRevalidate({
    cacheName: 'app-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// Offline fallback for navigations.
setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    return (await caches.match('/index.html')) ?? Response.error();
  }
  return Response.error();
});

// Push notifications
self.addEventListener('push', (event) => {
  let data: any = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'Notification', body: event.data?.text?.() };
  }

  const title = data.title || 'Notification';
  const options: NotificationOptions = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      try {
        const rawUrl = (event.notification as any)?.data?.url || '/';
        const url = new URL(rawUrl, self.location.origin);
        if (!url.searchParams.has('fullscreen')) url.searchParams.set('fullscreen', '1');

        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          if (client.url === url.toString()) return (client as WindowClient).focus();
        }

        return self.clients.openWindow(url.toString());
      } catch {
        return self.clients.openWindow('/?fullscreen=1');
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = (event as ExtendableMessageEvent).data;
  if (!data || !data.type) return;

  if (data.type === 'SHOW_NOTIFICATION') {
    const payload = data.payload || {};
    const title = payload.title || 'Notification';
    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/pwa-192x192.png',
      badge: payload.badge || '/pwa-192x192.png',
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || [],
      data: { url: payload.url || '/' },
    };
    (event as ExtendableMessageEvent).waitUntil(self.registration.showNotification(title, options));
  }
});
