// frontend/src/hooks/useAnalytics.ts
import { useState, useEffect, useCallback } from "react";
import { analyticsService, type AnalyticsSummary, type TrendData } from "../services/analyticsService";

export function useAnalytics(period: "7d" | "30d" | "90d" = "7d") {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [topDistricts, setTopDistricts] = useState<any[]>([]);
  const [topHighways, setTopHighways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryData, trendsData, districtsData, highwaysData] = await Promise.all([
        analyticsService.getSummary(period),
        analyticsService.getTrends(period),
        analyticsService.getTopDistricts(5),
        analyticsService.getTopHighways(5),
      ]);

      setSummary(summaryData);
      setTrends(trendsData);
      setTopDistricts(districtsData);
      setTopHighways(highwaysData);
    } catch (err: any) {
      setError(err.message || "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    summary,
    trends,
    topDistricts,
    topHighways,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}
