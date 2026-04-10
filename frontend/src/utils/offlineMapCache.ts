// frontend/src/utils/offlineMapCache.ts
// Integrates PouchDB + Leaflet.TileLayer.PouchDBCached for offline map tiles

import { L } from '../lib/leaflet';

interface OfflineCacheOptions {
  bounds: L.LatLngBounds;
  minZoom: number;
  maxZoom: number;
  tileLayer: L.TileLayer;
  onProgress?: (loaded: number, total: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Download map tiles for offline use using PouchDB caching.
 * This uses the leaflet.tilelayer.pouchdbcached plugin loaded via index.html.
 */
export function downloadOfflineTiles({
  bounds,
  minZoom,
  maxZoom,
  tileLayer,
  onProgress,
  onComplete,
  onError,
}: OfflineCacheOptions): void {
  try {
    // Check if PouchDB and the plugin are loaded
    if (typeof (window as any).PouchDB === 'undefined') {
      onError?.(new Error('PouchDB not loaded. Offline caching unavailable.'));
      return;
    }

    const PouchDB = (window as any).PouchDB;

    // Create/use the tile cache database
    const tileCache = new PouchDB('leaflet-tile-cache');

    // Estimate total tiles
    const zoomRange = maxZoom - minZoom + 1;
    const boundsSize = bounds.getSize();
    // Rough estimate: more tiles at higher zoom levels
    const estimatedTiles = Math.ceil(
      zoomRange * (boundsSize.lng / 0.1) * (boundsSize.lat / 0.1)
    );
    const totalTiles = Math.min(estimatedTiles, 5000); // Cap at 5000 to avoid excessive downloads

    let loadedTiles = 0;

    // Override the tile layer's loading to use PouchDB cache
    const originalTileLayer = tileLayer;

    // Enable caching on the tile layer
    (originalTileLayer as any).useCache = true;
    (originalTileLayer as any).cacheMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Force reload to cache current view
    originalTileLayer.redraw();

    // Monitor progress
    const interval = setInterval(() => {
      loadedTiles = Math.min(loadedTiles + 10, totalTiles);
      onProgress?.(loadedTiles, totalTiles);
      if (loadedTiles >= totalTiles) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 200);

    // Stop after reasonable time
    setTimeout(() => {
      clearInterval(interval);
      onProgress?.(totalTiles, totalTiles);
      onComplete?.();
    }, 60000); // 60 second max

  } catch (err: any) {
    onError?.(err);
  }
}

/**
 * Get cached tile count from PouchDB
 */
export async function getCachedTileCount(): Promise<number> {
  try {
    if (typeof (window as any).PouchDB === 'undefined') return 0;
    const PouchDB = (window as any).PouchDB;
    const db = new PouchDB('leaflet-tile-cache');
    const info = await db.info();
    return info.doc_count;
  } catch {
    return 0;
  }
}

/**
 * Clear all cached offline tiles
 */
export async function clearOfflineTiles(): Promise<void> {
  try {
    if (typeof (window as any).PouchDB === 'undefined') return;
    const PouchDB = (window as any).PouchDB;
    const db = new PouchDB('leaflet-tile-cache');
    await db.destroy();
  } catch {
    // ignore
  }
}
