import { useState, useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { downloadOfflineTiles, getCachedTileCount } from '../utils/offlineMapCache';

interface UseOfflineMapCacheResult {
  isDownloading: boolean;
  progress: { loaded: number; total: number };
  cachedTiles: number;
  startDownload: () => void;
}

export function useOfflineMapCache(tileLayerRef: React.RefObject<any>): UseOfflineMapCacheResult {
  const map = useMap();
  const isDownloading = useRef(false);
  const [, forceUpdate] = useState(0);
  const [cachedTiles, setCachedTiles] = useState(0);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  // Check cached tile count periodically
  useEffect(() => {
    getCachedTileCount().then(setCachedTiles);
    const interval = setInterval(() => getCachedTileCount().then(setCachedTiles), 30000);
    return () => clearInterval(interval);
  }, []);

  const startDownload = useCallback(() => {
    if (isDownloading.current) return;
    isDownloading.current = true;
    forceUpdate(n => n + 1);

    const bounds = map.getBounds();
    const currentZoom = map.getZoom();
    const minZoom = Math.max(currentZoom - 2, 6);
    const maxZoom = Math.min(currentZoom + 1, 18);

    const tileLayer = tileLayerRef.current;
    if (!tileLayer) {
      isDownloading.current = false;
      return;
    }

    downloadOfflineTiles({
      bounds,
      minZoom,
      maxZoom,
      tileLayer,
      onProgress: (loaded, total) => {
        setProgress({ loaded, total });
      },
      onComplete: () => {
        isDownloading.current = false;
        forceUpdate(n => n + 1);
        getCachedTileCount().then(setCachedTiles);
      },
      onError: (err) => {
        console.error('Offline map download failed:', err);
        isDownloading.current = false;
        forceUpdate(n => n + 1);
      },
    });
  }, [map, tileLayerRef]);

  return { isDownloading: isDownloading.current, progress, cachedTiles, startDownload };
}
