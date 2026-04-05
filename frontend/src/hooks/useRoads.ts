// src/hooks/useRoads.ts
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';
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

      const result = await apiFetch<any>("/roads/all");

      // Handle different possible response shapes
      let roadData: any[] = [];
      
      if (result?.merged && Array.isArray(result.merged)) {
        roadData = result.merged;
      } else if (Array.isArray(result)) {
        roadData = result;
      } else if (result?.data && Array.isArray(result.data)) {
        roadData = result.data;
      }

      // Convert to TravelIncident format if needed
      const formattedData: TravelIncident[] = roadData.map((road: any) => ({
        id: road.id || `road-${Math.random().toString(36).substr(2, 9)}`,
        type: 'road',
        title: road.properties?.road_name || road.name || 'Unknown Road',
        description: road.properties?.remarks || road.status || 'Road segment',
        lat: road.geometry?.coordinates?.[0]?.[1] || 28.3949,
        lng: road.geometry?.coordinates?.[0]?.[0] || 84.1240,
        severity: road.status?.toLowerCase().includes('block') ? 'high' : 
                  road.status?.toLowerCase().includes('one') ? 'medium' : 'low',
        timestamp: road.properties?.reportDate || new Date().toISOString(),
        status: road.status || road.properties?.status,
        road_refno: road.properties?.road_refno,
        incidentDistrict: road.properties?.incidentDistrict,
        incidentPlace: road.properties?.incidentPlace,
        chainage: road.properties?.chainage,
        incidentStarted: road.properties?.incidentStarted,
        estimatedRestoration: road.properties?.estimatedRestoration,
        resumedDate: road.properties?.resumedDate,
        blockedHours: road.properties?.blockedHours,
        contactPerson: road.properties?.contactPerson,
        restorationEfforts: road.properties?.restorationEfforts,
        remarks: road.properties?.remarks,
      }));

      setData(formattedData);
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