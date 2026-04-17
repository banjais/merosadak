import path from "path";
import fs from "fs/promises";
import { CACHE_DIR } from "../config/paths.js";
import { logError } from "../logs/logs.js";
import { getCachedRoads } from "./roadService.js";

const ANALYTICS_FILE = path.join(CACHE_DIR, "analytics.json");
let analyticsQueue: Promise<void> = Promise.resolve();

export async function recordAnalytics(event: string, meta?: any) {
  analyticsQueue = analyticsQueue.then(async () => {
    try {
      const raw = await fs.readFile(ANALYTICS_FILE, "utf-8").catch(() => "{}");
      const data = JSON.parse(raw);

      if (meta) {
        logError(`[analyticsService] Event: ${event}`, { meta });
      }

      data[event] = (data[event] || 0) + 1;
      data[`last_${event}`] = new Date().toISOString();

      const tempFile = `${ANALYTICS_FILE}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
      await fs.rename(tempFile, ANALYTICS_FILE);
    } catch (err: any) {
      logError("[analyticsService] recordAnalytics failed", { error: err.message });
    }
  }).catch(() => { });
  return analyticsQueue;
}

/**
 * Retrieves a summary of key analytics data.
 */
export async function getAnalyticsSummary(period: string = "7d") {
  const data = await getAnalyticsData();
  const roadData = await getCachedRoads();

  let totalEvents = 0;
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'number' && !key.startsWith('last_')) {
      totalEvents += value;
    }
  });

  const activeIncidents = roadData.merged.filter(r =>
    r.status === "Blocked" || r.status === "One-Lane"
  ).length;

  return {
    totalEvents,
    uniqueUsers: data['user_login'] || 0,
    incidentsReported: data['report_incident'] || 0,
    activeIncidents,
    activeSessions: data['app_open'] || 0,
    lastUpdated: data['last_updated'] || new Date().toISOString(),
    period
  };
}

/**
 * Performs a trend analysis over a specified period.
 */
export async function getTrendAnalysis(period: string) {
  const data = await getAnalyticsData();
  // Simplified trend: returning growth based on total vs unique
  return [
    { name: 'Traffic', value: data['map_view'] || 0 },
    { name: 'Reports', value: data['report_incident'] || 0 },
    { name: 'AI Queries', value: data['gemini_query'] || 0 }
  ];
}

/**
 * Identifies the most affected districts based on incident data.
 */
export async function getMostAffectedDistricts(limit: number = 5) {
  const { merged } = await getCachedRoads();
  const counts: Record<string, number> = {};

  merged.forEach(road => {
    if (road.status === "Blocked" || road.status === "One-Lane") {
      const dist = road.incidentDistrict?.en || road.dist_name || "Unknown";
      counts[dist] = (counts[dist] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getMostAffectedHighways(limit: number = 5) {
  const { merged } = await getCachedRoads();
  const counts: Record<string, number> = {};

  merged.forEach(road => {
    if (road.status === "Blocked" || road.status === "One-Lane") {
      const ref = road.road_refno || "Other";
      counts[ref] = (counts[ref] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Captures a current snapshot of analytics data.
 * Used by scheduler tasks for trend analysis and health reporting.
 */
export async function captureSnapshot() {
  const data = await getAnalyticsData();
  return { timestamp: new Date().toISOString(), data };
}

/**
 * Retrieves daily analytics data for a specific date.
 * Placeholder implementation.
 */
export async function getDailyAnalytics(dateStr: string) {
  return {};
}

export async function getAnalyticsData() {
  const raw = await fs.readFile(ANALYTICS_FILE, "utf-8").catch(() => "{}");
  return JSON.parse(raw);
}