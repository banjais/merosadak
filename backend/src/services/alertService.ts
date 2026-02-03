import fs from "fs/promises";
import path from "path";
import { logInfo, logError } from "@logs/logs";
import { CACHE_DIR, CACHE_ROAD, CACHE_TRAFFIC, CACHE_ALERTS, CACHE_MONSOON } from "../config/paths.js";
import { ROAD_STATUS } from "../constants/sheets.js";
import { getCachedWaze } from "./wazeService.js";

/**
 * 🧭 Alert model
 */
export interface Alert {
  type: string;
  message: string;
  timestamp: string;
  lat?: number;
  lng?: number;
}

/**
 * 🔄 Update alerts
 * Aggregates Road, Monsoon, and Traffic data to generate a centralized alert list.
 */
export const updateAlerts = async (): Promise<Alert[]> => {
  try {
    logInfo("[AlertService] Updating alerts...");
    const alerts: Alert[] = [];

    await fs.mkdir(CACHE_DIR, { recursive: true });

    // 1️⃣ Road status alerts
    try {
      const roadsRaw = await fs.readFile(CACHE_ROAD, "utf-8");
      const roads = JSON.parse(roadsRaw);
      roads.features?.forEach((road: any) => {
        if (road.properties?.status === ROAD_STATUS.BLOCKED) {
          const coords = road.geometry?.coordinates?.[0];
          if (coords) {
            const [lng, lat] = coords;
            alerts.push({
              type: "Road Block",
              message: `Road ${road.properties.road_name || road.properties.name || "Unknown"} is blocked`,
              timestamp: new Date().toISOString(),
              lat,
              lng,
            });
          }
        }
      });
    } catch {
      logInfo("[AlertService] No cached roads data found or file unreadable.");
    }

    // 2️⃣ Monsoon risk alerts
    try {
      const monsoonDataRaw = await fs.readFile(CACHE_MONSOON, "utf-8");
      const monsoonData = JSON.parse(monsoonDataRaw);
      monsoonData?.forEach((m: any) => {
        if (["MEDIUM", "HIGH", "EXTREME"].includes(m.riskLevel)) {
          alerts.push({
            type: "Monsoon Risk",
            message: `Monsoon risk ${m.riskLevel} on ${m.roadName || "Unknown Road"}: ${m.reason || "No reason provided"}`,
            timestamp: new Date().toISOString(),
          });
        }
      });
    } catch {
      logInfo("[AlertService] No cached monsoon risk found.");
    }

    // 3️⃣ Traffic alerts (TomTom)
    try {
      const trafficRaw = await fs.readFile(CACHE_TRAFFIC, "utf-8");
      const trafficData = JSON.parse(trafficRaw);
      trafficData?.segments?.forEach((seg: any) => {
        if (seg.congestionLevel && seg.congestionLevel >= 0.8) {
          alerts.push({
            type: "Traffic Jam",
            message: `[Unofficial] Heavy congestion on ${seg.roadName || "Unknown Road"}`,
            timestamp: new Date().toISOString(),
            lat: seg.lat,
            lng: seg.lng,
          });
        }
      });
    } catch {
      logInfo("[AlertService] No cached traffic data found.");
    }

    // 4️⃣ Waze Live Alerts (Unofficial)
    try {
      const wazeAlerts = await getCachedWaze();
      wazeAlerts.forEach(wa => {
        alerts.push({
          type: wa.type,
          message: `[Waze] ${wa.title}: ${wa.description}`,
          timestamp: wa.timestamp,
          lat: wa.lat,
          lng: wa.lng,
        });
      });
    } catch (err) {
      logError("[AlertService] Waze fetch failed", (err as any).message);
    }

    // Save to centralized cache
    await fs.writeFile(CACHE_ALERTS, JSON.stringify(alerts, null, 2), "utf-8");
    logInfo(`[AlertService] Alerts updated (${alerts.length})`);

    return alerts;
  } catch (err: any) {
    logError("[AlertService] Failed to update alerts", err.message);
    return [];
  }
};

/**
 * 📂 Get cached alerts
 */
export const getCachedAlerts = async (): Promise<Alert[]> => {
  try {
    const raw = await fs.readFile(CACHE_ALERTS, "utf-8");
    return JSON.parse(raw);
  } catch {
    logInfo("[AlertService] No cached alerts found.");
    return [];
  }
};

/**
 * ✅ Alias for Router and Heartbeat consistency
 */
export const getAlerts = getCachedAlerts;
