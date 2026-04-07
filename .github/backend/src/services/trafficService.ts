// backend/src/services/trafficService.ts
import fs from "fs/promises";
import axios from "axios";
import { CACHE_TRAFFIC } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js"; 
import { withCache } from "./cacheService.js";
import { TOMTOM_API_URL, TOMTOM_API_KEY, OVERPASS_API_URL, WAZE_JSON } from "../config/index.js";

export interface TrafficResult {
  id: string;
  location: { lat: number; lng: number };
  description: string;
  severity: "low" | "medium" | "high";
  source: "waze" | "tomtom" | "overpass";
}

const TRAFFIC_CACHE_TTL = 5 * 60; // 5 min
let cachedTraffic: TrafficResult[] = [];

// -----------------------------
// Main trafficService object (for controller imports)
export const trafficService = {
  getTrafficFlow: async (lat: number, lng: number): Promise<TrafficResult[]> => {
    return getTrafficData(lat, lng);
  },
};

// -----------------------------
// Cached access for scheduler / other services
export function getCachedTraffic(): TrafficResult[] {
  return cachedTraffic;
}

// -----------------------------
// Main fetcher
export async function getTrafficData(lat: number, lng: number, radius = 25_000): Promise<TrafficResult[]> {
  const key = `traffic:${lat.toFixed(3)}:${lng.toFixed(3)}`;

  return withCache(key, async () => {
    // 1️⃣ Waze
    try {
      if (WAZE_JSON) {
        const res = await axios.get(WAZE_JSON, { timeout: 10000 });
        const alerts = res.data?.alerts ?? [];
        if (alerts.length) {
          cachedTraffic = alerts.map((a: any) => ({
            id: `wz-${a.id}`,
            location: { lat: a.location.lat, lng: a.location.lng },
            description: a.comment || "Traffic alert",
            severity: mapSeverity(a.level),
            source: "waze",
          }));
          if (cachedTraffic.length) return cachedTraffic;
        }
      }
    } catch (err: any) {
      logInfo("[Traffic] Waze fetch failed, fallback to TomTom/Overpass");
    }

    // 2️⃣ TomTom
    try {
      if (TOMTOM_API_KEY) {
        const res = await axios.get(
          `${TOMTOM_API_URL}/traffic/services/4/flowSegmentData/absolute/10/json`,
          { params: { point: `${lat},${lng}`, key: TOMTOM_API_KEY }, timeout: 10000 }
        );
        const flow = res.data?.flowSegmentData;
        if (flow) {
          cachedTraffic = [
            {
              id: `tt-${lat}-${lng}`,
              location: { lat, lng },
              description: `Current speed: ${flow.currentSpeed} km/h`,
              severity: mapTomTomSeverity(flow),
              source: "tomtom",
            },
          ];
          return cachedTraffic;
        }
      }
    } catch {
      logInfo("[Traffic] TomTom fetch failed, fallback to Overpass");
    }

    // 3️⃣ Fallback: Overpass
    cachedTraffic = await fetchOverpassTraffic(lat, lng, radius);
    return cachedTraffic;
  }, TRAFFIC_CACHE_TTL);
}

// -----------------------------
// Overpass fetch
async function fetchOverpassTraffic(lat: number, lng: number, radius: number): Promise<TrafficResult[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["highway"="traffic_signals"](around:${radius},${lat},${lng});
      node["highway"="stop"](around:${radius},${lat},${lng});
      node["highway"="speed_camera"](around:${radius},${lat},${lng});
      way["highway"]["maxspeed"](around:${radius},${lat},${lng});
    );
    out center tags;
  `;
  try {
    const res = await axios.get(`${OVERPASS_API_URL}/interpreter`, { params: { data: query }, timeout: 20000 });
    return res.data.elements
      .map((e: any) => {
        const latVal = e.lat ?? e.center?.lat;
        const lngVal = e.lon ?? e.center?.lon;
        if (!latVal || !lngVal) return null;

        let description = "Traffic info";
        if (e.tags?.highway === "traffic_signals") description = "Traffic signal";
        else if (e.tags?.highway === "stop") description = "Stop sign";
        else if (e.tags?.highway === "speed_camera") description = "Speed camera";
        else if (e.tags?.maxspeed) description = `Max speed: ${e.tags.maxspeed} km/h`;

        return { id: `op-${e.id}`, location: { lat: latVal, lng: lngVal }, description, severity: "medium", source: "overpass" };
      })
      .filter(Boolean) as TrafficResult[];
  } catch (err: any) {
    logError("[Traffic] Overpass fetch failed", err.message);
    return [];
  }
}

// -----------------------------
// Force cache (cron / build)
export async function refreshTrafficCache() {
  logInfo("[TrafficService] Pre-warming cache...");
  const lat = 27.7172;
  const lng = 85.3240;
  const results = await getTrafficData(lat, lng);
  await fs.writeFile(CACHE_TRAFFIC, JSON.stringify(results, null, 2), "utf-8");
  logInfo(`[TrafficService] Cached ${results.length} traffic points`);
  return results;
}

// -----------------------------
// Helpers
function mapSeverity(level: number): "low" | "medium" | "high" {
  if (level <= 2) return "low";
  if (level === 3) return "medium";
  return "high";
}

function mapTomTomSeverity(flow: any): "low" | "medium" | "high" {
  if (!flow) return "medium";
  if (flow.freeFlowSpeed && flow.currentSpeed < flow.freeFlowSpeed / 2) return "high";
  if (flow.currentSpeed < flow.freeFlowSpeed * 0.8) return "medium";
  return "low";
}
