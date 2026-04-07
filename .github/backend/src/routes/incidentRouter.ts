// backend/src/routes/incidentRouter.ts
import { Router, Request, Response } from "express";
import { logInfo, logError } from "../logs/logs.js";

const router = Router();

interface IncidentReport {
  type: string;
  description: string;
  lat: number;
  lng: number;
  timestamp?: string;
}

/**
 * POST /incidents
 * Submit a new incident report from users
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { type, description, lat, lng, timestamp }: IncidentReport = req.body;

    if (!type || !description || !lat || !lng) {
      res.status(400).json({
        success: false,
        error: "Type, description, and location are required",
      });
      return;
    }

    // Validate lat/lng ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({
        success: false,
        error: "Invalid coordinates",
      });
      return;
    }

    const incident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      lat,
      lng,
      timestamp: timestamp || new Date().toISOString(),
      status: "pending",
      source: "user_report",
    };

    logInfo("User incident report received", { 
      incidentId: incident.id, 
      type, 
      location: { lat, lng } 
    });

    // In production, save to database and/or broadcast via WebSocket
    // For now, log and return success

    res.json({
      success: true,
      data: incident,
      message: "Incident reported successfully. Thank you for helping other travelers!",
    });
  } catch (error: any) {
    logError("Incident report error", { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /incidents
 * Get recent user-reported incidents (for admin/dashboard)
 */
router.get("/", async (_req: Request, res: Response) => {
  // Mock response - in production, query from database
  const incidents = [
    {
      id: "incident_1",
      type: "blockage",
      description: "Landslide blocking road near Mugling",
      lat: 27.755,
      lng: 84.425,
      timestamp: new Date().toISOString(),
      status: "verified",
      source: "user_report",
    },
  ];

  res.json({
    success: true,
    data: incidents,
  });
});

/**
 * GET /incidents/types
 * Get available incident types for reporting
 */
router.get("/types", async (_req: Request, res: Response) => {
  const types = [
    { id: "blockage", name: "Road Block", description: "Road completely blocked" },
    { id: "accident", name: "Accident", description: "Traffic accident" },
    { id: "traffic", name: "Heavy Traffic", description: "Significant traffic congestion" },
    { id: "construction", name: "Construction", description: "Road work in progress" },
    { id: "weather", name: "Weather Hazard", description: "Weather-related road hazard" },
    { id: "other", name: "Other", description: "Other incident type" },
  ];

  res.json({
    success: true,
    data: types,
  });
});

export default router;