import { useMemo, useCallback } from 'react';
import { useRoads } from './useRoads';
import { useTraffic } from './useTraffic';
import { useWeather } from './useWeather';
import { useMonsoon } from './useMonsoon';
import { usePOIs } from './usePOIs';
import { useBoundary } from './useBoundary';
import { TravelIncident } from '../types';

export type DataSource = 'live' | 'cache' | 'mock';

export function useNepalData() {
  // Core hooks
  const roads = useRoads();
  const traffic = useTraffic();
  const weather = useWeather();
  const monsoon = useMonsoon();
  const pois = usePOIs();
  const boundaryHook = useBoundary();

  // Combine incidents from all sources (ensure arrays are never undefined)
  const incidents: TravelIncident[] = useMemo(() => {
    const allIncidents = [
      ...(roads.data || []),
      ...(traffic.data || []),
      ...(weather.data || []),
      ...(monsoon.data || []),
      ...(pois.data || [])
    ];
    return allIncidents.sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0));
  }, [roads.data, traffic.data, weather.data, monsoon.data, pois.data]);

  // Loading state
  const isLoading = roads.isLoading || traffic.isLoading || weather.isLoading || monsoon.isLoading || pois.isLoading || boundaryHook.loading;

  // Determine data source
  const dataSource: DataSource = useMemo(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'cache';
    const anyMock = incidents.some(i => String(i.id).includes('mock'));
    return anyMock ? 'mock' : 'live';
  }, [incidents]);

  // Last sync time (from roads as primary)
  const lastSync = roads.lastSync;

  // Refresh all data
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
    isDemoMode: dataSource === 'mock',
    dataSource,
    lastSync,
    refresh
  };
}
