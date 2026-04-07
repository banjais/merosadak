// src/hooks/useRoads.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiService';
import { TravelIncident } from '../types';

export function useRoads() {
  const [data, setData] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use the apiService which handles both mock and real data
      const result = await api.getRoads();
      
      setData(result);
      setLastSync(new Date());

    } catch (err: any) {
      console.error("[useRoads Hook] Error:", err);
      setError(err.message || "Failed to load road data");
      setData([]);
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
