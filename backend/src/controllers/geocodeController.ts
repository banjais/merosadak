// backend/src/controllers/geocodeController.ts
import { Request, Response } from "express";
import { searchLocation } from "../services/searchService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/geocode?q=<query>
 * Search locations by query string
 */
export const handleSearch = async (req: Request, res: Response) => {
  const { q } = req.query;

  try {
    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'q' is required",
      });
    }

    const results = await searchLocation(q as string);

    res.json({
      success: true,
      count: results.length,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logError("[geocodeController] handleSearch failed", { error: err.message });

    res.status(500).json({
      success: false,
      message: "Failed to search locations",
      error: err.message,
    });
  }
};