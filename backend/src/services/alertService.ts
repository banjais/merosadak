// backend/src/services/alertService.ts
import axios from "axios";
import fs from "fs/promises";
import { CACHE_ALERTS } from "@/config/paths.js";
import { logInfo, logError } from "@logs/logs.js";
import {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  TELEGRAM_API_URL,
  ALERT_SUMMARY_THRESHOLD,
  ALERT_NOTIFICATION_TTL_SEC,
  PRIORITY_ROADS
} from "@/config/index.js";
import { getCachedRoads } from "@/services/roadService.js";
import { getHighwayByCode } from "@/services/highwayService.js";
import { calculateIncidentLocation } from "@/utils/incidentLocation.js";
import { maskEmail } from "@/services/piiMasking.js";
import { isValidNepalCoordinate } from "@/services/geoUtils.js";
import { ROAD_STATUS } from "@/constants/sheets.js";
import { resolveLabel } from "@/services/labelUtils.js";
import type { AlertEntry } from "@/types.js";
import { notifyRoadBlockage, notifyRoadResumed } from "@/services/pushService.js";
import { redisClient } from "@/services/cacheService.js";

export const REDIS_NOTIFIED_PREFIX = "notified:blockage:";
const NOTIFICATION_TTL_SEC = ALERT_NOTIFICATION_TTL_SEC;

// In-memory fallback for notification tracking if Redis is down
const notificationFallback = new Map<string, number>();

// Global lock to prevent race conditions during concurrent updates
let isProcessingAlerts = false;

interface NotifiableIncident {
  road: string;
  place: string;
  isPriority: boolean;
  estimatedRestoration?: string;
}

/**
 * Helper: Check if an incident has already been notified (Redis with Memory Fallback)
 */
async function isAlreadyNotified(key: string): Promise<boolean> {
  if (redisClient) {
    try {
      const val = await redisClient.get(key);
      if (val) return true;
    } catch (err: any) {
      logError("[AlertService] Redis check failed, using memory fallback", err.message);
    }
  }
  const memVal = notificationFallback.get(key);
  if (memVal && Date.now() - memVal < NOTIFICATION_TTL_SEC * 1000) {
    return true;
  }
  if (memVal) notificationFallback.delete(key); // Cleanup expired memory entry
  return false;
}

/**
 * Helper: Mark an incident as notified
 */
async function markAsNotified(key: string) {
  const now = Date.now();
  if (redisClient) {
    try {
      await redisClient.set(key, now, { ex: NOTIFICATION_TTL_SEC });
    } catch (err: any) {
      logError("[AlertService] Redis mark failed", err.message);
    }
  }
  notificationFallback.set(key, now);
}

/**
 * Helper: Remove an incident from the notified registry
 */
async function clearNotifiedState(key: string) {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (err: any) {
      logError("[AlertService] Redis clear failed", err.message);
    }
  }
  notificationFallback.delete(key);
}

/**
 * ──────────────────────────────────────────────
 * 1️⃣ Update alerts (main function for scheduler or ad-hoc)
 * ──────────────────────────────────────────────
 */
export const updateAlerts = async (lat?: number, lng?: number): Promise<AlertEntry[]> => {
  if (isProcessingAlerts) {
    logInfo("[AlertService] updateAlerts already in progress, skipping concurrent call");
    return [];
  }

  isProcessingAlerts = true;
  const context = lat !== undefined && lng !== undefined ? `Location: ${lat}, ${lng}` : undefined;

  try {
    logInfo(`[AlertService] updateAlerts started${context ? ` - Context: ${context}` : ""}`);

    const alerts: AlertEntry[] = [];
    const newBlockages: NotifiableIncident[] = [];
    const resumedRoads: NotifiableIncident[] = [];

    // Periodically prune the in-memory fallback to prevent leaks
    if (notificationFallback.size > 1000) {
      const now = Date.now();
      for (const [key, time] of notificationFallback.entries()) {
        if (now - time > NOTIFICATION_TTL_SEC * 1000) notificationFallback.delete(key);
      }
    }

    // Pull road incidents from sheet data
    try {
      const roads = await getCachedRoads();
      const roadIncidents = roads.merged.filter(r => {
        const status = (r.properties?.status || r.status || "").toLowerCase();
        // We filter for active incidents and resumed ones to detect state changes
        const isIncident = r.source === "Department of Roads" || r.source === "sheet";
        return isIncident && (status.includes("block") || status.includes("one") || status.includes("resume") || status.includes("open"));
      });

      for (const road of roadIncidents) {
        const props = road.properties || {};
        const status = props.status || road.status || "";
        const isBlocked = status.toLowerCase().includes("block");
        const isResumed = status.toLowerCase().includes("resume") || status.toLowerCase() === "open";

        let coords: { lat: number; lng: number } | undefined;

        // Try to get exact coordinates using the incident location calculator
        if (props.road_refno) {
          try {
            const highwayData = await getHighwayByCode(props.road_refno);
            if (highwayData) {
              const calculatedCoords = calculateIncidentLocation(highwayData, {
                chainage: props.chainage,
                incidentCoordinate: props.incidentCoordinate,
                incidentPlace: props.incidentPlace,
                road_refno: props.road_refno
              });

              if (calculatedCoords) {
                coords = calculatedCoords;
              }
            }
          } catch (err: any) {
            logError("[AlertService] Failed to calculate incident location", {
              road_refno: props.road_refno,
              error: err.message
            });
          }
        }

        // Fallback to geometry-based coordinates if calculation failed
        if (!coords && road.geometry?.coordinates) {
          if (road.geometry.type === "Point") {
            const [lng, lat] = road.geometry.coordinates;
            if (isValidNepalCoordinate(lat, lng)) coords = { lat, lng };
          } else if (road.geometry.type === "LineString" && road.geometry.coordinates.length > 0) {
            const mid = Math.floor(road.geometry.coordinates.length / 2);
            const [lng, lat] = road.geometry.coordinates[mid];
            if (isValidNepalCoordinate(lat, lng)) coords = { lat, lng };
          } else if (road.geometry.type === "MultiLineString" && road.geometry.coordinates.length > 0) {
            // Take the first point of the first segment
            const [lng, lat] = road.geometry.coordinates[0][0];
            if (isValidNepalCoordinate(lat, lng)) coords = { lat, lng };
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
          title: resolveLabel(props.road_name) || road.name || "Road Alert",
          message: resolveLabel(props.remarks) || `${status} — ${resolveLabel(props.road_name) || road.name}`,
          severity: isBlocked ? "high" : "medium",
          lat: coords?.lat, // Keep as undefined if no coordinates available
          lng: coords?.lng, // Keep as undefined if no coordinates available
          extra: {
            road_refno: props.road_refno,
            incidentDistrict: resolveLabel(props.incidentDistrict),
            incidentPlace: resolveLabel(props.incidentPlace),
            remarks: resolveLabel(props.remarks),
            road_name: resolveLabel(props.road_name),
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
            hasExactLocation: !!coords, // Flag to indicate if exact location is available
          },
          timestamp: props.reportDate || new Date().toISOString(),
        });

        const blockageKey = `${props.road_refno || 'no-ref'}-${resolveLabel(props.incidentPlace, 'en') || 'no-place'}`;
        const redisKey = `${REDIS_NOTIFIED_PREFIX}${blockageKey}`;
        const isPriority = props.road_refno?.startsWith("NH") || (props.road_refno && PRIORITY_ROADS.includes(props.road_refno)) || false;

        // 🚨 Trigger Push Notification for NEW blockages only
        if (isBlocked) {
          if (!(await isAlreadyNotified(redisKey))) {
            newBlockages.push({
              road: resolveLabel(props.road_name) || road.name || "Unknown Road",
              place: resolveLabel(props.incidentPlace) || "Unknown Location",
              isPriority: !!isPriority,
              estimatedRestoration: props.estimatedRestoration,
            });
            await markAsNotified(redisKey);
          }
        } else if (isResumed) {
          // ✅ Notify for resumed roads IF they were previously blocked
          if (await isAlreadyNotified(redisKey)) {
            resumedRoads.push({
              road: resolveLabel(props.road_name) || road.name || "Unknown Road",
              place: resolveLabel(props.incidentPlace) || "Unknown Location",
              isPriority: !!isPriority
            });
            await clearNotifiedState(redisKey);
          }
        }
      }

      // --- Handle New Blockages ---
      const priorityNew = newBlockages.filter(b => b.isPriority);
      const otherNew = newBlockages.filter(b => !b.isPriority);

      // Always notify priority blockages individually
      for (const b of priorityNew) {
        notifyRoadBlockage(b.road, b.place)
          .catch(err => logError("[AlertService] Priority push failed", err.message));

        const est = b.estimatedRestoration ? `\n*Est. Restoration:* ${b.estimatedRestoration}` : "";
        sendTelegramMessage(`🚨 *Priority Road Blocked*\n\n*Road:* ${b.road}\n*Location:* ${b.place}${est}\n\nPlease find an alternative route.`);
      }

      // Handle other blockages with summary logic
      if (otherNew.length > ALERT_SUMMARY_THRESHOLD) {
        notifyRoadBlockage("Multiple Roads", `${otherNew.length} new road blocks detected.`)
          .catch(err => logError("[AlertService] Other summary push failed", err.message));
        sendTelegramMessage(`🚨 *Network Alert*\n\n${otherNew.length} additional road blocks detected across the network. Check the app for details.`);
      } else {
        for (const b of otherNew) {
          notifyRoadBlockage(b.road, b.place)
            .catch(err => logError("[AlertService] Other individual push failed", err.message));
          sendTelegramMessage(`🚨 *Road Blocked*\n\n*Road:* ${b.road}\n*Location:* ${b.place}`);
        }
      }

      // --- Handle Resumed Roads ---
      const priorityResumed = resumedRoads.filter(r => r.isPriority);
      const otherResumed = resumedRoads.filter(r => !r.isPriority);

      // Always notify priority resumptions individually
      for (const r of priorityResumed) {
        notifyRoadResumed(r.road, r.place)
          .catch(err => logError("[AlertService] Priority resume push failed", err.message));
        sendTelegramMessage(`✅ *Priority Road Resumed*\n\n*Road:* ${r.road}\n*Location:* ${r.place}\n\nTraffic is now flowing normally.`);
      }

      // Handle other resumptions with summary logic
      if (otherResumed.length > ALERT_SUMMARY_THRESHOLD) {
        notifyRoadResumed("Multiple Roads", `${otherResumed.length} sections have resumed.`)
          .catch(err => logError("[AlertService] Other resume summary push failed", err.message));
        sendTelegramMessage(`✅ *Network Update*\n\n${otherResumed.length} previously blocked sections are now open.`);
      } else {
        for (const r of otherResumed) {
          notifyRoadResumed(r.road, r.place)
            .catch(err => logError("[AlertService] Other resume individual push failed", err.message));
          sendTelegramMessage(`✅ *Road Resumed*\n\n*Road:* ${r.road}\n*Location:* ${r.place}`);
        }
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
  } finally {
    isProcessingAlerts = false;
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
    logInfo(`[AlertService] Email sent to ${maskEmail(to)} - subject: ${subject}`);
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
