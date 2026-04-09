// frontend/src/services/analyticsService.ts
import { apiFetch } from "../api";

export interface AnalyticsSummary {
  current: {
    totalRoads: number;
    blockedCount: number;
    oneLaneCount: number;
    clearCount: number;
  };
  trend: {
    period: string;
    roadConditionTrend: "improving" | "stable" | "declining";
    incidentTrend: "increasing" | "stable" | "decreasing";
    weatherImpact: "low" | "medium" | "high";
    recommendations: string[];
    predictions: {
      nextWeekBlockedEstimate: number;
      riskLevel: "low" | "medium" | "high";
    };
  } | null;
  topDistricts: Array<{ district: string; totalIncidents: number }>;
  topHighways: Array<{ highway: string; totalIncidents: number }>;
  lastUpdated: string;
}

export interface TrendData {
  period: string;
  roadConditionTrend: "improving" | "stable" | "declining";
  incidentTrend: "increasing" | "stable" | "decreasing";
  weatherImpact: "low" | "medium" | "high";
  recommendations: string[];
  predictions: {
    nextWeekBlockedEstimate: number;
    riskLevel: "low" | "medium" | "high";
  };
}

export const analyticsService = {
  getSummary: async (period: "7d" | "30d" | "90d" = "7d"): Promise<AnalyticsSummary | null> => {
    try {
      const result = await apiFetch<any>(`/analytics/summary?period=${period}`);
      return result.data || null;
    } catch (err) {
      console.error("Failed to fetch analytics summary:", err);
      return null;
    }
  },

  getTrends: async (period: "7d" | "30d" | "90d" = "7d"): Promise<TrendData | null> => {
    try {
      const result = await apiFetch<any>(`/analytics/trends?period=${period}`);
      return result.data || null;
    } catch (err) {
      console.error("Failed to fetch trends:", err);
      return null;
    }
  },

  getTopDistricts: async (limit: number = 10): Promise<Array<{ district: string; blockedCount: number; oneLaneCount: number; totalIncidents: number }>> => {
    try {
      const result = await apiFetch<any>(`/analytics/districts?limit=${limit}`);
      return result.data || [];
    } catch (err) {
      console.error("Failed to fetch top districts:", err);
      return [];
    }
  },

  getTopHighways: async (limit: number = 10): Promise<Array<{ highway: string; blockedCount: number; oneLaneCount: number; totalIncidents: number }>> => {
    try {
      const result = await apiFetch<any>(`/analytics/highways?limit=${limit}`);
      return result.data || [];
    } catch (err) {
      console.error("Failed to fetch top highways:", err);
      return [];
    }
  }
};
