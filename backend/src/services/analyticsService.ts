// backend/src/services/analyticsService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { getCachedRoads } from "./roadService.js";
import { getCachedMonsoonRisk } from "./monsoonService.js";
import { getWeather } from "./weatherService.js";

// ────────────────────────────────
// Historical Data & Analytics Service
// ────────────────────────────────

interface HistoricalSnapshot {
  timestamp: string;
  totalRoads: number;
  blockedCount: number;
  oneLaneCount: number;
  resumedCount: number;
  monsoonRiskCount: number;
  weatherConditions: string;
  temperature: number;
  incidentsCount: number;
}

interface DailyAnalytics {
  date: string;
  avgBlockedCount: number;
  avgOneLaneCount: number;
  peakBlockHour: number;
  totalIncidents: number;
  weatherSummary: {
    avgTemp: number;
    maxRainfall: number;
    rainyDays: number;
  };
  mostAffectedDistricts: Array<{ district: string; incidentCount: number }>;
  mostAffectedHighways: Array<{ highway: string; incidentCount: number }>;
}

interface TrendAnalysis {
  period: "7d" | "30d" | "90d";
  roadConditionTrend: "improving" | "stable" | "declining";
  incidentTrend: "increasing" | "stable" | "decreasing";
  weatherImpact: "low" | "medium" | "high";
  recommendations: string[];
  predictions: {
    nextWeekBlockedEstimate: number;
    riskLevel: "low" | "medium" | "high";
  };
}

// In-memory store for analytics
const snapshots: HistoricalSnapshot[] = [];
const dailyAnalyticsCache: Map<string, DailyAnalytics> = new Map();
const ANALYTICS_DIR = path.join(DATA_DIR, "analytics");
const SNAPSHOTS_FILE = path.join(ANALYTICS_DIR, "snapshots.json");

/**
 * Initialize analytics service
 */
export async function initializeAnalytics(): Promise<void> {
  try {
    await fs.mkdir(ANALYTICS_DIR, { recursive: true });

    // Load existing snapshots
    try {
      const data = await fs.readFile(SNAPSHOTS_FILE, "utf-8");
      const parsed = JSON.parse(data) as HistoricalSnapshot[];
      snapshots.push(...parsed);
    } catch {
      // No existing snapshots
    }

    logInfo("[Analytics] Initialized", { snapshots: snapshots.length });
  } catch (err: any) {
    logError("[Analytics] Failed to initialize", err.message);
  }
}

/**
 * Capture a snapshot of current state
 */
export async function captureSnapshot(): Promise<HistoricalSnapshot | null> {
  try {
    const roadData = await getCachedRoads();
    const monsoonRisk = await getCachedMonsoonRisk();

    const blockedCount = roadData.merged.filter((r: any) => r.status === "Blocked").length;
    const oneLaneCount = roadData.merged.filter((r: any) => r.status === "One-Lane").length;
    const resumedCount = roadData.merged.filter((r: any) => r.status === "Resumed").length;

    const weather = await getWeather();

    const snapshot: HistoricalSnapshot = {
      timestamp: new Date().toISOString(),
      totalRoads: roadData.merged.length,
      blockedCount,
      oneLaneCount,
      resumedCount,
      monsoonRiskCount: monsoonRisk.length,
      weatherConditions: weather?.condition || "unknown",
      temperature: weather?.temp || 0,
      incidentsCount: blockedCount + oneLaneCount,
    };

    snapshots.push(snapshot);

    // Keep only last 90 days of snapshots (every 6 hours)
    const maxSnapshots = 90 * 4; // 4 snapshots per day
    if (snapshots.length > maxSnapshots) {
      snapshots.splice(0, snapshots.length - maxSnapshots);
    }

    // Save to disk
    await fs.writeFile(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));

    return snapshot;
  } catch (err: any) {
    logError("[Analytics] Failed to capture snapshot", err.message);
    return null;
  }
}

/**
 * Get analytics for a specific date
 */
export async function getDailyAnalytics(date: string): Promise<DailyAnalytics | null> {
  if (dailyAnalyticsCache.has(date)) {
    return dailyAnalyticsCache.get(date)!;
  }

  // Generate analytics from snapshots
  const daySnapshots = snapshots.filter((s) => s.timestamp.startsWith(date));

  if (daySnapshots.length === 0) {
    return null;
  }

  const avgBlockedCount = daySnapshots.reduce((sum, s) => sum + s.blockedCount, 0) / daySnapshots.length;
  const avgOneLaneCount = daySnapshots.reduce((sum, s) => sum + s.oneLaneCount, 0) / daySnapshots.length;

  // Find peak block hour (approximate)
  const hourCounts = new Array(24).fill(0);
  for (const snapshot of daySnapshots) {
    const hour = new Date(snapshot.timestamp).getHours();
    hourCounts[hour] += snapshot.blockedCount;
  }
  const peakBlockHour = hourCounts.indexOf(Math.max(...hourCounts));

  const analytics: DailyAnalytics = {
    date,
    avgBlockedCount: Math.round(avgBlockedCount * 10) / 10,
    avgOneLaneCount: Math.round(avgOneLaneCount * 10) / 10,
    peakBlockHour,
    totalIncidents: daySnapshots.reduce((sum, s) => sum + s.incidentsCount, 0),
    weatherSummary: {
      avgTemp: daySnapshots.reduce((sum, s) => sum + s.temperature, 0) / daySnapshots.length,
      maxRainfall: 0, // Would need hourly weather data
      rainyDays: daySnapshots.filter((s) => s.weatherConditions.includes("rain")).length,
    },
    mostAffectedDistricts: [], // Would need incident location data
    mostAffectedHighways: [], // Would need incident highway data
  };

  dailyAnalyticsCache.set(date, analytics);
  return analytics;
}

/**
 * Get trend analysis for a period
 */
export async function getTrendAnalysis(period: "7d" | "30d" | "90d"): Promise<TrendAnalysis | null> {
  const now = new Date();
  const daysAgo = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  const periodSnapshots = snapshots.filter((s) => new Date(s.timestamp) >= startDate);

  if (periodSnapshots.length < 2) {
    return null;
  }

  // Split into first half and second half for trend
  const mid = Math.floor(periodSnapshots.length / 2);
  const firstHalf = periodSnapshots.slice(0, mid);
  const secondHalf = periodSnapshots.slice(mid);

  const firstAvgBlocked = firstHalf.reduce((sum, s) => sum + s.blockedCount, 0) / firstHalf.length;
  const secondAvgBlocked = secondHalf.reduce((sum, s) => sum + s.blockedCount, 0) / secondHalf.length;

  // Determine trend
  let roadConditionTrend: "improving" | "stable" | "declining";
  const blockedChange = secondAvgBlocked - firstAvgBlocked;
  if (blockedChange < -2) roadConditionTrend = "improving";
  else if (blockedChange > 2) roadConditionTrend = "declining";
  else roadConditionTrend = "stable";

  // Incident trend
  const firstAvgIncidents = firstHalf.reduce((sum, s) => sum + s.incidentsCount, 0) / firstHalf.length;
  const secondAvgIncidents = secondHalf.reduce((sum, s) => sum + s.incidentsCount, 0) / secondHalf.length;

  let incidentTrend: "increasing" | "stable" | "decreasing";
  const incidentChange = secondAvgIncidents - firstAvgIncidents;
  if (incidentChange < -3) incidentTrend = "decreasing";
  else if (incidentChange > 3) incidentTrend = "increasing";
  else incidentTrend = "stable";

  // Weather impact
  const rainySnapshots = periodSnapshots.filter((s) =>
    s.weatherConditions.toLowerCase().includes("rain")
  );
  const rainyBlockRate =
    rainySnapshots.length > 0
      ? rainySnapshots.reduce((sum, s) => sum + s.blockedCount, 0) / rainySnapshots.length
      : 0;
  const clearBlockRate =
    periodSnapshots.length - rainySnapshots.length > 0
      ? periodSnapshots
        .filter((s) => !s.weatherConditions.toLowerCase().includes("rain"))
        .reduce((sum, s) => sum + s.blockedCount, 0) /
      (periodSnapshots.length - rainySnapshots.length)
      : 0;

  let weatherImpact: "low" | "medium" | "high";
  const weatherImpactRatio = clearBlockRate > 0 ? rainyBlockRate / clearBlockRate : 1;
  if (weatherImpactRatio > 2) weatherImpact = "high";
  else if (weatherImpactRatio > 1.3) weatherImpact = "medium";
  else weatherImpact = "low";

  // Predictions
  const nextWeekEstimate = Math.round(secondAvgBlocked * (incidentTrend === "increasing" ? 1.2 : incidentTrend === "decreasing" ? 0.8 : 1));

  // Risk level
  let riskLevel: "low" | "medium" | "high";
  const currentMonth = new Date().getMonth();
  if (currentMonth >= 5 && currentMonth <= 8) {
    riskLevel = secondAvgBlocked > 15 ? "high" : secondAvgBlocked > 8 ? "medium" : "low";
  } else {
    riskLevel = secondAvgBlocked > 10 ? "high" : secondAvgBlocked > 5 ? "medium" : "low";
  }

  // Recommendations
  const recommendations: string[] = [];
  if (roadConditionTrend === "declining") {
    recommendations.push("Road conditions are worsening - monitor closely");
  }
  if (weatherImpact === "high") {
    recommendations.push("Weather has significant impact - check forecasts before travel");
  }
  if (incidentTrend === "increasing") {
    recommendations.push("Incident rate increasing - consider alternative routes");
  }
  if (riskLevel === "high") {
    recommendations.push("High risk period - exercise extra caution");
  }
  if (recommendations.length === 0) {
    recommendations.push("Conditions are stable - normal travel precautions apply");
  }

  return {
    period,
    roadConditionTrend,
    incidentTrend,
    weatherImpact,
    recommendations,
    predictions: {
      nextWeekBlockedEstimate: nextWeekEstimate,
      riskLevel,
    },
  };
}

/**
 * Get most affected districts
 */
export async function getMostAffectedDistricts(limit: number = 10): Promise<
  Array<{ district: string; blockedCount: number; oneLaneCount: number; totalIncidents: number }>
> {
  const roadData = await getCachedRoads();
  const districtStats: Record<string, { blocked: number; oneLane: number; total: number }> = {};

  for (const road of roadData.merged) {
    if (road.status === "Resumed") continue;

    const district = String(road.properties?.dist_name || road.properties?.incidentDistrict || "Unknown");
    if (!district || district === "Unknown") continue;

    if (!districtStats[district]) {
      districtStats[district] = { blocked: 0, oneLane: 0, total: 0 };
    }

    if (road.status === "Blocked") districtStats[district].blocked++;
    else if (road.status === "One-Lane") districtStats[district].oneLane++;
    districtStats[district].total++;
  }

  return Object.entries(districtStats)
    .map(([district, stats]) => ({
      district,
      blockedCount: stats.blocked,
      oneLaneCount: stats.oneLane,
      totalIncidents: stats.total,
    }))
    .sort((a, b) => b.totalIncidents - a.totalIncidents)
    .slice(0, limit);
}

/**
 * Get most affected highways
 */
export async function getMostAffectedHighways(limit: number = 10): Promise<
  Array<{ highway: string; blockedCount: number; oneLaneCount: number; totalIncidents: number }>
> {
  const roadData = await getCachedRoads();
  const highwayStats: Record<string, { blocked: number; oneLane: number; total: number }> = {};

  for (const road of roadData.merged) {
    if (road.status === "Resumed") continue;

    const highway = road.properties?.road_refno || "Unknown";
    if (!highway) continue;

    if (!highwayStats[highway]) {
      highwayStats[highway] = { blocked: 0, oneLane: 0, total: 0 };
    }

    if (road.status === "Blocked") highwayStats[highway].blocked++;
    else if (road.status === "One-Lane") highwayStats[highway].oneLane++;
    highwayStats[highway].total++;
  }

  return Object.entries(highwayStats)
    .map(([highway, stats]) => ({
      highway,
      blockedCount: stats.blocked,
      oneLaneCount: stats.oneLane,
      totalIncidents: stats.total,
    }))
    .sort((a, b) => b.totalIncidents - a.totalIncidents)
    .slice(0, limit);
}

/**
 * Get analytics summary for dashboard
 */
export async function getAnalyticsSummary(
  period: "7d" | "30d" | "90d" = "7d"
): Promise<{
  current: {
    totalRoads: number;
    blockedCount: number;
    oneLaneCount: number;
    clearCount: number;
  };
  trend: TrendAnalysis | null;
  topDistricts: Array<{ district: string; totalIncidents: number }>;
  topHighways: Array<{ highway: string; totalIncidents: number }>;
  lastUpdated: string;
}> {
  const roadData = await getCachedRoads();

  const blockedCount = roadData.merged.filter((r: any) => r.status === "Blocked").length;
  const oneLaneCount = roadData.merged.filter((r: any) => r.status === "One-Lane").length;
  const clearCount = roadData.merged.length - blockedCount - oneLaneCount;

  const [trend, topDistricts, topHighways] = await Promise.all([
    getTrendAnalysis(period),
    getMostAffectedDistricts(5),
    getMostAffectedHighways(5),
  ]);

  return {
    current: {
      totalRoads: roadData.merged.length,
      blockedCount,
      oneLaneCount,
      clearCount,
    },
    trend,
    topDistricts: topDistricts.map((d) => ({ district: d.district, totalIncidents: d.totalIncidents })),
    topHighways: topHighways.map((h) => ({ highway: h.highway, totalIncidents: h.totalIncidents })),
    lastUpdated: new Date().toISOString(),
  };
}
