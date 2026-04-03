// backend/src/controllers/alertController.ts
import { Request, Response } from "express";
import * as alertService from "../services/alertService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/alerts
 * Returns cached alerts.
 * Optional query: ?lat=27.7&lng=85.3 to filter nearby alerts (~10km radius)
 */
export const getAlerts = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

    const latNum = lat ? Number(lat) : undefined;
    const lngNum = lng ? Number(lng) : undefined;

    const alerts = await alertService.updateAlerts(latNum, lngNum);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: alerts.length,
      data: alerts,
    });
  } catch (err: any) {
    logError("[AlertController] getAlerts failed", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
      error: err.message,
    });
  }
};

/**
 * POST /api/alerts/refresh
 * Force refresh and rebuild combined alerts cache.
 * Optional body: { lat, lng } to include nearby alerts
 */
export const refreshAlerts = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;

    const latNum = lat !== undefined ? Number(lat) : undefined;
    const lngNum = lng !== undefined ? Number(lng) : undefined;

    const alerts = await alertService.updateAlerts(latNum, lngNum);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: alerts.length,
      data: alerts,
    });
  } catch (err: any) {
    logError("[AlertController] refreshAlerts failed", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to refresh alerts",
      error: err.message,
    });
  }
};