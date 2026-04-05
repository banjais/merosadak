// src/hooks/useNepalData.ts
import { useMemo, useCallback } from 'react';
import { useRoads } from './useRoads';
import { useTraffic } from './useTraffic';
import { useWeather } from './useWeather';
import { useMonsoon } from './useMonsoon';
import { usePOIs } from './usePOIs';
import { useBoundary } from './useBoundary';
import { TravelIncident } from '../types';

export function useNepalData() {
  // Individual data hooks
  const roads = useRoads();
  const traffic = useTraffic();
  const weather = useWeather();
  const monsoon = useMonsoon();
  const pois = usePOIs();
  const boundaryHook = useBoundary();

  // Combined incidents (only show road-related data when Nepal map is active)
  const incidents: TravelIncident[] = useMemo(() => {
    const allIncidents = [
      ...(roads.data || []),
      ...(traffic.data || []),
      ...(weather.data || []),
      ...(monsoon.data || []),
      ...(pois.data || []),
    ];

    // Sort by timestamp (newest first)
    return allIncidents.sort((a, b) => 
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
  }, [roads.data, traffic.data, weather.data, monsoon.data, pois.data]);

  const isLoading = roads.isLoading || 
                    traffic.isLoading || 
                    weather.isLoading || 
                    monsoon.isLoading || 
                    pois.isLoading || 
                    boundaryHook.loading;

  const lastSync = roads.lastSync || traffic.lastSync || weather.lastSync || monsoon.lastSync || pois.lastSync;

  const refresh = useCallback(() => {
    roads.refresh();
    traffic.refresh();
    weather.refresh();
    monsoon.refresh();
    pois.refresh();
  }, [roads, traffic, weather, monsoon, pois]);

  return {
    boundary: boundaryHook.boundary,
    incidents,
    isLoading,
    lastSync,
    refresh,
    // Expose individual hooks if needed elsewhere
    roads: roads.data,
    traffic: traffic.data,
    weather: weather.data,
    monsoon: monsoon.data,
    pois: pois.data,
  };
}