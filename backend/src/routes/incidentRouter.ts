// backend/src/routes/incidentRouter.ts
import { Router, Request, Response } from "express";
import { logInfo, logError } from "../logs/logs.js";
import { incidentLimiter } from "../middleware/rateLimiter.js";
import { validate, incidentSchema } from "../middleware/validation.js";

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
router.post(
  "/",
  incidentLimiter,
  validate(incidentSchema),
  async (req: Request, res: Response) => {
    try {
      const { type, description, lat, lng, timestamp, severity, images }: IncidentReport & { severity?: string; images?: string[] } = req.body;

      const incident = {
        id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        description,
        lat,
        lng,
        timestamp: timestamp || new Date().toISOString(),
        severity: severity || "medium",
        status: "pending",
        source: "user_report",
        images: images || [],
        votes: {
          up: 0,
          down: 0,
          verified: false,
        },
      };

      logInfo("User incident report received", {
        incidentId: incident.id,
        type,
        location: { lat, lng }
      });

      // Broadcast via WebSocket if available
      try {
        const { broadcastMapUpdate } = await import("../services/websocketService.js");
        broadcastMapUpdate("incidents");
      } catch {
        // WebSocket not available
      }

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
  }
);

/**
 * POST /incidents/:id/vote
 * Vote on an incident (community verification)
 */
router.post("/:id/vote", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;

    if (!vote || !["up", "down"].includes(vote)) {
      return res.status(400).json({
        success: false,
        error: "Vote must be 'up' or 'down'",
      });
    }

    logInfo("Incident vote received", {
      incidentId: id,
      vote,
    });

    // In production, store vote in database
    res.json({
      success: true,
      message: "Vote recorded",
      incidentId: id,
    });
  } catch (error: any) {
    logError("Incident vote error", { error: error.message });
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
      votes: { up: 12, down: 1, verified: true },
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