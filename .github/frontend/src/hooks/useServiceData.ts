import { useState, useEffect, useCallback } from 'react';
import { fetchServiceData, ServiceItem } from '../services/gasService';

export function useServiceData(serviceType: string | null, lat: number, lng: number, loading: boolean) {
  const [data, setData] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!serviceType || loading || (lat === 0 && lng === 0)) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchServiceData(serviceType, lat, lng);
      setData(result);
      setLastSync(new Date());
    } catch (err: any) {
      setError(err.message || `Failed to load ${serviceType} data`);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [serviceType, lat, lng, loading]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, lastSync, refresh: load };
}
