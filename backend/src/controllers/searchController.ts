import { Request, Response } from "express";
import { refreshIndexFromCaches, search } from "../services/searchService.js";
import { logError, logInfo } from "../logs/logs.js";
import { AuthRequest } from "../middleware/auth.js";

/**
 * Manually triggers a rebuild of the search index.
 */
export const triggerSearchRefresh = async (req: AuthRequest, res: Response) => {
  try {
    await refreshIndexFromCaches();
    res.json({ success: true, message: "Search index refresh triggered successfully." });
  } catch (err: any) {
    logError("Manual search refresh failed", err.message);
    res.status(500).json({ success: false, error: "Internal server error during index refresh." });
  }
};

/**
 * Handles search queries for locations, highways, and POIs.
 */
export const handleSearch = async (req: Request, res: Response) => {
  try {
    const { q, lat, lng } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ success: false, error: "Query parameter 'q' is required." });
    }

    const location = (lat && lng)
      ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) }
      : undefined;

    const results = await search(q, location);

    res.json({ success: true, results });
  } catch (err: any) {
    logError("Search handler failed", err.message);
    res.status(500).json({ success: false, error: "Internal server error during search." });
  }
};