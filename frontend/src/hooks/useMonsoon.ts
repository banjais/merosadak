
import { useState, useEffect, useCallback } from 'react';
import { fetchMonsoonIncidents } from '../services/monsoonService';
import { TravelIncident } from '../types';

export function useMonsoon() {
  const [data, setData] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchMonsoonIncidents();
      setData(result);
      setLastSync(new Date());
    } catch (err) {
      console.error("[useMonsoon] Failed to load monsoon data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, lastSync, refresh: load };
}
