import { useMemo, useCallback } from 'react';
import { useRoads } from './useRoads';
import { useTraffic } from './useTraffic';
import { useWeather } from './useWeather';
import { useMonsoon } from './useMonsoon';
import { usePOIs } from './usePOIs';
import nepalBoundaryData from '../data/nepalBoundary.json';

export type DataSource = 'live' | 'cache' | 'mock';

export function useNepalData() {
  const roads = useRoads();
  const traffic = useTraffic();
  const weather = useWeather();
  const monsoon = useMonsoon();
  const pois = usePOIs();

  const incidents = useMemo(() => {
    return [
      ...roads.data, 
      ...traffic.data, 
      ...weather.data, 
      ...monsoon.data, 
      ...pois.data
    ].sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0));
  }, [roads.data, traffic.data, weather.data, monsoon.data, pois.data]);

  const isLoading = roads.isLoading || traffic.isLoading || weather.isLoading || monsoon.isLoading || pois.isLoading;

  const dataSource = useMemo(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'cache';
    const anyMock = incidents.some(i => String(i.id).includes('mock'));
    return anyMock ? 'mock' : 'live';
  }, [incidents]);

  const lastSync = roads.lastSync;

  const refreshAll = useCallback(() => {
    roads.refresh();
    traffic.refresh();
    weather.refresh();
    monsoon.refresh();
    pois.refresh();
  }, [roads, traffic, weather, monsoon, pois]);

  return { 
    boundary: nepalBoundaryData, 
    incidents, 
    isLoading, 
    isDemoMode: dataSource === 'mock', 
    dataSource: dataSource as DataSource, 
    lastSync, 
    refresh: refreshAll 
  };
}
