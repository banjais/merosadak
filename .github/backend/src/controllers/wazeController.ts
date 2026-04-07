import { Request, Response } from "express";
import * as WazeService from "../services/wazeService.js";
import { logError } from "../logs/logs.js";

/**
 * 🌐 Get Waze alerts
 * Optional query params:
 * - lat: number
 * - lng: number
 * - radius: number (km, default 5)
 */
export const getWazeAlerts = async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius } = req.query;

    const alerts = await WazeService.getCachedWaze(
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      radius ? Number(radius) : 5
    );

    return res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (err: any) {
    logError("❌ [WazeController] Failed to fetch alerts", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Waze alerts",
    });
  }
};
