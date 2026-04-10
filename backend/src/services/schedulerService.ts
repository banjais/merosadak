import fs from "fs/promises";
import { logInfo, logError } from "../logs/logs.js";
import {
  refreshRoadCache,
  getCachedRoads
} from "./roadService.js";
import {
  getCachedTraffic,
  refreshTrafficCache
} from "./trafficService.js";
import {
  calculateCurrentRisk
} from "./monsoonService.js";
import {
  updateAlerts
} from "./alertService.js";
import { getWeather } from "./weatherService.js";
import { clearCache } from "./cacheService.js";
import { refreshIndexFromCaches } from "./searchService.js";
import { captureSnapshot } from "./analyticsService.js";
import { initializeWebPush } from "./pushService.js";
import { initializeProfiles } from "./userProfileService.js";
import { initializeAnalytics } from "./analyticsService.js";
import paths, {
  CACHE_POI,
  CACHE_WEATHER,
  CACHE_ALERTS,
  CACHE_WAZE,
  CACHE_DIR,
  CACHE_TRAFFIC,
  CACHE_MONSOON,
  CACHE_ROAD
} from "../config/paths.js";
import {
  MASTER_UPDATE_INTERVAL_MS
} from "../config/index.js";
import {
  broadcastMapUpdate,
  broadcastProgress,
  broadcastLiveLog
} from "./websocketService.js";

export const syncSheetsToGeoJSON = async (): Promise<boolean> => {
  let hasErrors = false;

  broadcastProgress("Starting full system sync", 0);
  logInfo("Full System Data synchronization started...");

  // 1️⃣ Refresh Road Cache (reads from highway files)
  try {
    broadcastProgress("Refreshing road cache", 20);
    await refreshRoadCache();
    broadcastProgress("Road data synced", 40);
    logInfo("Roads synced.");
  } catch (err: any) {
    logError("Road sync failed", err.message);
    broadcastLiveLog({ type: "error", message: `Road sync failed: ${err.message}`, level: "error" });
    hasErrors = true;
    try { await fs.access(CACHE_ROAD); } catch {
      await fs.writeFile(CACHE_ROAD, JSON.stringify({ type: "FeatureCollection", features: [] }), "utf-8");
      broadcastProgress("Created empty Road cache placeholder", 25);
    }
  }

  try {
    broadcastProgress("Refreshing traffic cache", 30);
    await refreshTrafficCache();
    broadcastProgress("Traffic data synced", 50);
    logInfo("Traffic synced.");
  } catch (err: any) {
    logError("Traffic sync failed", err.message);
    broadcastLiveLog({ type: "error", message: `Traffic sync failed: ${err.message}`, level: "error" });
    hasErrors = true;
    try { await fs.access(CACHE_TRAFFIC); } catch {
      await fs.writeFile(CACHE_TRAFFIC, JSON.stringify({ globalFlow: null }), "utf-8");
      broadcastProgress("Created empty Traffic cache placeholder", 55);
    }
  }

  try {
    broadcastProgress("Calculating monsoon risk", 60);
    const monsoonData = await calculateCurrentRisk();
    if (!monsoonData?.length) logInfo("Monsoon risk cache empty");
    broadcastProgress("Monsoon risk updated", 70);
    logInfo("Monsoon risk synced.");
  } catch (err: any) {
    logError("Monsoon sync failed", err.message);
    broadcastLiveLog({ type: "error", message: `Monsoon sync failed: ${err.message}`, level: "error" });
    hasErrors = true;
    try { await fs.access(CACHE_MONSOON); } catch {
      await fs.writeFile(CACHE_MONSOON, "[]", "utf-8");
      broadcastProgress("Created empty Monsoon cache placeholder", 75);
    }
  }

  try {
    broadcastProgress("Initializing optional caches", 80);
    const optionalCaches = [
      { path: CACHE_POI, defaultContent: "{}" },
      { path: CACHE_WEATHER, defaultContent: "{}" },
      { path: CACHE_ALERTS, defaultContent: "{}" },
      { path: CACHE_WAZE, defaultContent: "[]" }
    ];
    for (const cache of optionalCaches) {
      try { await fs.access(cache.path); } catch {
        await fs.writeFile(cache.path, cache.defaultContent, "utf-8");
      }
    }
    broadcastProgress("Optional caches ready", 85);
  } catch (err: any) {
    logError("Optional cache init failed", err.message);
    hasErrors = true;
  }

  try {
    broadcastProgress("Generating system alerts", 90);
    await updateAlerts();
    await getWeather();
    broadcastProgress("Clearing API caches", 94);
    await clearCache("road:merged");
    await clearCache("api:roads:all");
    await clearCache("api:alerts:all");
  } catch (err: any) {
    logError("Alerts / Weather / Cache failed", err.message);
    hasErrors = true;
  }

  broadcastProgress("Updating search index", 95);
  await refreshIndexFromCaches();

  (["roads", "traffic", "weather", "pois", "waze"] as const).forEach(type => broadcastMapUpdate(type));

  // Capture analytics snapshot after sync
  try {
    broadcastProgress("Capturing analytics snapshot", 98);
    await captureSnapshot();
  } catch (err: any) {
    logError("Analytics snapshot failed", err.message);
  }

  broadcastProgress("Sync complete", 100);

  if (hasErrors) {
    logInfo("Sync completed with partial errors.");
    return false;
  }

  logInfo("Full sync successful.");
  return true;
};

export const forceRefresh = async () => {
  broadcastLiveLog({ type: "system", message: "Manual force-refresh requested", level: "info" });
  const success = await syncSheetsToGeoJSON();
  return {
    success,
    timestamp: new Date().toISOString(),
    message: success ? "Manual synchronization successful." : "Manual synchronization completed with errors."
  };
};

export const startAutoRefresh = () => {
  const INTERVAL_MS = MASTER_UPDATE_INTERVAL_MS || 15 * 60 * 1000;
  const execute = async () => {
    try { await syncSheetsToGeoJSON(); } catch (err: any) {
      logError("Auto-refresh error", err.message);
      broadcastLiveLog({ type: "error", message: err.message, level: "error" });
    } finally {
      setTimeout(execute, INTERVAL_MS);
    }
  };
  setTimeout(() => {
    logInfo("Initial sync triggered.");
    broadcastLiveLog({ type: "system", message: "Initial auto-sync started", level: "info" });
    execute();
  }, 2000);
  logInfo(`Auto-refresh enabled (${INTERVAL_MS / 60000} min)`);
};
