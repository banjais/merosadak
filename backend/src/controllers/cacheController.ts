// backend/src/controllers/cacheController.ts
import { Request, Response } from "express";
import * as CacheService from "../services/cacheService.js";
import { logInfo } from "../logs/logs.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { APIError } from "../middleware/errorHandler.js";

/**
 * GET /api/cache
 * List all cache keys and stats
 */
export const listCache = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await CacheService.getCacheStats();

  // Define prefixes for grouped overview
  const prefixes = ["highways", "roads", "weather", "traffic", "poi", "search", "alerts", "monsoon"];

  const overview: Record<string, number> = {};

  // Fetch counts for each group in parallel
  await Promise.all(
    prefixes.map(async (p) => {
      const keys = await CacheService.getCacheKeysByPrefix(p);
      overview[p] = keys.length;
    })
  );

  // Calculate "other" keys
  const totalKeys = stats.memoryKeys + (stats.usingRedis ? 100 : 0); // Estimate or actual if scanning

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    stats: {
      ...stats,
      groups: overview
    },
  });
});

/**
 * POST /api/cache/refresh
 * Refresh specific cache: roads, weather, traffic, poi, alerts, monsoon, waze, all
 */
export const handleRefreshCache = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.body;
  const validTypes = ["roads", "weather", "traffic", "poi", "alerts", "monsoon", "waze", "search", "all"];

  if (!type || !validTypes.includes(type)) {
    throw new APIError(`Invalid refresh type. Valid types are: ${validTypes.join(", ")}`, 400, "INVALID_REFRESH_TYPE");
  }

  logInfo(`[CacheController] Refreshing cache: ${type}`);

  if (type === "all" || type === "roads") {
    const { refreshRoadCache } = await import("../services/roadService.js");
    await refreshRoadCache();
    await CacheService.clearCache("road:merged");
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
    await getRealWeather(27.7172, 85.3240);
  }

  // Invalidate unified search results and POI specific results 
  // if any component data has been refreshed
  if (type === "all" || ["search", "roads", "traffic", "poi", "weather"].includes(type)) {
    await CacheService.clearCacheByPattern("search:*");
    if (type === "poi" || type === "all") await CacheService.clearCacheByPattern("poi:*");
  }

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: `Cache refreshed: ${type}`,
  });
});

/**
 * DELETE /api/cache or /api/cache/:key
 * Clear cache for a specific key or all cache if no key provided
 */
export const handleClearCache = asyncHandler(async (req: Request, res: Response) => {
  const key = req.params.key;
  const cacheKey = Array.isArray(key) ? key[0] : key;

  await CacheService.clearCache(cacheKey);

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: cacheKey ? `Cache for ${cacheKey} cleared` : "All cache cleared",
  });
});
