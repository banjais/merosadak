// Mero Sadak Nepal Highway GIS - Service Worker
// Version 1.5.0 - Hardened offline: opaque-safe tiles, richer data pack, shell+asset caching

const SW_VERSION = '1.5.0';
const APP_BUILD = '20260922-pwa-auto';
const CACHE_NAMES = {
  STATIC: 'mero-sadak-static-v5',
  TILES: 'mero-sadak-tiles-v5',
  DATA: 'mero-sadak-data-v5',
};

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
];

const STATIC_DATA_URLS = [
  '/data/cities-and-junctions.json',
  '/data/cities.json',
  '/data/distance-matrix.json',
  '/data/highway-info.json',
  '/data/highway-coords.json',
  '/data/blackspots.json',
  '/data/bus-stations.json',
  '/data/airports.json',
  '/data/district-hqs.json',
  '/data/district-centroids.json',
  '/data/district-terrain.json',
];

const API_ENDPOINTS = [
  '/api/highways',
  '/api/cities',
  '/api/road-alerts',
  '/api/weather',
  '/api/pois',
  '/api/traffic',
  '/api/offline-bundle',
  '/api/dhm-rainfall',
];

const NEPAL_CORE_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/6/27/46',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/6/27/47',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/6/28/46',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/6/28/47',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/7/54/93',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/7/54/94',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/7/54/95',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/7/55/93',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/7/55/94',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/7/55/95',
];

function isTileRequest(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes('basemaps.cartocdn.com') ||
      u.hostname.includes('arcgisonline.com') ||
      /\/\d+\/\d+\/\d+\.(png|jpg|jpeg|webp)$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function isApiRequest(url) {
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function isStaticDataRequest(url) {
  try {
    return new URL(url).pathname.startsWith('/data/');
  } catch {
    return false;
  }
}

function isManifestRequest(url) {
  try {
    return new URL(url).pathname === '/manifest.json';
  } catch {
    return false;
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html'));
}

async function putIfUsable(cache, request, response) {
  if (!response || response.type === 'opaque' || response.status !== 200) return false;
  try {
    await cache.put(request, response.clone());
    return true;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const staticCache = await caches.open(CACHE_NAMES.STATIC);
    const dataCache = await caches.open(CACHE_NAMES.DATA);
    const tileCache = await caches.open(CACHE_NAMES.TILES);

    await Promise.allSettled(PRECACHE_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (res.ok) await staticCache.put(url, res);
      } catch (e) {
        console.warn('[SW] precache skip', url);
      }
    }));

    await Promise.allSettled(STATIC_DATA_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (res.ok) await dataCache.put(url, res);
      } catch (e) {
        console.warn('[SW] static data skip', url);
      }
    }));

    await Promise.allSettled(NEPAL_CORE_TILES.map(async (tileUrl) => {
      try {
        const res = await fetch(tileUrl, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (res.ok) await tileCache.put(tileUrl, res);
      } catch (_) {}
    }));

    console.log('[SW] Mero Sadak', SW_VERSION, 'installed');
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set(Object.values(CACHE_NAMES));
    const keys = await caches.keys();
    // Drop every previous app cache automatically — user never needs to clear storage
    await Promise.all(
      keys
        .filter((k) => !keep.has(k) && (k.startsWith('mero-sadak-') || k.startsWith('workbox-') || k.includes('precache')))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'SW_ACTIVATED',
        version: SW_VERSION,
        build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : SW_VERSION,
        action: 'reload-recommended',
      });
    }
    console.log('[SW] Mero Sadak', SW_VERSION, 'active — old caches purged');
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (isManifestRequest(request.url)) {
    event.respondWith((async () => {
      const staticCache = await caches.open(CACHE_NAMES.STATIC);
      const cached = await staticCache.match(request);
      if (cached) return cached;
      try {
        const networkRes = await fetch(request);
        if (networkRes.ok) await staticCache.put(request, networkRes.clone());
        return networkRes;
      } catch {
        return new Response(JSON.stringify({
          name: 'Mero Sadak', short_name: 'MeroSadak', start_url: '/', display: 'standalone',
          background_color: '#070f1e', theme_color: '#070f1e', icons: []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  if (isTileRequest(request.url)) {
    event.respondWith((async () => {
      const tileCache = await caches.open(CACHE_NAMES.TILES);
      const cached = await tileCache.match(request);
      if (cached) {
        fetch(request, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
          .then((res) => putIfUsable(tileCache, request, res)).catch(() => {});
        return cached;
      }
      try {
        const networkRes = await fetch(request, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
        await putIfUsable(tileCache, request, networkRes);
        return networkRes;
      } catch {
        const alt = await tileCache.match(request.url);
        if (alt) return alt;
        return new Response('', { status: 408, statusText: 'Tile Offline' });
      }
    })());
    return;
  }

  if (isStaticDataRequest(request.url) && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const dataCache = await caches.open(CACHE_NAMES.DATA);
      const cached = await dataCache.match(request);
      if (cached) {
        fetch(request).then((res) => putIfUsable(dataCache, request, res)).catch(() => {});
        return cached;
      }
      try {
        const networkRes = await fetch(request);
        await putIfUsable(dataCache, request, networkRes);
        return networkRes;
      } catch {
        return new Response(JSON.stringify({ error: 'offline', path: url.pathname }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        });
      }
    })());
    return;
  }

  if (isApiRequest(request.url)) {
    event.respondWith((async () => {
      const dataCache = await caches.open(CACHE_NAMES.DATA);
      try {
        const networkRes = await fetch(request);
        if (networkRes.ok) await putIfUsable(dataCache, request, networkRes);
        return networkRes;
      } catch {
        const cached = (await dataCache.match(request)) || (await dataCache.match(url.pathname));
        if (cached) return cached;
        return new Response(JSON.stringify({ error: 'offline', source: 'none' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        });
      }
    })());
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith((async () => {
      const staticCache = await caches.open(CACHE_NAMES.STATIC);
      try {
        const networkRes = await fetch(request);
        if (networkRes.ok) await putIfUsable(staticCache, '/index.html', networkRes);
        return networkRes;
      } catch {
        return (await staticCache.match('/index.html')) || (await staticCache.match('/')) ||
          new Response('Offline — open Mero Sadak once online to refresh the app shell.', {
            status: 503, headers: { 'Content-Type': 'text/plain' }
          });
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const staticCache = await caches.open(CACHE_NAMES.STATIC);
      const cached = await staticCache.match(request);
      const networkPromise = fetch(request).then(async (res) => {
        if (res.ok) await putIfUsable(staticCache, request, res);
        return res;
      }).catch(() => null);
      if (cached) { networkPromise.catch(() => {}); return cached; }
      const networkRes = await networkPromise;
      if (networkRes) return networkRes;
      return new Response('', { status: 504, statusText: 'Offline' });
    })());
  }
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (event.data.type === 'GET_VERSION') {
    if (event.source) {
      event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION, build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : SW_VERSION });
    }
    return;
  }
  if (event.data.type === 'PREFETCH_OFFLINE_PACK') { event.waitUntil(handlePrefetch(event)); return; }
  if (event.data.type === 'CLEAR_OFFLINE_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('mero-sadak-')).map((k) => caches.delete(k)));
      if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
    })());
    return;
  }
  if (event.data.type === 'GET_CACHE_STATS') {
    event.waitUntil((async () => {
      const stats = await calculateCacheStats();
      if (event.source) event.source.postMessage({ type: 'CACHE_STATS_RESULT', stats });
    })());
  }
});

async function handlePrefetch(event) {
  const apiUrls = event.data.apiUrls || API_ENDPOINTS;
  const tileUrls = event.data.tileUrls || [];
  const dataUrls = event.data.dataUrls || STATIC_DATA_URLS;
  const totalItems = apiUrls.length + tileUrls.length + dataUrls.length;
  let processed = 0;
  const dataCache = await caches.open(CACHE_NAMES.DATA);
  const tileCache = await caches.open(CACHE_NAMES.TILES);

  for (const dataUrl of dataUrls) {
    try {
      const res = await fetch(dataUrl, { credentials: 'same-origin' });
      if (res.ok) await dataCache.put(dataUrl, res);
    } catch (_) {}
    processed++;
    notifyProgress(processed, totalItems, 'Cached data: ' + dataUrl);
  }
  for (const apiUrl of apiUrls) {
    try {
      const res = await fetch(apiUrl);
      if (res && res.status === 200) await dataCache.put(apiUrl, res.clone ? res.clone() : res);
    } catch (_) {}
    processed++;
    notifyProgress(processed, totalItems, 'Cached API: ' + apiUrl);
  }
  for (const tileUrl of tileUrls) {
    try {
      const res = await fetch(tileUrl, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (res && res.ok) await tileCache.put(tileUrl, res);
    } catch (_) {}
    processed++;
    if (processed % 5 === 0 || processed === totalItems) {
      notifyProgress(processed, totalItems, 'Cached map tile (' + processed + '/' + totalItems + ')');
    }
  }
  if (event.source) {
    event.source.postMessage({ type: 'PREFETCH_COMPLETE', totalItems, timestamp: Date.now(), version: SW_VERSION });
  }
}

function notifyProgress(processed, total, currentTask) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'PREFETCH_PROGRESS', processed, total, percentage: Math.round((processed / total) * 100), currentTask });
    });
  }).catch(() => {});
}

async function calculateCacheStats() {
  let totalTiles = 0, totalDataEntries = 0;
  try {
    totalTiles = (await (await caches.open(CACHE_NAMES.TILES)).keys()).length;
    totalDataEntries = (await (await caches.open(CACHE_NAMES.DATA)).keys()).length;
  } catch (_) {}
  return { tilesCount: totalTiles, dataCount: totalDataEntries, isReady: totalTiles > 0 || totalDataEntries > 0, version: SW_VERSION };
}
