import { useState, useEffect, useCallback } from 'react';
import { fetchRoadIncidents } from '../services/roadService';
import { TravelIncident } from '../types';
import { APP_CONFIG } from '../config/config'; // ✅ Import your new config

export function useRoads() {
  const [data, setData] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ Added error state
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 💡 If we are in dev mode, add a tiny delay so you can see the loading state
      if (APP_CONFIG.useMocks) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const result = await fetchRoadIncidents();
      setData(result);
      setLastSync(new Date());
    } catch (err: any) {
      console.error("[useRoads Hook] Error:", err);
      setError(err.message || "Failed to load road data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { 
    load(); 
  }, [load]);

  return { 
    data, 
    isLoading, 
    error, 
    lastSync, 
    refresh: load 
  };
}