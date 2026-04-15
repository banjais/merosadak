// backend/src/routes/aiUIRouter.ts
import { Router, Request, Response } from "express";

const router = Router();

/**
 * POST /ai/ui
 * Generate adaptive UI based on context (weather, traffic, location, user mode)
 * Returns a UIScreen schema that the frontend can render dynamically.
 * This is a smart fallback — frontend AI UI engine calls this for dynamic adaptation.
 */
router.post("/ui", async (req: Request, res: Response) => {
  try {
    const { weather, traffic, location, incidentLevel, userMode } = req.body;

    // Default dark theme; switch to light if weather is clear and it's daytime
    const isClear = weather?.toLowerCase().includes("clear") || weather?.toLowerCase().includes("sunny");
    const theme = isClear ? "light" : "dark";

    // Build adaptive layout based on context
    const layout: any[] = [];

    // Incident severity determines card prominence
    if (incidentLevel === "high" || incidentLevel === "extreme") {
      layout.push({
        type: "alert_banner",
        priority: "critical",
        message: `⚠️ High risk detected in ${location || "your area"}`,
        actions: ["reroute", "share_status", "emergency_contacts"]
      });
    }

    // Traffic conditions
    if (traffic?.toLowerCase().includes("heavy") || traffic?.toLowerCase().includes("congestion")) {
      layout.push({
        type: "traffic_card",
        severity: "warning",
        message: traffic,
        actions: ["alternative_routes", "eta_update"]
      });
    }

    // Weather advisory
    if (weather && !weather.toLowerCase().includes("clear")) {
      layout.push({
        type: "weather_card",
        severity: weather.toLowerCase().includes("rain") || weather.toLowerCase().includes("storm") ? "high" : "medium",
        message: weather,
        icon: "weather"
      });
    }

    // Default dashboard for normal mode
    if (userMode === "normal" && layout.length === 0) {
      layout.push(
        { type: "map_view", center: "current_location", zoom: 12 },
        { type: "quick_actions", actions: ["navigate", "report", "layers"] },
        { type: "nearby_services", categories: ["fuel", "hospital", "food"] }
      );
    }

    // Driver mode: simplified, large UI
    if (userMode === "driver") {
      layout.push({
        type: "driver_mode",
        largeControls: true,
        voiceEnabled: true,
        minimizeDistractions: true
      });
    }

    res.json({
      success: true,
      data: {
        type: "SCREEN",
        theme,
        layout,
        generatedAt: new Date().toISOString(),
        context: { weather, traffic, location, incidentLevel, userMode }
      }
    });
  } catch (err: any) {
    console.error("[AIUIRouter] Error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      fallback: {
        type: "SCREEN",
        theme: "dark",
        layout: [{ type: "map_view" }]
      }
    });
  }
});

export default router;
