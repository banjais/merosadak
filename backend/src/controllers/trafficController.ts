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

/**
 * GET /traffic/nearby?lat=&lng=&radius=
 * Get nearby traffic incidents (alias for /flow for frontend compatibility)
 */
export const getTrafficNearby = async (req: Request, res: Response) => {
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

    // Return combined flow + alerts as "incidents" for frontend compatibility
    const incidents = [
      ...traffic.summary.map((s: any, i: number) => ({
        id: `flow-${i}`,
        type: 'traffic_flow',
        road_name: s.name || `Segment ${i}`,
        status: s.congestion || 'moderate',
        geometry: s.geometry || { coordinates: [0, 0] }
      })),
      ...traffic.wazeAlerts.map((a: any) => ({
        id: a.id || `alert-${Math.random().toString(36).substr(2, 9)}`,
        type: a.type || 'alert',
        road_name: a.street || a.city || 'Traffic Alert',
        status: a.type || 'incident',
        description: a.comment || '',
        geometry: a.geometry || { coordinates: [a.longitude || 0, a.latitude || 0] },
        lat: a.latitude || 0,
        lng: a.longitude || 0
      }))
    ];

    res.json({
      success: true,
      roads: incidents,
      features: incidents,
      incidents,
      lastUpdated: traffic.lastUpdated
    });
  } catch (err: any) {
    logError("[TrafficController] getTrafficNearby failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
