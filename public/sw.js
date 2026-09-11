// Mero Sadak Nepal Highway GIS - Service Worker
// Version 1.2.0 - Mountain Offline Caching & Map Tile Engine

const CACHE_NAMES = {
  STATIC: 'mero-sadak-static-v1.5',
  TILES: 'mero-sadak-tiles-v1.5',
  DATA: 'mero-sadak-data-v1.5',
};

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
];

// Core API endpoints to cache for offline mountain travel
const API_ENDPOINTS = [
  '/api/highways',
  '/api/cities',
  '/api/road-alerts',
  '/api/weather',
  '/api/pois',
  '/api/traffic',
  '/api/offline-bundle',
];

// Key Nepal highway tile bounding coordinates (Zoom 6, 7, 8 base covers all Nepal)
const NEPAL_CORE_TILES = [
  'https://a.tile.openstreetmap.org/6/46/27.png',
  'https://b.tile.openstreetmap.org/6/47/27.png',
  'https://c.tile.openstreetmap.org/6/46/28.png',
  'https://a.tile.openstreetmap.org/6/47/28.png',
  'https://a.tile.openstreetmap.org/7/93/54.png',
  'https://b.tile.openstreetmap.org/7/94/54.png',
  'https://c.tile.openstreetmap.org/7/95/54.png',
  'https://a.tile.openstreetmap.org/7/93/55.png',
  'https://b.tile.openstreetmap.org/7/94/55.png',
  'https://c.tile.openstreetmap.org/7/95/55.png',
  'https://a.tile.openstreetmap.org/8/187/109.png',
  'https://b.tile.openstreetmap.org/8/188/109.png',
  'https://c.tile.openstreetmap.org/8/189/109.png',
  'https://a.tile.openstreetmap.org/8/190/109.png',
  'https://b.tile.openstreetmap.org/8/187/110.png',
  'https://c.tile.openstreetmap.org/8/188/110.png',
  'https://a.tile.openstreetmap.org/8/189/110.png',
  'https://b.tile.openstreetmap.org/8/190/110.png',
];

// Install Event: Precaches base static app shell and core tiles
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_NAMES.STATIC);
        await Promise.allSettled(
          PRECACHE_ASSETS.map(async (url) => {
            try {
              const req = new Request(url, { mode: 'no-cors' });
              await staticCache.add(req);
            } catch (e) {
              console.warn('[SW] Skipping precache for:', url, e.message);
            }
          })
        );

        const tileCache = await caches.open(CACHE_NAMES.TILES);
        await Promise.allSettled(
          NEPAL_CORE_TILES.map(async (tileUrl) => {
            try {
              const res = await fetch(tileUrl, { mode: 'no-cors' });
              if (res) await tileCache.put(tileUrl, res);
            } catch (e) {
              console.warn('[SW] Skipping tile prefetch:', tileUrl, e.message);
            }
          })
        );
      } catch (err) {
        console.warn('[SW] Precache during install partially skipped:', err);
      }
    })()
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const allCacheKeys = await caches.keys();
        await Promise.all(
          allCacheKeys.map((key) => caches.delete(key))
        );
      } catch (err) {
        console.warn('[SW] Cache cleanup skipped:', err);
      }
      await self.clients.claim();
    })()
  );
});

// Helper: Check if request is a map tile
function isTileRequest(url) {
  const u = new URL(url, self.location.href);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return (
    u.hostname.includes('tile.openstreetmap.org') ||
    u.hostname.includes('tile.opentopomap.org') ||
    u.hostname.includes('server.arcgisonline.com') ||
    u.hostname.includes('basemaps.cartocdn.com') ||
    u.pathname.match(/\/\d+\/\d+\/\d+(\.png|@2x\.png|\.jpg|\.webp)/i)
  );
}

// Helper: Check if request is API
function isApiRequest(url) {
  const u = new URL(url, self.location.href);
  return u.pathname.startsWith('/api/');
}

// Fetch Event Router
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (e.g. POST report submissions)
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) schemes (e.g. chrome-extension, data, blob)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Strategy 1: Map Tiles -> Cache-First with Stale-While-Revalidate
  if (isTileRequest(event.request.url)) {
    event.respondWith(
      (async () => {
        let tileCache;
        try {
          tileCache = await caches.open(CACHE_NAMES.TILES);
        } catch {
          return fetch(event.request).catch(() => new Response('', { status: 408, statusText: 'Tile Offline' }));
        }
        const cachedResponse = await tileCache.match(event.request);

        if (cachedResponse) {
          fetch(event.request)
            .then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                tileCache.put(event.request, networkRes).catch(() => {});
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            tileCache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch (err) {
          return new Response('', { status: 408, statusText: 'Tile Offline' });
        }
      })()
    );
    return;
  }

  // Strategy 2: Core Highway APIs -> Network-First with Cache Fallback
  if (isApiRequest(url)) {
    event.respondWith(
      (async () => {
        let dataCache;
        try {
          dataCache = await caches.open(CACHE_NAMES.DATA);
        } catch {
          return fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Offline cache unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            dataCache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch (error) {
          const cachedResponse = await dataCache.match(event.request);
          if (cachedResponse) {
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-MeroSadak-Offline-Cached', 'true');
            return new Response(await cachedResponse.blob(), {
              status: cachedResponse.status,
              statusText: 'OK (Mountain Offline Cache)',
              headers,
            });
          }
          return new Response(JSON.stringify({ error: 'Offline and no cached highway data available' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })()
    );
    return;
  }

  // Strategy 3: Static App Shell & CSS/JS -> Stale-While-Revalidate
  event.respondWith(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_NAMES.STATIC);
        const cached = await staticCache.match(event.request);

        if (cached) return cached;

        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200) {
            const contentType = networkRes.headers.get('content-type') || '';
            const isHtml = contentType.includes('text/html');
            const url = new URL(event.request.url);
            const isHtmlPath =
              url.pathname.endsWith('.html') ||
              url.pathname === '/' ||
              !url.pathname.includes('.');

            if (!isHtml || isHtmlPath) {
              staticCache.put(event.request, networkRes.clone());
            }
          }
          return networkRes;
        } catch {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
      } catch (err) {
        console.warn('[SW] Static fetch strategy failed:', err);
        return fetch(event.request);
      }
    })()
  );
});

// Custom Message Event: Allows the UI to trigger bulk prefetching for Nepal mountain regions
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  if (event.data.type === 'PREFETCH_MOUNTAIN_PACK') {
    const { tileUrls = [], apiUrls = [] } = event.data;
    let totalItems = tileUrls.length + apiUrls.length;
    let processedItems = 0;

    const dataCache = await caches.open(CACHE_NAMES.DATA);
    const tileCache = await caches.open(CACHE_NAMES.TILES);

    for (const apiUrl of apiUrls) {
      try {
        const res = await fetch(apiUrl);
        if (res && res.status === 200) {
          await dataCache.put(apiUrl, res);
        }
      } catch (err) {
        console.warn('[SW] API prefetch failed for:', apiUrl);
      }
      processedItems++;
      notifyProgress(processedItems, totalItems, `Cached API: ${apiUrl}`);
    }

    for (const tileUrl of tileUrls) {
      try {
        const res = await fetch(tileUrl, { mode: 'no-cors' });
        if (res) {
          await tileCache.put(tileUrl, res);
        }
      } catch (err) {
        // Continue
      }
      processedItems++;
      if (processedItems % 5 === 0 || processedItems === totalItems) {
        notifyProgress(processedItems, totalItems, `Cached Map Tile (${processedItems}/${totalItems})`);
      }
    }

    if (event.source) {
      event.source.postMessage({
        type: 'PREFETCH_COMPLETE',
        totalItems,
        timestamp: Date.now(),
      });
    }
  }

  if (event.data.type === 'CLEAR_OFFLINE_CACHE') {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.startsWith('mero-sadak-')) {
        await caches.delete(key);
      }
    }
    if (event.source) {
      event.source.postMessage({ type: 'CACHE_CLEARED' });
    }
  }

  if (event.data.type === 'GET_CACHE_STATS') {
    const stats = await calculateCacheStats();
    if (event.source) {
      event.source.postMessage({
        type: 'CACHE_STATS_RESULT',
        stats,
      });
    }
  }
});

function notifyProgress(processed, total, currentTask) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'PREFETCH_PROGRESS',
        processed,
        total,
        percentage: Math.round((processed / total) * 100),
        currentTask,
      });
    });
  }).catch(() => {});
}

async function calculateCacheStats() {
  let totalTiles = 0;
  let totalDataEntries = 0;

  try {
    const tileCache = await caches.open(CACHE_NAMES.TILES);
    const tileKeys = await tileCache.keys();
    totalTiles = tileKeys.length;

    const dataCache = await caches.open(CACHE_NAMES.DATA);
    const dataKeys = await dataCache.keys();
    totalDataEntries = dataKeys.length;
  } catch (e) {
    // Ignore
  }

  return {
    tilesCount: totalTiles,
    dataCount: totalDataEntries,
    isReady: totalTiles > 0 && totalDataEntries > 0,
  };
}
