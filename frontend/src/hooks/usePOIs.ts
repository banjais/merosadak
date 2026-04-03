import { useState, useEffect, useCallback } from 'react';
import { fetchPOIs } from '../services/poiService';
import { TravelIncident } from '../types';
import { useGeolocation } from './useGeolocation';

export function usePOIs() {
  const [data, setData] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const geo = useGeolocation();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchPOIs(geo.lat, geo.lng);
      setData(result);
      setLastSync(new Date());
    } catch (err) {
      console.error("[usePOIs] Failed to load POI data", err);
    } finally {
      setIsLoading(false);
    }
  }, [geo.lat, geo.lng]);

  useEffect(() => {
    if (!geo.loading) load();
  }, [load, geo.loading]);

  return { data, isLoading, lastSync, refresh: load };
}
