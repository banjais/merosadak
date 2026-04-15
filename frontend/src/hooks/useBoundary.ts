// src/hooks/useBoundary.ts
import { useState, useEffect } from 'react';
import { api } from '../services/apiService';
import type { GeoData } from '../services/apiService';

export interface BoundaryData {
  nepal: GeoData | null;
}

export function useBoundary() {
  const [boundaries, setBoundaries] = useState<BoundaryData>({
    nepal: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoundaries = async () => {
    try {
      setLoading(true);
      setError(null);

      let nepalData = await api.getNepalBoundary().catch(() => null);

      // Fallback to static boundary.geojson in public folder
      if (!nepalData) {
        console.log("[useBoundary] API failed, falling back to static /boundary.geojson");
        const res = await fetch("/boundary.geojson");
        if (res.ok) {
          nepalData = await res.json();
        } else {
          throw new Error("Failed to load static boundary fallback");
        }
      }

      setBoundaries({
        nepal: nepalData,
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