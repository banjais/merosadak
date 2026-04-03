// backend/src/controllers/cacheController.ts
import { Request, Response } from "express";
import * as CacheService from "../services/cacheService.js";
import { logError } from "../logs/logs.js";

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
 * DELETE /api/cache/:key?
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
