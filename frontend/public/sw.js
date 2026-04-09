// frontend/public/sw.js - Service Worker for MeroSadak PWA
// Fixed version with proper error handling and cache management

const CACHE_NAME = 'merosadak-v2'; // Incremented version
const RUNTIME_CACHE = 'merosadak-runtime-v2';

// Assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// Install event - precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
      .catch(err => console.error('[SW] Activate failed:', err))
  );
});

// Fetch event - cache-first for static assets, network-first for dynamic
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    // For external resources (fonts, APIs), let them through
    return;
  }

  // Cache-first strategy for static assets
  if (event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then(networkResponse => {
              // Don't cache if not a valid response
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                return networkResponse;
              }
              // Clone and cache
              const responseToCache = networkResponse.clone();
              caches.open(RUNTIME_CACHE)
                .then(cache => cache.put(event.request, responseToCache))
                .catch(err => console.warn('[SW] Cache put failed:', err));
              return networkResponse;
            })
            .catch(err => {
              console.warn('[SW] Fetch failed:', err);
              // Return offline fallback if available
              return caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Network-first strategy for HTML
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(event.request, responseToCache))
            .catch(err => console.warn('[SW] Cache put failed:', err));
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// Message handler for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => {
      Promise.all(keys.map(key => caches.delete(key)));
    });
  }
});
