// backend/src/routes/tripRouter.ts
import { Router, Request, Response } from "express";
import { planTrip, checkRoadStatus } from "../services/tripPlannerService.js";
import { logError, logInfo } from "@logs/logs.js";

const router = Router();

/**
 * GET /api/trip/:destination
 * Smart trip planner - get full travel info for a destination
 * 
 * Example: GET /api/trip/pokhara
 *          GET /api/trip/kathmandu
 *          GET /api/trip/NH01
 */
router.get("/:destination", async (req: Request, res: Response) => {
  try {
    const { destination } = req.params;
    const { lat, lng } = req.query;
    
    const userLocation = lat && lng ? { 
      lat: parseFloat(lat as string), 
      lng: parseFloat(lng as string) 
    } : undefined;
    
    const trip = await planTrip(destination, userLocation);
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Destination not found or road data unavailable",
      });
    }
    
    res.json({
      success: true,
      data: trip,
    });
  } catch (err: any) {
    logError("[TripRouter] Failed to plan trip", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to plan trip",
      error: err.message,
    });
  }
});

/**
 * GET /api/trip/:destination/status
 * Quick status check for destination
 */
router.get("/:destination/status", async (req: Request, res: Response) => {
  try {
    const { destination } = req.params;
    const status = await checkRoadStatus(destination);
    
    res.json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    logError("[TripRouter] Status check failed", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to check status",
    });
  }
});

export default router;