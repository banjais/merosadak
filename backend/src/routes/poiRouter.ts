// backend/src/routes/poiRouter.ts
import { Router, Request, Response } from "express";
import * as poiService from "../services/poiService.js";

const router = Router();

// -----------------------------
// GET /api/pois
// Search for POIs (Petrol, Hospitals, Tourist Spots, etc.)
// Query params: q (string), lat (number), lng (number)
// -----------------------------
router.get("/", async (req: Request, res: Response) => {
  try {
    const { q, lat, lng } = req.query;

    const query = (q as string) || "hospital";
    const latNum = lat ? parseFloat(lat as string) : 27.7172;
    const lngNum = lng ? parseFloat(lng as string) : 85.3240;

    const pois = await poiService.getNearbyPOIs(latNum, lngNum, query);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: pois.length,
      data: pois,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch POIs",
      error: err.message,
    });
  }
});

// -----------------------------
// Future endpoints can be added easily
// e.g., GET /api/pois/:id -> handleGetPOIDetails
// -----------------------------

export default router;
