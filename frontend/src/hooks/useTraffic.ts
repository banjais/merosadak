
import { useState, useEffect, useCallback } from 'react';
import { fetchTrafficIncidents } from '../services/trafficService';
import { TravelIncident } from '../types';

export function useTraffic() {
  const [data, setData] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchTrafficIncidents();
      setData(result);
      setLastSync(new Date());
    } catch (err) {
      console.error("[useTraffic] Failed to load traffic data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, lastSync, refresh: load };
}
