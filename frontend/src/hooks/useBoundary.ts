// frontend/src/hooks/useBoundary.ts
import { useEffect, useState } from "react";
import { GeoData } from "../services/apiService";

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
        const response = await fetch('/boundary/boundary.geojson');
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data) {
            setBoundary(data as GeoData);
          }
        } else {
          if (!cancelled) {
            setError("Failed to load boundary file");
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
