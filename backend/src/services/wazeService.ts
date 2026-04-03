// backend/src/services/wazeService.ts
import { withCache } from "./cacheService.js";
import { logError, logInfo } from "../logs/logs.js";
import { CACHE_WAZE } from "../config/paths.js";
import { config } from "../config/index.js";
import axios from "axios";

/**
 * 🛰️ Waze Alert model (normalized)
 */
export interface WazeAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  lat: number;
  lng: number;
}

/**
 * ⏱ Cache TTL in seconds (5 minutes)
 */
const WAZE_CACHE_TTL = 300;

/**
 * 🌐 Nepal bounding box
 */
const DEFAULT_BBOX = {
  top: 30.5,
  bottom: 26.3,
  left: 80.0,
  right: 88.2,
};

/**
 * 🌐 Fetch raw Waze alerts from official/unofficial endpoint
 */
export const fetchWazeAlerts = async (): Promise<WazeAlert[]> => {
  try {
    const res = await axios.get(`${config.WAZE_API_BASE}/row-rtserver/web/TGeoRSS`, {
      timeout: 15_000,
      params: {
        ma: 200,
        mj: 100,
        mu: 20,
        left: DEFAULT_BBOX.left,
        right: DEFAULT_BBOX.right,
        top: DEFAULT_BBOX.top,
        bottom: DEFAULT_BBOX.bottom,
      },
    });

    const rawAlerts = res.data?.alerts ?? [];

    const alerts: WazeAlert[] = rawAlerts
      .map((a: any) => ({
        id: String(a.id),
        type: a.type || "UNKNOWN",
        title: a.subtype || a.type || "Waze Alert",
        description: a.comment || "",
        timestamp: a.pubMillis ? new Date(a.pubMillis).toISOString() : new Date().toISOString(),
        lat: Number(a.location?.y ?? a.locationY),
        lng: Number(a.location?.x ?? a.locationX),
      }))
      .filter((a: any) => !isNaN(a.lat) && !isNaN(a.lng));

    logInfo(`[WazeService] Alerts fetched: ${alerts.length}`);
    return alerts;

  } catch (err: any) {
    logError("❌ [WazeService] Fetch failed", err.message);
    return [];
  }
};

/**
 * 🔁 Get cached Waze alerts (optionally filtered by distance)
 */
export const getCachedWaze = async (lat?: number, lng?: number, radiusKm = 5): Promise<WazeAlert[]> => {
  try {
    const alerts = await withCache<WazeAlert[]>(
      "api:waze:alerts",
      fetchWazeAlerts,
      WAZE_CACHE_TTL,
      CACHE_WAZE
    );

    if (lat == null || lng == null) return alerts;

    return alerts.filter(a => haversineDistance(lat, lng, a.lat, a.lng) <= radiusKm);

  } catch (err: any) {
    logError("[WazeService] getCachedWaze failed", err.message);
    return [];
  }
};

/**
 * 🔄 Refresh Waze cache (for forceCache.ts)
 */
export const refreshWazeCache = async () => {
  logInfo("[WazeService] Refreshing Waze cache...");
  return getCachedWaze();
};

/**
 * 📐 Haversine distance helper (km)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
