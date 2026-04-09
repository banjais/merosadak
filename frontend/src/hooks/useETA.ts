// frontend/src/hooks/useETA.ts
import { useState, useCallback } from "react";
import { etaService, type Location, type ETAResult, type QuickETA } from "../services/etaService";

export function useETA() {
  const [eta, setEta] = useState<ETAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(
    async (
      origin: Location,
      destination: Location,
      options?: {
        avoidBlocked?: boolean;
        prioritizeSafety?: boolean;
        vehicleType?: "car" | "motorcycle" | "truck" | "bus";
      }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await etaService.calculate(origin, destination, options);
        setEta(result);
        return result;
      } catch (err: any) {
        setError(err.message || "Failed to calculate ETA");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { eta, loading, error, calculate };
}

export function useQuickETA() {
  const [eta, setEta] = useState<QuickETA | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async (origin: Location, destination: Location) => {
    setLoading(true);
    setError(null);
    try {
      const result = await etaService.quick(origin, destination);
      setEta(result);
      return result;
    } catch (err: any) {
      setError(err.message || "Failed to calculate quick ETA");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { eta, loading, error, calculate };
}
