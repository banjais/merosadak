// backend/src/controllers/highwayController.ts
import { Request, Response } from "express";
import { getHighwayList, getHighwayByCode } from "../services/highwayService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/highways
 * Returns list of available highways
 */
export const getHighwayList = async (_req: Request, res: Response) => {
  try {
    const highways = await getHighwayList();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: highways.length,
      data: highways,
    });
  } catch (err: any) {
    logError("[HighwayController] Failed to get highway list", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve highway list",
      error: err.message,
    });
  }
};

/**
 * GET /api/highways/:code
 * Returns specific highway geojson by code
 */
export const getHighwayByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const highway = await getHighwayByCode(code.toUpperCase());

    if (!highway) {
      return res.status(404).json({
        success: false,
        message: `Highway ${code} not found`,
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: highway,
    });
  } catch (err: any) {
    logError("[HighwayController] Failed to get highway by code", {
      code: req.params.code,
      error: err.message
    });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve highway data",
      error: err.message,
    });
  }
};