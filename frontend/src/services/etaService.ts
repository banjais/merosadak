// frontend/src/services/etaService.ts
import { apiFetch } from "../api";

export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

export interface ETASegment {
  distance: number;
  duration: number;
  roadName: string;
  roadCode: string;
  status: "blocked" | "one-lane" | "clear" | "unknown";
  speed: number;
  baseSpeed: number;
  delayMinutes: number;
}

export interface ETAResult {
  origin: Location;
  destination: Location;
  totalDistance: number;
  totalDuration: number;
  segments: ETASegment[];
  conditionAdjusted: boolean;
  reliability: "high" | "medium" | "low";
  alternativeAvailable: boolean;
  warnings: string[];
  calculatedAt: string;
}

export interface QuickETA {
  distance: number;
  duration: number;
  delayFromConditions: number;
}

export const etaService = {
  calculate: async (
    origin: Location,
    destination: Location,
    options?: {
      avoidBlocked?: boolean;
      prioritizeSafety?: boolean;
      vehicleType?: "car" | "motorcycle" | "truck" | "bus";
    }
  ): Promise<ETAResult | null> => {
    try {
      const result = await apiFetch<any>("/eta/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, options }),
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to calculate ETA:", err);
      return null;
    }
  },

  quick: async (
    origin: Location,
    destination: Location
  ): Promise<QuickETA | null> => {
    try {
      const result = await apiFetch<any>("/eta/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination }),
      });
      return result.data || null;
    } catch (err) {
      console.error("Failed to calculate quick ETA:", err);
      return null;
    }
  }
};
