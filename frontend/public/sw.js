// frontend/public/sw.js - MeroSadak PWA Service Worker v3.1
// Version injected at build time - see vite.config.js

const CACHE_NAME = 'merosadak-v000';
const RUNTIME_CACHE = 'merosadak-runtime-v3';

const APP_VERSION = '0.0.0';

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

// ACTIVATE (UPDATED: notify clients and PURGE OLD CACHES)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .map((key) => {
            if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
              console.log('[SW] Purging legacy cache:', key);
              return caches.delete(key);
            }
          })
      )
    ).then(() => {
      self.clients.claim();

      // Notify all open tabs about successful activation and new version
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION,
          });
        });
      });
    })
  );
});

// FETCH - Network-First for everything to ensure "Always Latest"
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Basic sanity check for internal requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Only cache valid responses
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return res;
      })
      .catch(() => {
        // If network fails, try the cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          
          // If it's a page navigation, return the index shell
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      if (clientsArr.length) {
        clientsArr[0].focus();
        clientsArr[0].postMessage({
          type: 'NOTIFICATION_CLICK',
          data: event.notification.data,
        });
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});