// src/hooks/useBoundary.ts
import { useState, useEffect } from 'react';
import { api } from '../services/apiService';
import type { GeoData } from '../services/apiService';

export interface BoundaryData {
  districts: GeoData | null;
  provinces: GeoData | null;
  local: GeoData | null;
  country: GeoData | null;
}

export function useBoundary() {
  const [boundaries, setBoundaries] = useState<BoundaryData>({
    districts: null,
    provinces: null,
    local: null,
    country: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoundaries = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all boundary types in parallel
      const [districtsData, provincesData, localData, countryData] = await Promise.all([
        api.getBoundaryDistricts().catch(() => null),
        api.getBoundaryProvinces().catch(() => null),
        api.getBoundaryLocal().catch(() => null),
        api.getBoundaryCountry().catch(() => null),
      ]);

      setBoundaries({
        districts: districtsData,
        provinces: provincesData,
        local: localData,
        country: countryData,
      });

    } catch (err: any) {
      console.error("[useBoundary] Error loading boundaries:", err);
      setError(err.message || "Failed to load boundary data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoundaries();
  }, []);

  return {
    boundaries,
    loading,
    error,
    reload: loadBoundaries,
  };
}