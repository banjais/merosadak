import axios from "axios";
import fs from "fs/promises";
import { config } from "../config/index.js";
import { CACHE_WAZE, CACHE_DIR } from "../config/paths.js";
import { logError, logInfo } from "@logs/logs";

export interface WazeIncident {
  id: string;
  type: string;
  subtype: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  timestamp: string;
  reliability: number;
  source: "waze";
}

/**
 * 🚗 Fetch Live Incidents from Waze Partner Feed
 */
export async function fetchWazeIncidents(): Promise<WazeIncident[]> {
  const url = config.WAZE_JSON;
  if (!url) {
    logInfo("⚠️ [WazeService] WAZE_JSON not configured.");
    return [];
  }

  try {
    const res = await axios.get(url, { timeout: 10000 });
    const alerts = res.data?.alerts || [];

    return alerts.map((a: any) => ({
      id: a.uuid || `waze-${Date.now()}-${Math.random()}`,
      type: a.type || "OTHER",
      subtype: a.subtype || "",
      title: `${a.type?.replace(/_/g, ' ') || 'Incident'} (Waze)`,
      description: a.reportText || `Live alert from Waze users. Subtype: ${a.subtype}`,
      lat: a.location?.y,
      lng: a.location?.x,
      timestamp: a.pubMillis ? new Date(a.pubMillis).toISOString() : new Date().toISOString(),
      reliability: a.reliability || 0,
      source: "waze"
    })).filter((a: any) => a.lat && a.lng);

  } catch (err: any) {
    logError("❌ [WazeService] Fetch failed", err.message);
    return [];
  }
}

/**
 * ✅ Get Cached Waze Data
 */
export async function getCachedWaze(): Promise<WazeIncident[]> {
  try {
    const alerts = await fetchWazeIncidents();
    if (alerts.length > 0) {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(CACHE_WAZE, JSON.stringify(alerts, null, 2), "utf-8");
      logInfo(`[WazeService] Cache updated (${alerts.length} incidents)`);
    }
    return alerts;
  } catch {
    try {
      const raw = await fs.readFile(CACHE_WAZE, "utf-8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}
