import fs from "fs/promises";
import { logInfo, logError } from "@logs/logs";
import { updateMasterFromSheet } from "./roadService.js";
import { getCachedTraffic } from "./trafficService.js";
import { calculateCurrentRisk } from "./monsoonService.js";
import { updateAlerts } from "./alertService.js";
import { getWeather } from "./weatherService.js";
import { clearCache } from "./cacheService.js";
import { refreshIndexFromCaches } from "./searchService.js";
import {
  broadcastMapUpdate,
  broadcastProgress,
  broadcastLiveLog
} from "./websocketService.js";
import {
  CACHE_POI,
  CACHE_WEATHER,
  CACHE_DIR,
  CACHE_TRAFFIC,
  CACHE_MONSOON,
  CACHE_ROAD
} from "../config/paths.js";

/**
 * 🔄 Full system sync with step-wise live progress
 */
export const syncSheetsToGeoJSON = async (): Promise<boolean> => {
  let hasErrors = false;

  broadcastProgress("Starting full system sync", 0);
  logInfo("🔄 [SCHEDULER]: Full System Data synchronization started...");

  // 1️⃣ Roads
  try {
    broadcastProgress("Updating master road data", 10);
    await updateMasterFromSheet();
    broadcastProgress("Master road data synced", 20);
    logInfo("✅ [SCHEDULER]: Roads synced.");
  } catch (err: any) {
    logError("⚠️ [SCHEDULER]: Road sync failed", err.message);
    broadcastLiveLog({ type: "error", message: `Road sync failed: ${err.message}` });
    hasErrors = true;

    try {
      await fs.access(CACHE_ROAD);
    } catch {
      await fs.writeFile(
        CACHE_ROAD,
        JSON.stringify({ type: "FeatureCollection", features: [] }),
        "utf-8"
      );
      broadcastProgress("Created empty Road cache placeholder", 25);
    }
  }

  // 2️⃣ Traffic
  try {
    broadcastProgress("Fetching traffic data", 30);
    await getCachedTraffic();
    broadcastProgress("Traffic data synced", 50);
    logInfo("✅ [SCHEDULER]: Traffic synced.");
  } catch (err: any) {
    logError("⚠️ [SCHEDULER]: Traffic sync failed", err.message);
    broadcastLiveLog({ type: "error", message: `Traffic sync failed: ${err.message}` });
    hasErrors = true;

    try {
      await fs.access(CACHE_TRAFFIC);
    } catch {
      await fs.writeFile(
        CACHE_TRAFFIC,
        JSON.stringify({ globalFlow: null }),
        "utf-8"
      );
      broadcastProgress("Created empty Traffic cache placeholder", 55);
    }
  }

  // 3️⃣ Monsoon risk
  try {
    broadcastProgress("Calculating monsoon risk", 60);
    await calculateCurrentRisk();
    broadcastProgress("Monsoon risk updated", 70);
    logInfo("✅ [SCHEDULER]: Monsoon risk synced.");
  } catch (err: any) {
    logError("⚠️ [SCHEDULER]: Monsoon sync failed", err.message);
    broadcastLiveLog({ type: "error", message: `Monsoon sync failed: ${err.message}` });
    hasErrors = true;

    try {
      await fs.access(CACHE_MONSOON);
    } catch {
      await fs.writeFile(CACHE_MONSOON, "[]", "utf-8");
      broadcastProgress("Created empty Monsoon cache placeholder", 75);
    }
  }

  // 4️⃣ Optional caches (POI / Weather)
  try {
    broadcastProgress("Initializing optional caches (POI & Weather)", 80);
    await fs.mkdir(CACHE_DIR, { recursive: true });

    try {
      await fs.access(CACHE_POI);
    } catch {
      await fs.writeFile(CACHE_POI, "{}", "utf-8");
    }

    try {
      await fs.access(CACHE_WEATHER);
    } catch {
      await fs.writeFile(CACHE_WEATHER, "{}", "utf-8");
    }

    broadcastProgress("POI & Weather caches ready", 85);
  } catch (err: any) {
    logError("⚠️ [SCHEDULER]: Cache init failed", err.message);
  }

  // 5️⃣ Clear Redis / API cache
  try {
    broadcastProgress("Generating system alerts", 90);
    await updateAlerts();
    
    broadcastProgress("Validating weather data", 92);
    await getWeather(); // Heartbeat for Kathmandu/Main area

    broadcastProgress("Clearing API caches", 94);
    await clearCache("api:roads:all");
    await clearCache("api:alerts:all");
  } catch {}

  // 6️⃣ Notify frontends
  broadcastProgress("Updating search index", 95);
  await refreshIndexFromCaches();

  broadcastProgress("Notifying frontends about new data", 97);
  broadcastMapUpdate("roads");
  broadcastMapUpdate("traffic");
  broadcastMapUpdate("weather");
  broadcastMapUpdate("pois");

  broadcastProgress("Sync complete", 100);

  if (hasErrors) {
    logInfo("⚠️ [SCHEDULER]: Sync completed with partial errors.");
    return false;
  }

  logInfo("✅ [SCHEDULER]: Full sync successful.");
  return true;
};

/**
 * ⚡ Manual force refresh (Admin)
 */
export const forceRefresh = async () => {
  broadcastLiveLog({
    type: "system",
    message: "Manual force-refresh requested",
    level: "info"
  });

  const success = await syncSheetsToGeoJSON();

  return {
    success,
    timestamp: new Date().toISOString(),
    message: success
      ? "Manual synchronization successful."
      : "Manual synchronization completed with errors."
  };
};

/**
 * 🚀 Auto-refresh loop
 */
export const startAutoRefresh = () => {
  const INTERVAL_MS = 15 * 60 * 1000;

  const execute = async () => {
    try {
      await syncSheetsToGeoJSON();
    } catch (err: any) {
      logError("❌ [SCHEDULER]: Auto-refresh error", err.message);
      broadcastLiveLog({ type: "error", message: err.message });
    } finally {
      setTimeout(execute, INTERVAL_MS);
    }
  };

  setTimeout(() => {
    logInfo("⏱️ [SCHEDULER]: Initial sync triggered.");
    broadcastLiveLog({ type: "system", message: "Initial auto-sync started" });
    execute();
  }, 2000);

  logInfo(`📅 [SCHEDULER]: Auto-refresh enabled (${INTERVAL_MS / 60000} min)`);
};
