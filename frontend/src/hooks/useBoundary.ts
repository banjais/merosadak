// frontend/src/hooks/useBoundary.ts
import { useEffect, useState } from "react";
import { GeoData } from "../services/apiService";
import { APP_CONFIG } from "../config/config";

/**
 * Custom Hook to fetch Nepal boundary from static file.
 */
export function useBoundary() {
  const [boundary, setBoundary] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBoundary = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try to load from static file first (for Firebase hosting)
        const staticResponse = await fetch('/boundary/boundary.geojson');
        if (staticResponse.ok) {
          const data = await staticResponse.json();
          if (!cancelled) {
            setBoundary(data as GeoData);
          }
        } else {
          // Fallback to API
          const apiResponse = await fetch(`${APP_CONFIG.apiBaseUrl}/api/boundary`);
          if (apiResponse.ok) {
            const result = await apiResponse.json();
            if (!cancelled && result.success && result.data) {
              setBoundary(result.data as GeoData);
            }
          } else {
            if (!cancelled) {
              setError("Failed to load boundary file");
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[useBoundary] Error:", err.message);
          setError(err.message || "Failed to fetch boundary");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBoundary();

    return () => {
      cancelled = true;
    };
  }, []);

  return { boundary, loading, error };
}
