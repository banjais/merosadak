
import { useState, useEffect, useCallback } from 'react';
import { fetchPOIs } from '../services/poiService';
import { TravelIncident } from '../types';

export function usePOIs() {
  const [data, setData] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchPOIs();
      setData(result);
      setLastSync(new Date());
    } catch (err) {
      console.error("[usePOIs] Failed to load POI data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, lastSync, refresh: load };
}
