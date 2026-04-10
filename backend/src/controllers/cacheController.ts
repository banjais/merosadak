// backend/src/controllers/cacheController.ts
import { Request, Response } from "express";
import * as CacheService from "../services/cacheService.js";
import { logError, logInfo } from "../logs/logs.js";

/**
 * GET /api/cache
 * List all cache keys and stats
 */
export const listCache = async (_req: Request, res: Response) => {
  try {
    const keys = await CacheService.getCacheStats();
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      keys,
    });
  } catch (err: any) {
    logError("[CacheController] Failed to list cache", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve cache stats",
      error: err.message,
    });
  }
};

/**
 * POST /api/cache/refresh
 * Refresh specific cache: roads, weather, traffic, poi, alerts, monsoon, waze, all
 */
export const handleRefreshCache = async (req: Request, res: Response) => {
  const { type } = req.body;
  const validTypes = ["roads", "weather", "traffic", "poi", "alerts", "monsoon", "waze", "all"];

  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid type. Valid: ${validTypes.join(", ")}`,
    });
  }

  try {
    logInfo(`[CacheController] Refreshing cache: ${type}`);

    if (type === "all" || type === "roads") {
      const { refreshRoadCache } = await import("../services/roadService.js");
      await refreshRoadCache();
      CacheService.clearCache("road:merged");
    }
    if (type === "all" || type === "traffic") {
      const { refreshTrafficCache } = await import("../services/trafficService.js");
      await refreshTrafficCache();
    }
    if (type === "all" || type === "poi") {
      const { refreshPOICache } = await import("../services/poiService.js");
      await refreshPOICache();
    }
    if (type === "all" || type === "alerts") {
      const { refreshAlertCache } = await import("../services/alertService.js");
      await refreshAlertCache();
    }
    if (type === "all" || type === "monsoon") {
      const { refreshMonsoonCache } = await import("../services/monsoonService.js");
      await refreshMonsoonCache();
    }
    if (type === "all" || type === "waze") {
      const { refreshWazeCache } = await import("../services/wazeService.js");
      await refreshWazeCache();
    }
    if (type === "all" || type === "weather") {
      const { getRealWeather } = await import("../services/weatherService.js");
      await getRealWeather(27.7172, 85.3240); // Refresh weather for Kathmandu
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Cache refreshed: ${type}`,
    });
  } catch (err: any) {
    logError("[CacheController] Failed to refresh cache", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to refresh cache",
      error: err.message,
    });
  }
};

/**
 * DELETE /api/cache or /api/cache/:key
 * Clear cache for a specific key or all cache if no key provided
 */
export const handleClearCache = async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    await CacheService.clearCache(key);
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: key ? `Cache for ${key} cleared` : "All cache cleared",
    });
  } catch (err: any) {
    logError("[CacheController] Failed to clear cache", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to clear cache",
      error: err.message,
    });
  }
};
