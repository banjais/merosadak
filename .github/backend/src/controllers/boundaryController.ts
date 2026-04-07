// backend/src/controllers/boundaryController.ts
import { Request, Response } from "express";
import { getNepalBoundary as getNepalBoundaryService } from "../services/boundaryService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/v1/boundary
 * Returns Nepal boundary GeoJSON for map display
 */
export const getNepalBoundary = async (_req: Request, res: Response) => {
  try {
    const data = await getNepalBoundaryService();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err: any) {
    logError("[BoundaryController] Failed to fetch Nepal boundary", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve Nepal boundary",
      error: err.message,
    });
  }
};