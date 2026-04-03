// frontend/src/hooks/useBoundary.ts
import { useEffect, useState } from "react";
import { api } from "../services/apiService";
import { GeoData } from "../services/apiService";

/**
 * Custom Hook to fetch Nepal boundary from backend.
 * boundary can be null if the API call fails — NepalBounds component
 * has a hardcoded fallback so the mask always renders regardless.
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
        const data = await api.getBoundary();
        if (!cancelled && data) {
          setBoundary(data as GeoData);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to fetch boundary");
          console.error("[useBoundary] API error:", err.message);
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
