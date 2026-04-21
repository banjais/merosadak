import path from "path";
import fs from "fs/promises";
import { CACHE_DIR } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { getCachedRoads } from "./roadService.js";
import { resolveLabel } from "@/services/labelUtils.js";

const ANALYTICS_FILE = path.join(CACHE_DIR, "analytics.json");
let analyticsQueue: Promise<void> = Promise.resolve();

/**
 * Initializes the analytics store.
 */
export async function initializeAnalytics(): Promise<void> {
  try {
    await fs.access(ANALYTICS_FILE);
    logInfo("[analyticsService] Analytics store initialized.");
  } catch {
    await fs.writeFile(ANALYTICS_FILE, "{}", "utf-8");
    logInfo("[analyticsService] Created new analytics store.");
  }
}

export async function recordAnalytics(event: string, meta?: any) {
  analyticsQueue = analyticsQueue.then(async () => {
    try {
      const raw = await fs.readFile(ANALYTICS_FILE, "utf-8").catch(() => "{}");
      const data = JSON.parse(raw);

      // Logic for Green Badge Leaderboard: Increment user eco-scores
      if (event === 'eco_trip_completed' && meta?.userId) {
        if (!data.green_leaderboard) data.green_leaderboard = {};
        const userId = meta.userId;
        const current = data.green_leaderboard[userId] || { score: 0, name: meta.userName || 'Traveler' };

        data.green_leaderboard[userId] = {
          score: current.score + (meta.km || 0),
          name: meta.userName || current.name,
          lastUpdated: new Date().toISOString()
        };
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
  const searchStats: Record<string, number> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'number' && !key.startsWith('last_')) {
      totalEvents += value;
      if (key.startsWith('search_category_')) {
        const category = key.replace('search_category_', '');
        searchStats[category] = value;
      }
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
    searchStats,
    lastUpdated: data['last_updated'] || new Date().toISOString(),
    period
  };
}

/**
 * Retrieves the top contributors for the Green Badge leaderboard.
 */
export async function getGreenLeaderboard(limit: number = 10) {
  const data = await getAnalyticsData();
  const board = data.green_leaderboard || {};

  return Object.entries(board)
    .map(([id, val]: [string, any]) => {
      // Conversion: 1 Tree per ~2600 KM (based on 0.08L/km car efficiency and 22kg CO2/tree/year)
      const trees = (val.score || 0) * 0.0084;
      return { id, ...val, trees: Math.round(trees * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Retrieves the most frequent search queries recorded in analytics.
 */
export async function getFrequentQueries(limit: number = 5): Promise<string[]> {
  const data = await getAnalyticsData();
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

  return Object.entries(data)
    .filter(([key]) => {
      if (!key.startsWith('search_query_')) return false;
      const lastSeen = data[`last_${key}`];
      return lastSeen && new Date(lastSeen).getTime() > cutoff;
    })
    .map(([key, count]) => ({
      query: key.replace('search_query_', ''),
      count: count as number
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => item.query);
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
      const props = road.properties || {};
      const dist = resolveLabel(props.incidentDistrict) || resolveLabel(props.dist_name) || "Unknown";
      counts[dist] = (counts[dist] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Identifies the most affected specific places based on incident data.
 */
export async function getMostAffectedPlaces(limit: number = 5) {
  const { merged } = await getCachedRoads();
  const counts: Record<string, number> = {};

  merged.forEach(road => {
    if (road.status === "Blocked" || road.status === "One-Lane") {
      const props = road.properties || {};
      const place = resolveLabel(props.incidentPlace) || "Unknown";
      counts[place] = (counts[place] || 0) + 1;
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
      const ref = road.properties?.road_refno || road.properties?.highway_code || "Other";
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