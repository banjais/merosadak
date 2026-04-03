// backend/src/controllers/boundaryController.ts
import { Request, Response } from "express";
import { getBoundaryData } from "../services/boundaryService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/boundary
 * Returns GeoJSON boundary data
 */
export const getBoundary = async (_req: Request, res: Response) => {
  try {
    const data = await getBoundaryData();

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err: any) {
    logError("[BoundaryController] Failed to fetch boundary data", { error: err.message });

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve boundary data",
      error: err.message,
    });
  }
};
