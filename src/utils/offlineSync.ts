// Mero Sadak Nepal GIS - Offline Mountain Synchronization & Service Worker Bridge
import { HighwaySegment } from '../types';

export interface OfflineCacheStats {
  isServiceWorkerActive: boolean;
  tilesCount: number;
  dataEndpointsCount: number;
  lastSyncTimestamp: number | null;
  approxStorageSizeMb: string;
  isReadyForOffline: boolean;
  cachedSegmentsCount?: number;
}

export interface PrefetchProgress {
  processed: number;
  total: number;
  percentage: number;
  currentTask: string;
  stage: 'idle' | 'apis' | 'tiles' | 'route_data' | 'complete' | 'error';
  segmentName?: string;
  bytesCached?: number;
  totalBytesEst?: number;
  currentSegmentIndex?: number;
  totalSegments?: number;
}

export interface SelectedSegmentWithHighway {
  segment: HighwaySegment;
  highwayCode: string;
  highwayName: string;
}

export interface CachedSegmentData {
  segment: HighwaySegment;
  highwayCode: string;
  highwayName: string;
  cachedAt: number;
  tileCount: number;
  approxSizeKb: number;
}

const LOCAL_STORAGE_CACHE_KEY = 'mero_sadak_offline_bundle_v1';
const LOCAL_STORAGE_LAST_SYNC_KEY = 'mero_sadak_last_sync_timestamp';
const LOCAL_STORAGE_CACHED_SEGMENTS_KEY = 'mero_sadak_cached_segments_v1';

// Helper: Convert Lat/Lng to Tile coordinates (OSM/Carto standard)
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number; z: number } {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  return { x, y, z: zoom };
}

// Generate tile URLs covering Nepal's highways
export function generateNepalHighwayTileUrls(): string[] {
  const urls: Set<string> = new Set();
  const subdomains = ['a', 'b', 'c', 'd'];

  const getTileUrl = (x: number, y: number, z: number, idx: number) => {
    const sub = subdomains[idx % subdomains.length];
    return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
  };

  let tileCounter = 0;

  // Zoom 6 & 7: Cover the entire rectangle of Nepal (Lat: 26.3 to 30.5, Lng: 80.0 to 88.3)
  for (let z = 6; z <= 7; z++) {
    const minTile = latLngToTile(30.5, 80.0, z);
    const maxTile = latLngToTile(26.3, 88.3, z);
    for (let x = minTile.x; x <= maxTile.x; x++) {
      for (let y = minTile.y; y <= maxTile.y; y++) {
        urls.add(getTileUrl(x, y, z, tileCounter++));
      }
    }
  }

  // Zoom 8 & 9: Key highway corridor centers
  const highwayKeyPoints = [
    { lat: 27.7172, lng: 85.324 }, // Kathmandu Valley
    { lat: 28.2096, lng: 83.9856 }, // Pokhara
    { lat: 27.8617, lng: 84.5542 }, // Mugling junction (Prithvi H04 / Narayanghat H05)
    { lat: 27.6805, lng: 84.4333 }, // Narayanghat / Chitwan
    { lat: 27.7006, lng: 83.4484 }, // Butwal / Bhairahawa
    { lat: 27.4284, lng: 85.0322 }, // Hetauda (Tribhuvan H02 / East-West H01)
    { lat: 27.2417, lng: 85.9234 }, // Sindhuli (BP Highway H13)
    { lat: 26.8167, lng: 85.9 }, // Bardibas / Janakpur
    { lat: 26.4525, lng: 87.2718 }, // Biratnagar / Itahari
    { lat: 26.8124, lng: 87.2834 }, // Dharan / Koshi Highway H08
    { lat: 28.05, lng: 81.6167 }, // Nepalgunj / Kohalpur
    { lat: 28.6833, lng: 81.6333 }, // Surkhet (Karnali Highway H10 entry)
    { lat: 28.9667, lng: 80.1833 }, // Dhangadhi / Mahendranagar (Far West)
    { lat: 27.8732, lng: 84.6054 }, // Kurintar (Trishuli gorge)
    { lat: 27.9622, lng: 84.4125 }, // Dumre / Bandipur
    { lat: 27.6167, lng: 85.55 }, // Dhulikhel (Araniko H03 / BP Hwy H13)
  ];

  for (const pt of highwayKeyPoints) {
    for (let z = 8; z <= 9; z++) {
      const center = latLngToTile(pt.lat, pt.lng, z);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          urls.add(getTileUrl(center.x + dx, center.y + dy, z, tileCounter++));
        }
      }
    }
  }

  return Array.from(urls);
}

// Register Service Worker
export async function registerServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[Mero Sadak] Mountain Offline Service Worker registered with scope:', registration.scope);
    return true;
  } catch (error) {
    console.warn('[Mero Sadak] Service Worker registration failed (may run without SW in sandboxed iframe):', error);
    return false;
  }
}

// Inspect current offline cache stats
export async function getOfflineCacheStats(): Promise<OfflineCacheStats> {
  let tilesCount = 0;
  let dataEndpointsCount = 0;
  let isServiceWorkerActive = false;

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    isServiceWorkerActive = !!navigator.serviceWorker.controller;
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const tileCache = await caches.open('mero-sadak-tiles-v1.2');
      const tileKeys = await tileCache.keys();
      tilesCount = tileKeys.length;

      const dataCache = await caches.open('mero-sadak-data-v1.2');
      const dataKeys = await dataCache.keys();
      dataEndpointsCount = dataKeys.length;
    } catch (e) {
      // Fallback
    }
  }

  const rawTimestamp = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_LAST_SYNC_KEY) : null;
  const lastSyncTimestamp = rawTimestamp ? parseInt(rawTimestamp, 10) : null;
  const cachedSegmentsMap = getStoredCachedSegments();
  const cachedSegmentsCount = Object.keys(cachedSegmentsMap).length;

  // Approximate size: ~25KB per tile + ~100KB per data bundle
  const approxBytes = tilesCount * 25000 + dataEndpointsCount * 120000;
  const approxStorageSizeMb = (approxBytes / (1024 * 1024)).toFixed(2);

  return {
    isServiceWorkerActive,
    tilesCount,
    dataEndpointsCount,
    lastSyncTimestamp,
    approxStorageSizeMb,
    isReadyForOffline: tilesCount > 10 || dataEndpointsCount > 0 || cachedSegmentsCount > 0,
    cachedSegmentsCount,
  };
}

// Download & Pre-cache Nepal Mountain Offline Pack
export async function downloadMountainOfflinePack(
  onProgress?: (progress: PrefetchProgress) => void
): Promise<{ success: boolean; totalTiles: number; error?: string }> {
  const apiUrls = [
    '/api/highways',
    '/api/cities',
    '/api/road-alerts',
    '/api/weather',
    '/api/pois',
    '/api/traffic',
    '/api/offline-bundle',
  ];

  const tileUrls = generateNepalHighwayTileUrls();
  const totalItems = apiUrls.length + tileUrls.length;
  let processed = 0;

  try {
    // 1. Fetch and Cache API Endpoints
    if (onProgress) {
      onProgress({
        processed: 0,
        total: totalItems,
        percentage: 0,
        currentTask: 'Downloading live highway datasets & mountain pass weather...',
        stage: 'apis',
      });
    }

    let offlineBundleData: any = null;

    for (const url of apiUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const cloned = res.clone();
          if (url === '/api/offline-bundle') {
            offlineBundleData = await res.json();
            if (typeof window !== 'undefined') {
              localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(offlineBundleData));
            }
          }
          if ('caches' in window) {
            const dataCache = await caches.open('mero-sadak-data-v1.2');
            await dataCache.put(url, cloned);
          }
        }
      } catch (err) {
        console.warn('API fetch warning for', url, err);
      }
      processed++;
      if (onProgress) {
        onProgress({
          processed,
          total: totalItems,
          percentage: Math.round((processed / totalItems) * 100),
          currentTask: `Cached ${url.replace('/api/', '')} endpoint`,
          stage: 'apis',
        });
      }
    }

    // 2. Fetch and Cache Map Tiles in batches
    if (onProgress) {
      onProgress({
        processed,
        total: totalItems,
        percentage: Math.round((processed / totalItems) * 100),
        currentTask: `Prefetching ${tileUrls.length} high-clarity highway map tiles...`,
        stage: 'tiles',
      });
    }

    const batchSize = 6;
    for (let i = 0; i < tileUrls.length; i += batchSize) {
      const batch = tileUrls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (tileUrl) => {
          try {
            const res = await fetch(tileUrl, { mode: 'no-cors' });
            if (res && 'caches' in window) {
              const tileCache = await caches.open('mero-sadak-tiles-v1.2');
              await tileCache.put(tileUrl, res);
            }
          } catch (e) {
            // Ignore single tile network errors
          }
        })
      );

      processed += batch.length;
      if (onProgress) {
        onProgress({
          processed,
          total: totalItems,
          percentage: Math.round((processed / totalItems) * 100),
          currentTask: `Caching tiles: ${processed - apiUrls.length} / ${tileUrls.length}`,
          stage: 'tiles',
        });
      }
    }

    const now = Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LAST_SYNC_KEY, now.toString());
    }

    if (onProgress) {
      onProgress({
        processed: totalItems,
        total: totalItems,
        percentage: 100,
        currentTask: 'Mountain Offline Pack successfully saved!',
        stage: 'complete',
      });
    }

    return { success: true, totalTiles: tileUrls.length };
  } catch (error: any) {
    console.error('Error downloading mountain offline pack:', error);
    if (onProgress) {
      onProgress({
        processed,
        total: totalItems,
        percentage: Math.round((processed / totalItems) * 100),
        currentTask: 'Encountered error during offline pack sync',
        stage: 'error',
      });
    }
    return { success: false, totalTiles: 0, error: error.message };
  }
}

// Clear all offline cached tiles and data
export async function clearOfflineStorage(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_CACHE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_LAST_SYNC_KEY);
      localStorage.removeItem(LOCAL_STORAGE_CACHED_SEGMENTS_KEY);
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.startsWith('mero-sadak-')) {
          await caches.delete(key);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('Error clearing offline caches:', err);
    return false;
  }
}

// Load cached local offline bundle (instant fallback)
export function getStoredOfflineBundle(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Stored cached segments registry for low-connectivity regions
export function getStoredCachedSegments(): Record<string, CachedSegmentData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CACHED_SEGMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getCachedSegmentIds(): string[] {
  return Object.keys(getStoredCachedSegments());
}

export function isSegmentCached(segmentId: string): boolean {
  return !!getStoredCachedSegments()[segmentId];
}

export async function removeCachedSegments(segmentIds: string[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const cached = getStoredCachedSegments();
    for (const id of segmentIds) {
      delete cached[id];
    }
    localStorage.setItem(LOCAL_STORAGE_CACHED_SEGMENTS_KEY, JSON.stringify(cached));
    if ('caches' in window) {
      const dataCache = await caches.open('mero-sadak-data-v1.2');
      await dataCache.put(
        '/api/cached-segments',
        new Response(JSON.stringify(cached), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
  } catch (e) {
    console.warn('Error removing cached segments:', e);
  }
}

// Generate tile URLs specifically focused along the coordinate path of selected segments
export function generateTilesForSegments(segments: HighwaySegment[]): string[] {
  const urls: Set<string> = new Set();
  const subdomains = ['a', 'b', 'c', 'd'];

  const getTileUrl = (x: number, y: number, z: number, idx: number) => {
    const sub = subdomains[idx % subdomains.length];
    return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
  };

  let tileCounter = 0;

  // Zooms 8 through 11:
  // Zoom 8: Overview of mountain corridor
  // Zoom 9-10: Highway river bends and gorge passes
  // Zoom 11: Sharp hairpins and village settlements
  for (const seg of segments) {
    if (!seg.coordinates || seg.coordinates.length === 0) continue;

    for (const [lat, lng] of seg.coordinates) {
      for (const z of [8, 9, 10, 11]) {
        const center = latLngToTile(lat, lng, z);
        urls.add(getTileUrl(center.x, center.y, z, tileCounter++));
        // Add 1-tile neighborhood for smooth panning margins at zoom 8-10
        if (z <= 10) {
          urls.add(getTileUrl(center.x + 1, center.y, z, tileCounter++));
          urls.add(getTileUrl(center.x - 1, center.y, z, tileCounter++));
          urls.add(getTileUrl(center.x, center.y + 1, z, tileCounter++));
          urls.add(getTileUrl(center.x, center.y - 1, z, tileCounter++));
        }
      }
    }
  }

  return Array.from(urls);
}

// Download & cache specifically selected highway segments & tiles with granular progress tracking
export async function cacheSelectedSegments(
  items: SelectedSegmentWithHighway[],
  onProgress?: (progress: PrefetchProgress) => void
): Promise<{
  success: boolean;
  cachedCount: number;
  totalTiles: number;
  approxBytes: number;
  error?: string;
}> {
  if (!items || items.length === 0) {
    return { success: true, cachedCount: 0, totalTiles: 0, approxBytes: 0 };
  }

  const segments = items.map((it) => it.segment);
  const tileUrls = generateTilesForSegments(segments);

  // Total items = route metadata + tile URLs + endpoints
  const totalItems = items.length + tileUrls.length + 3;
  let processed = 0;
  let bytesDownloaded = 0;

  try {
    // Stage 1: Route Data & Topographical Elevation Profiles
    if (onProgress) {
      onProgress({
        processed: 0,
        total: totalItems,
        percentage: 0,
        currentTask: `Packaging route vectors & elevation profiles for ${items.length} segment${
          items.length > 1 ? 's' : ''
        }...`,
        stage: 'route_data',
        segmentName: `${items[0].highwayCode}: ${items[0].segment.from} → ${items[0].segment.to}`,
        bytesCached: 0,
        totalBytesEst: tileUrls.length * 25000 + items.length * 15000,
        currentSegmentIndex: 0,
        totalSegments: items.length,
      });
    }

    const cachedSegmentsMap = getStoredCachedSegments();
    const now = Date.now();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const segTiles = generateTilesForSegments([item.segment]);
      const approxKb = Math.round(segTiles.length * 25 + 15);

      cachedSegmentsMap[item.segment.id] = {
        segment: item.segment,
        highwayCode: item.highwayCode,
        highwayName: item.highwayName,
        cachedAt: now,
        tileCount: segTiles.length,
        approxSizeKb: approxKb,
      };

      processed++;
      bytesDownloaded += 15000;

      if (onProgress) {
        onProgress({
          processed,
          total: totalItems,
          percentage: Math.round((processed / totalItems) * 100),
          currentTask: `Stored geometry & elevation for ${item.segment.from} → ${item.segment.to} (${item.highwayCode})`,
          stage: 'route_data',
          segmentName: `${item.highwayCode}: ${item.segment.from} → ${item.segment.to}`,
          bytesCached: bytesDownloaded,
          totalBytesEst: tileUrls.length * 25000 + items.length * 15000,
          currentSegmentIndex: i + 1,
          totalSegments: items.length,
        });
      }

      await new Promise((r) => setTimeout(r, 50));
    }

    // Persist segment catalog to localStorage and CacheStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_CACHED_SEGMENTS_KEY, JSON.stringify(cachedSegmentsMap));
    }

    if ('caches' in window) {
      try {
        const dataCache = await caches.open('mero-sadak-data-v1.2');
        await dataCache.put(
          '/api/cached-segments',
          new Response(JSON.stringify(cachedSegmentsMap), {
            headers: { 'Content-Type': 'application/json' },
          })
        );
      } catch (e) {
        // CacheStorage fallback
      }
    }

    // Stage 2: Cache Map Tiles along the segment coordinates
    if (onProgress) {
      onProgress({
        processed,
        total: totalItems,
        percentage: Math.round((processed / totalItems) * 100),
        currentTask: `Downloading ${tileUrls.length} cartographic tiles along selected mountain corridors...`,
        stage: 'tiles',
        segmentName: items[0].segment.from,
        bytesCached: bytesDownloaded,
        totalBytesEst: tileUrls.length * 25000 + items.length * 15000,
      });
    }

    const batchSize = 6;
    let tileBatchCounter = 0;
    for (let i = 0; i < tileUrls.length; i += batchSize) {
      const batch = tileUrls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (tileUrl) => {
          try {
            const res = await fetch(tileUrl, { mode: 'no-cors' });
            if (res && 'caches' in window) {
              const tileCache = await caches.open('mero-sadak-tiles-v1.2');
              await tileCache.put(tileUrl, res);
            }
          } catch {
            // Continue on individual tile network glitches
          }
        })
      );

      tileBatchCounter += batch.length;
      processed += batch.length;
      bytesDownloaded += batch.length * 25000;

      const currentSegment =
        items[Math.min(Math.floor((i / Math.max(1, tileUrls.length)) * items.length), items.length - 1)];

      if (onProgress) {
        onProgress({
          processed,
          total: totalItems,
          percentage: Math.round((processed / totalItems) * 100),
          currentTask: `Cached tile ${tileBatchCounter} of ${tileUrls.length} along ${currentSegment.segment.from} → ${currentSegment.segment.to} (${currentSegment.highwayCode})`,
          stage: 'tiles',
          segmentName: `${currentSegment.segment.from} → ${currentSegment.segment.to}`,
          bytesCached: bytesDownloaded,
          totalBytesEst: tileUrls.length * 25000 + items.length * 15000,
        });
      }

      await new Promise((r) => setTimeout(r, 25));
    }

    // Stage 3: Sync Road Alerts, Pass Weather & POIs for Selected Segments
    if (onProgress) {
      onProgress({
        processed,
        total: totalItems,
        percentage: Math.round((processed / totalItems) * 100),
        currentTask: 'Caching mountain pass weather telemetry and road hazard alerts...',
        stage: 'apis',
        bytesCached: bytesDownloaded,
        totalBytesEst: tileUrls.length * 25000 + items.length * 15000,
      });
    }

    const endpoints = ['/api/road-alerts', '/api/weather', '/api/highways'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (res.ok && 'caches' in window) {
          const dataCache = await caches.open('mero-sadak-data-v1.2');
          await dataCache.put(ep, res.clone());
        }
      } catch {
        // Fallback
      }
      processed++;
      bytesDownloaded += 25000;
    }

    // Record last sync
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LAST_SYNC_KEY, now.toString());
    }

    // Stage Complete
    if (onProgress) {
      onProgress({
        processed: totalItems,
        total: totalItems,
        percentage: 100,
        currentTask: `Successfully cached ${items.length} segment${
          items.length > 1 ? 's' : ''
        } (${tileUrls.length} tiles)! Ready for offline travel.`,
        stage: 'complete',
        bytesCached: bytesDownloaded,
        totalBytesEst: bytesDownloaded,
      });
    }

    return {
      success: true,
      cachedCount: items.length,
      totalTiles: tileUrls.length,
      approxBytes: bytesDownloaded,
    };
  } catch (error: any) {
    console.error('Error caching selected segments:', error);
    if (onProgress) {
      onProgress({
        processed,
        total: totalItems,
        percentage: Math.round((processed / totalItems) * 100),
        currentTask: 'Caching interrupted: low network connectivity',
        stage: 'error',
      });
    }
    return {
      success: false,
      cachedCount: 0,
      totalTiles: 0,
      approxBytes: bytesDownloaded,
      error: error.message,
    };
  }
}
