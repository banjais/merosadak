// backend/src/controllers/trafficController.ts
// Updated to use enhanced traffic service

import { Request, Response } from "express";
import * as TrafficService from "../services/trafficService.js";
import { logError, logInfo } from "../logs/logs.js";

/**
 * GET /traffic/flow?lat=&lng=&radius=
 * Get real-time traffic flow with colored polylines
 */
export const getTrafficFlow = async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "lat and lng parameters required"
      });
    }

    const traffic = await TrafficService.getTrafficData(
      Number(lat),
      Number(lng),
      Number(radius) || 10
    );

    res.json({
      success: true,
      data: traffic
    });
  } catch (err: any) {
    logError("[TrafficController] getTrafficFlow failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * GET /traffic/summary
 * Get traffic summary (congestion stats)
 */
export const getTrafficSummary = async (_req: Request, res: Response) => {
  try {
    // Use Kathmandu as default center
    const traffic = await TrafficService.getTrafficData(27.7172, 85.3240, 50);

    res.json({
      success: true,
      data: {
        summary: traffic.summary,
        lastUpdated: traffic.lastUpdated,
        wazeAlertCount: traffic.wazeAlerts.length,
        congestedCount: traffic.summary.congestedSegments
      }
    });
  } catch (err: any) {
    logError("[TrafficController] getTrafficSummary failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * POST /traffic/refresh
 * Manually refresh traffic cache
 */
export const refreshTraffic = async (_req: Request, res: Response) => {
  try {
    TrafficService.clearTrafficCache();
    logInfo("[TrafficController] Traffic cache cleared");

    res.json({
      success: true,
      message: "Traffic cache cleared. Next request will fetch fresh data."
    });
  } catch (err: any) {
    logError("[TrafficController] refreshTraffic failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * GET /traffic/alerts?lat=&lng=&radius=
 * Get Waze traffic alerts only
 */
export const getTrafficAlerts = async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius } = req.query;

    const traffic = await TrafficService.getTrafficData(
      Number(lat) || 27.7172,
      Number(lng) || 85.3240,
      Number(radius) || 10
    );

    res.json({
      success: true,
      count: traffic.wazeAlerts.length,
      data: traffic.wazeAlerts
    });
  } catch (err: any) {
    logError("[TrafficController] getTrafficAlerts failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
