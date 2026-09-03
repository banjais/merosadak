// Mero Sadak Nepal Highway GIS - Service Worker
// Version 1.2.0 - Mountain Offline Caching & Map Tile Engine
// Ported from merosadak-reference with three-tier caching strategy

const CACHE_NAMES = {
  STATIC: 'merosadak-static-v1.3',
  TILES: 'merosadak-tiles-v1.3',
  DATA: 'merosadak-data-v1.3',
};

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap',
];

// Key Nepal highway tile bounding coordinates (Zoom 6-7 covers all Nepal)
const NEPAL_CORE_TILES = [];

// Install Event: Precaches base static app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_NAMES.STATIC);
        await staticCache.addAll(PRECACHE_ASSETS.map((url) => new Request(url, { mode: 'no-cors' })));
      } catch (err) {
        console.warn('[SW] Precache during install skipped:', err);
      }
    })()
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const activeCacheKeys = Object.values(CACHE_NAMES);
      const allCacheKeys = await caches.keys();
      await Promise.all(
        allCacheKeys.map((key) => {
          if (!activeCacheKeys.includes(key)) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Helper: Check if request is a map tile
function isTileRequest(url) {
  return (
    url.includes('basemaps.cartocdn.com') ||
    url.includes('tile.openstreetmap.org') ||
    url.includes('tile.opentopomap.org') ||
    url.includes('server.arcgisonline.com') ||
    url.includes('/rastertiles/') ||
    url.match(/\/\d+\/\d+\/\d+(\.png|@2x\.png|\.jpg|\.webp)/i)
  );
}

// Helper: Check if request is API
function isApiRequest(url) {
  if (url && url.pathname) {
    return url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/data/');
  }
  const s = String(url || '');
  return s.includes('/api/');
}

// Fetch Event Router
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategy 1: Map Tiles -> Cache-First with Stale-While-Revalidate
  if (isTileRequest(event.request.url)) {
    event.respondWith(
      (async () => {
        const tileCache = await caches.open(CACHE_NAMES.TILES);
        const cachedResponse = await tileCache.match(event.request);

        if (cachedResponse) {
          fetch(event.request)
            .then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                tileCache.put(event.request, networkRes.clone());
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            tileCache.put(event.request, networkResponse.clone());
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
        const dataCache = await caches.open(CACHE_NAMES.DATA);
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            dataCache.put(event.request, networkResponse.clone());
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
      const staticCache = await caches.open(CACHE_NAMES.STATIC);
      const cached = await staticCache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            staticCache.put(event.request, networkRes.clone());
          }
          return networkRes;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })()
  );
});

// Custom Message Event: bulk prefetching for Nepal mountain regions
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  if (event.data.type === 'PREFETCH_MOUNTAIN_PACK') {
    const { tileUrls = [], apiUrls = [] } = event.data;
    let totalItems = tileUrls.length + apiUrls.length;
    let processedItems = 0;

    const dataCache = await caches.open(CACHE_NAMES.DATA);
    const tileCache = await caches.open(CACHE_NAMES.TILES);

    // Cache APIs
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
      notifyProgress(processedItems, totalItems, 'Cached API: ' + apiUrl);
    }

    // Cache Map Tiles
    const batchSize = 6;
    for (let i = 0; i < tileUrls.length; i += batchSize) {
      const batch = tileUrls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (tileUrl) => {
          try {
            const res = await fetch(tileUrl, { mode: 'no-cors' });
            if (res) {
              await tileCache.put(tileUrl, res);
            }
          } catch (err) {
            // Continue
          }
        })
      );
      processedItems += batch.length;
      if (processedItems % 5 === 0 || processedItems === totalItems) {
        notifyProgress(processedItems, totalItems, 'Cached Map Tile (' + (processedItems - apiUrls.length) + '/' + tileUrls.length + ')');
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
      if (key.startsWith('merosadak-')) {
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
  });
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
    dataEndpointsCount: totalDataEntries,
    approxStorageSizeMb: ((totalDataEntries * 120000 + totalTiles * 25000) / (1024 * 1024)).toFixed(2),
    isReadyForOffline: totalTiles > 10 || totalDataEntries > 0,
  };
}
