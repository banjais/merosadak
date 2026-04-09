// backend/src/controllers/routePlanningController.ts
import { Request, Response } from "express";
import * as RoutePlanningService from "../services/routePlanningService.js";
import { logError } from "../logs/logs.js";

/**
 * POST /api/v1/routes/plan
 * Plan route with alternatives
 */
export const planRoute = async (req: Request, res: Response) => {
  try {
    const { origin, destination, options } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination with lat/lng are required",
      });
    }

    const plan = await RoutePlanningService.planRoute(
      { lat: origin.lat, lng: origin.lng, name: origin.name },
      { lat: destination.lat, lng: destination.lng, name: destination.name },
      options
    );

    if (!plan) {
      return res.status(500).json({
        success: false,
        message: "Failed to plan route",
      });
    }

    res.json({
      success: true,
      data: plan,
    });
  } catch (err: any) {
    logError("[RoutePlanningController] planRoute failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to plan route",
      error: err.message,
    });
  }
};

/**
 * POST /api/v1/routes/compare
 * Compare two routes
 */
export const compareRoutes = async (req: Request, res: Response) => {
  try {
    const { origin, destination, route1Name, route2Name } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination with lat/lng are required",
      });
    }

    const comparison = await RoutePlanningService.compareRoutes(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
      route1Name || "Route 1",
      route2Name || "Route 2"
    );

    if (!comparison) {
      return res.status(404).json({
        success: false,
        message: "Not enough routes for comparison",
      });
    }

    res.json({
      success: true,
      data: comparison,
    });
  } catch (err: any) {
    logError("[RoutePlanningController] compareRoutes failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to compare routes",
      error: err.message,
    });
  }
};

/**
 * POST /api/v1/routes/safety
 * Get route safety details
 */
export const getRouteSafety = async (req: Request, res: Response) => {
  try {
    const { origin, destination } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination with lat/lng are required",
      });
    }

    const safety = await RoutePlanningService.getRouteSafety(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng }
    );

    if (!safety) {
      return res.status(500).json({
        success: false,
        message: "Failed to get route safety",
      });
    }

    res.json({
      success: true,
      data: safety,
    });
  } catch (err: any) {
    logError("[RoutePlanningController] getRouteSafety failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get route safety",
      error: err.message,
    });
  }
};
