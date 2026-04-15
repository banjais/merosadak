// frontend/public/sw.js - MeroSadak PWA Service Worker v3.1
// Version injected at build time - see vite.config.js

const CACHE_NAME = 'merosadak-v000';
const RUNTIME_CACHE = 'merosadak-runtime-v3';

const APP_VERSION = '0.0.0' || 'v3';

// Precache shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// INSTALL
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

// ACTIVATE (UPDATED: notify clients)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => {
      self.clients.claim();

      // Notify all open tabs about update
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION,
          });
        });
      });
    })
  );
});

// FETCH
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (!event.request.url.startsWith(self.location.origin)) return;

  const isAsset = event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/);

  // STATIC ASSETS → cache-first
  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((res) => {
            if (!res || res.status !== 200) return res;

            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });

            return res;
          })
          .catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // HTML → network-first
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, clone);
          });
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // fallback
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// MESSAGE HANDLER
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }

  if (event.data?.type === 'GET_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ version: APP_VERSION });
  }
});

// PUSH
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {
    title: 'MeroSadak Update',
    body: 'New update available',
  };

  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: '/badge.png',
    vibrate: [100, 50, 100],
    actions: [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Close' }
    ],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      if (clientsArr.length) {
        clientsArr[0].focus();
        clientsArr[0].postMessage({
          type: 'NOTIFICATION_CLICK',
          data: event.notification.data,
        });
      } else {
        clients.openWindow('/');
      }
    })
  );
});