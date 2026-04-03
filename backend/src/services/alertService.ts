// backend/src/services/alertService.ts
import axios from "axios";
import fs from "fs/promises";
import { CACHE_ALERTS } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_API_URL } from "../config/index.js";
import { getCachedRoads } from "./roadService.js";
import { ROAD_STATUS } from "../constants/sheets.js";

export interface AlertEntry {
  id: string | number;
  type: string;
  title: string;
  message: string;
  severity: string;
  lat?: number;
  lng?: number;
  extra?: any;
  timestamp: string;
}

/**
 * ──────────────────────────────────────────────
 * 1️⃣ Update alerts (main function for scheduler or ad-hoc)
 * ──────────────────────────────────────────────
 */
export const updateAlerts = async (lat?: number, lng?: number): Promise<AlertEntry[]> => {
  const context = lat !== undefined && lng !== undefined ? `Location: ${lat}, ${lng}` : undefined;
  try {
    logInfo(`[AlertService] updateAlerts started${context ? ` - Context: ${context}` : ""}`);

    const alerts: AlertEntry[] = [];

    // Pull road incidents from sheet data
    try {
      const roads = await getCachedRoads();
      const roadIncidents = roads.merged.filter(r => {
        const status = (r.properties?.status || r.status || "").toLowerCase();
        return status.includes("block") || status.includes("one");
      });

      for (const road of roadIncidents) {
        const props = road.properties || {};
        const status = props.status || road.status || "";
        const isBlocked = status.toLowerCase().includes("block");

        let coords: { lat: number; lng: number } | undefined;
        if (road.geometry?.coordinates) {
          if (road.geometry.type === "Point") {
            coords = { lat: road.geometry.coordinates[1], lng: road.geometry.coordinates[0] };
          } else if (road.geometry.type === "LineString" && road.geometry.coordinates.length > 0) {
            const mid = Math.floor(road.geometry.coordinates.length / 2);
            coords = { lat: road.geometry.coordinates[mid][1], lng: road.geometry.coordinates[mid][0] };
          }
        }

        // Filter by location if provided
        if (lat !== undefined && lng !== undefined && coords) {
          const dist = Math.sqrt(Math.pow(coords.lat - lat, 2) + Math.pow(coords.lng - lng, 2));
          if (dist > 0.5) continue; // ~50km radius
        }

        alerts.push({
          id: road.id || `road-${Math.random().toString(36).substr(2, 9)}`,
          type: isBlocked ? "road_block" : "one_lane",
          title: props.road_name || road.name || "Road Alert",
          message: props.remarks || `${status} — ${props.road_name || road.name}`,
          severity: isBlocked ? "high" : "medium",
          lat: coords?.lat,
          lng: coords?.lng,
          extra: {
            road_refno: props.road_refno,
            incidentDistrict: props.incidentDistrict,
            incidentPlace: props.incidentPlace,
            chainage: props.chainage,
            incidentStarted: props.incidentStarted,
            estimatedRestoration: props.estimatedRestoration,
            resumedDate: props.resumedDate,
            blockedHours: props.blockedHours,
            contactPerson: props.contactPerson,
            restorationEfforts: props.restorationEfforts,
            status: status,
            div_name: props.div_name,
            reportDate: props.reportDate,
          },
          timestamp: props.reportDate || new Date().toISOString(),
        });
      }

      logInfo(`[AlertService] Generated ${alerts.length} alerts from road data`);
    } catch (err: any) {
      logError("[AlertService] Failed to load road data for alerts", err.message);
    }

    // Add location context alert if provided
    if (context) {
      alerts.push({
        id: Date.now(),
        type: "info",
        title: "Location Check",
        message: context,
        severity: "low",
        extra: null,
        timestamp: new Date().toISOString(),
      });
    }

    // Save to cache
    await fs.writeFile(CACHE_ALERTS, JSON.stringify(alerts, null, 2), "utf-8");

    logInfo(`[AlertService] Alerts updated. Total: ${alerts.length}`);
    return alerts;
  } catch (err: any) {
    logError("[AlertService] updateAlerts failed", { error: err.message });
    return [];
  }
};

/**
 * ──────────────────────────────────────────────
 * 2️⃣ Force refresh cache (for build / scheduler)
 * ──────────────────────────────────────────────
 */
export const refreshAlertCache = async (): Promise<AlertEntry[]> => {
  logInfo("[AlertService] Refreshing alert cache...");
  return updateAlerts();
};

/**
 * ──────────────────────────────────────────────
 * 3️⃣ Send Telegram message
 * ──────────────────────────────────────────────
 */
export const sendTelegramMessage = async (message: string) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    logError("[AlertService] Telegram not configured");
    return;
  }

  try {
    await axios.post(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
    logInfo("[AlertService] Telegram message sent");
  } catch (err: any) {
    logError("[AlertService] Telegram message failed", { error: err.message });
  }
};

/**
 * ──────────────────────────────────────────────
 * 4️⃣ Send Email
 * ──────────────────────────────────────────────
 */
export const sendEmail = async ({ to, subject, text }: { to: string; subject: string; text: string }) => {
  try {
    // Replace with real email service logic (SMTP, SendGrid, etc.)
    logInfo(`[AlertService] Email sent to ${to} - subject: ${subject}`);
  } catch (err: any) {
    logError("[AlertService] Email send failed", { error: err.message });
  }
};

/**
 * ──────────────────────────────────────────────
 * 5️⃣ Unified export
 * ──────────────────────────────────────────────
 */
export const alertService = {
  updateAlerts,
  refreshAlertCache,
  sendTelegramMessage,
  sendEmail,
};
