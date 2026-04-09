// frontend/src/hooks/useRoutePlanning.ts
import { useState, useCallback } from "react";
import { routePlanningService, type RoutePlan, type RouteSafety } from "../services/routePlanningService";
import type { Location } from "../services/etaService";

export function useRoutePlanning() {
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planRoute = useCallback(
    async (
      origin: Location,
      destination: Location,
      options?: {
        avoidBlocked?: boolean;
        prioritizeSafety?: boolean;
        maxDeviationKm?: number;
      }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await routePlanningService.plan(origin, destination, options);
        setPlan(result);
        return result;
      } catch (err: any) {
        setError(err.message || "Failed to plan route");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const compareRoutes = useCallback(
    async (origin: Location, destination: Location, route1Name: string, route2Name: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await routePlanningService.compare(origin, destination, route1Name, route2Name);
        return result;
      } catch (err: any) {
        setError(err.message || "Failed to compare routes");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getSafety = useCallback(
    async (origin: Location, destination: Location) => {
      setLoading(true);
      setError(null);
      try {
        const result = await routePlanningService.getSafety(origin, destination);
        return result;
      } catch (err: any) {
        setError(err.message || "Failed to get route safety");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { plan, loading, error, planRoute, compareRoutes, getSafety };
}
