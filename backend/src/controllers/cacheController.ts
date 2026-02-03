import { Request, Response } from "express";
import * as CacheService from "../services/cacheService.js";
import { logError } from "@logs/logs";

export const listCache = async (_req: Request, res: Response) => {
  try {
    const keys = await CacheService.getCacheStats();
    res.json({ success: true, keys });
  } catch (err: any) {
    logError("[cacheController] listCache failed", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to retrieve cache stats" });
  }
};

export const handleClearCache = async (req: Request, res: Response) => {
  const { key } = req.params;
  try {
    await CacheService.clearCache(key);
    res.json({ success: true, message: key ? `Cache for ${key} cleared` : "All cache cleared" });
  } catch (err: any) {
    logError("[cacheController] Clear failed", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to clear cache" });
  }
};
