// frontend/src/services/routePlanningService.ts
import { apiFetch } from "../api";
import type { Location } from "./etaService";

export interface RouteOption {
  id: string;
  name: string;
  description: string;
  waypoints: Location[];
  highways: string[];
  estimatedDistance: number;
  estimatedDuration: number;
  riskScore: number;
  conditionScore: number;
  isRecommended: boolean;
  status: "optimal" | "alternative" | "avoid";
  warnings: string[];
  highlights: string[];
}

export interface RoutePlan {
  origin: Location;
  destination: Location;
  routes: RouteOption[];
  recommendedRouteId: string;
  calculatedAt: string;
}

export interface RouteSafety {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  safetyTips: string[];
  emergencyContacts: Array<{ name: string; phone: string; type: string }>;
}

export const routePlanningService = {
  plan: async (
    origin: Location,
    destination: Location,
    options?: {
      avoidBlocked?: boolean;
      prioritizeSafety?: boolean;
      maxDeviationKm?: number;
    }
  ): Promise<RoutePlan | null> => {
    try {
      const result = await apiFetch<any>("/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, options }),
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to plan route:", err);
      return null;
    }
  },

  compare: async (
    origin: Location,
    destination: Location,
    route1Name: string = "Route 1",
    route2Name: string = "Route 2"
  ): Promise<any | null> => {
    try {
      const result = await apiFetch<any>("/routes/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, route1Name, route2Name }),
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to compare routes:", err);
      return null;
    }
  },

  getSafety: async (
    origin: Location,
    destination: Location
  ): Promise<RouteSafety | null> => {
    try {
      const result = await apiFetch<any>("/routes/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination }),
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to get route safety:", err);
      return null;
    }
  }
};
