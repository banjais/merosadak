
import { useState, useEffect, useCallback } from 'react';
import { fetchWeatherIncidents } from '../services/weatherService';
import { TravelIncident } from '../types';

export function useWeather() {
  const [data, setData] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchWeatherIncidents();
      setData(result);
      setLastSync(new Date());
    } catch (err) {
      console.error("[useWeather] Failed to load weather data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, lastSync, refresh: load };
}
