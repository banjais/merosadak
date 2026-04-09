// backend/src/controllers/etaController.ts
import { Request, Response } from "express";
import * as ETAService from "../services/etaService.js";
import { logError } from "../logs/logs.js";

/**
 * POST /api/v1/eta/calculate
 * Calculate ETA between two points
 */
export const calculateETA = async (req: Request, res: Response) => {
  try {
    const { origin, destination, options } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination with lat/lng are required",
      });
    }

    const eta = await ETAService.calculateETA(
      { lat: origin.lat, lng: origin.lng, name: origin.name },
      { lat: destination.lat, lng: destination.lng, name: destination.name },
      options
    );

    if (!eta) {
      return res.status(500).json({
        success: false,
        message: "Failed to calculate ETA",
      });
    }

    res.json({
      success: true,
      data: eta,
    });
  } catch (err: any) {
    logError("[ETAController] calculateETA failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to calculate ETA",
      error: err.message,
    });
  }
};

/**
 * POST /api/v1/eta/quick
 * Quick ETA calculation (simplified)
 */
export const getQuickETA = async (req: Request, res: Response) => {
  try {
    const { origin, destination } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination with lat/lng are required",
      });
    }

    const eta = await ETAService.getQuickETA(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng }
    );

    if (!eta) {
      return res.status(500).json({
        success: false,
        message: "Failed to calculate quick ETA",
      });
    }

    res.json({
      success: true,
      data: eta,
    });
  } catch (err: any) {
    logError("[ETAController] getQuickETA failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to calculate quick ETA",
      error: err.message,
    });
  }
};
