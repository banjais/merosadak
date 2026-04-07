// backend/src/services/wazeService.ts
import axios from "axios";
import { CACHE_WAZE } from "../config/paths.js";
import { logInfo, logError } from "@logs/logs";
import fs from "fs/promises";

/**
 * 🛰️ Fetch Waze Live Alerts
 * Uses official/Unofficial Waze URL for Nepal
 */
const WAZE_URL = "https://www.waze.com/row-rtserver/web/TGeoRSS"; // example
const WAZE_REGION = "NP"; // Nepal

export interface WazeAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export const fetchWazeAlerts = async (): Promise<WazeAlert[]> => {
  try {
    const res = await axios.get(WAZE_URL, { params: { country: WAZE_REGION } });
    const alerts = res.data?.alerts ?? [];
    return alerts.map((a: any) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      lat: a.location?.lat,
      lng: a.location?.lon,
      timestamp: new Date(a.timestamp * 1000).toISOString(),
    }));
  } catch (err: any) {
    logError("[WazeService] Failed to fetch Waze alerts", err.message);
    return [];
  }
};

/**
 * 🗂️ Cached Waze Alerts
 */
export const getCachedWaze = async (): Promise<WazeAlert[]> => {
  try {
    const raw = await fs.readFile(CACHE_WAZE, "utf-8");
    return JSON.parse(raw);
  } catch {
    const fresh = await fetchWazeAlerts();
    try {
      await fs.writeFile(CACHE_WAZE, JSON.stringify(fresh, null, 2), "utf-8");
    } catch {}
    return fresh;
  }
};
