import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: 'navigation', networkTimeoutSeconds: 3 })
  )
);

// Web push delivery. The backend (api/send-push.js) sends a JSON payload of
// { title, body, url, tag }; we surface it as a notification. The click is
// handled by the notificationclick listener below.
const PUSH_ICON = '/assets/App-Icon/Nwrpg-icon-192.png';
const PUSH_BADGE = '/assets/App-Icon/white-icon.png';

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'New Worlds RPG';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: PUSH_ICON,
      badge: PUSH_BADGE,
      data: { url: data.url || '/home' },
      tag: data.tag,
      renotify: Boolean(data.tag),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/home';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) return client.navigate(targetUrl);
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
