// Mero Sadak Nepal Highway GIS - Service Worker
// Version 1.2.0 - Mountain Offline Caching & Map Tile Engine

const CACHE_NAMES = {
  STATIC: 'mero-sadak-static-v1.2',
  TILES: 'mero-sadak-tiles-v1.2',
  DATA: 'mero-sadak-data-v1.2',
};

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap',
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
  // Zoom 6
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/6/46/27.png',
  'https://b.basemaps.cartocdn.com/rastertiles/voyager/6/47/27.png',
  'https://c.basemaps.cartocdn.com/rastertiles/voyager/6/46/28.png',
  'https://d.basemaps.cartocdn.com/rastertiles/voyager/6/47/28.png',
  // Zoom 7 (Nepal East-West & Central)
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/7/93/54.png',
  'https://b.basemaps.cartocdn.com/rastertiles/voyager/7/94/54.png',
  'https://c.basemaps.cartocdn.com/rastertiles/voyager/7/95/54.png',
  'https://d.basemaps.cartocdn.com/rastertiles/voyager/7/93/55.png',
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/7/94/55.png',
  'https://b.basemaps.cartocdn.com/rastertiles/voyager/7/95/55.png',
  // Zoom 8 (Kathmandu, Pokhara, Chitwan, Narayanghat, Butwal, Biratnagar)
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/8/187/109.png',
  'https://b.basemaps.cartocdn.com/rastertiles/voyager/8/188/109.png',
  'https://c.basemaps.cartocdn.com/rastertiles/voyager/8/189/109.png',
  'https://d.basemaps.cartocdn.com/rastertiles/voyager/8/190/109.png',
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/8/187/110.png',
  'https://b.basemaps.cartocdn.com/rastertiles/voyager/8/188/110.png',
  'https://c.basemaps.cartocdn.com/rastertiles/voyager/8/189/110.png',
  'https://d.basemaps.cartocdn.com/rastertiles/voyager/8/190/110.png',
];

// Install Event: Precaches base static app shell and core tiles
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_NAMES.STATIC);
        await staticCache.addAll(PRECACHE_ASSETS.map((url) => new Request(url, { mode: 'no-cors' })));
        
        const tileCache = await caches.open(CACHE_NAMES.TILES);
        await Promise.allSettled(
          NEPAL_CORE_TILES.map(async (tileUrl) => {
            try {
              const res = await fetch(tileUrl, { mode: 'no-cors' });
              if (res) await tileCache.put(tileUrl, res);
            } catch (e) {
              // Ignore tile prefetch network error if offline during install
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
    url.includes('/rastertiles/') ||
    url.match(/\/\d+\/\d+\/\d+(\.png|@2x\.png|\.jpg|\.webp)/i)
  );
}

// Helper: Check if request is API
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

// Fetch Event Router
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (e.g. POST report submissions)
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
          // In the background, refresh the tile if online
          fetch(event.request)
            .then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                tileCache.put(event.request, networkRes);
              }
            })
            .catch(() => {}); // Silent fail when in mountain offline mode
          return cachedResponse;
        }

        // Not in cache, fetch from network and cache
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            tileCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // If offline and tile not found, return an empty 200 or transparent pixel fallback
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
          // Try fetching from live network
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            dataCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Network failed (mountain gorge, no signal) -> retrieve cached version
          const cachedResponse = await dataCache.match(event.request);
          if (cachedResponse) {
            // Add custom header to indicate offline cached response
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

// Custom Message Event: Allows the UI to trigger bulk prefetching for Nepal mountain regions
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
      notifyProgress(processedItems, totalItems, `Cached API: ${apiUrl}`);
    }

    // Cache Map Tiles
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

    // Send complete notification
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
    dataCount: totalDataEntries,
    isReady: totalTiles > 0 && totalDataEntries > 0,
  };
}
