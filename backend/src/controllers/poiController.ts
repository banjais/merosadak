import { Request, Response } from "express";
import { searchPOIs, POIResult } from "../services/poiService.js";

/**
 * Handle GET /api/pois
 */
export const handleGetPOI = async (req: Request, res: Response) => {
  try {
    const { q, lat, lng } = req.query;

    if (!q || !lat || !lng) {
      return res.status(400).json({
        success: false,
        error: "Query (q), Latitude (lat), and Longitude (lng) are required."
      });
    }

    const latitude = parseFloat(String(lat));
    const longitude = parseFloat(String(lng));

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: "Latitude and Longitude must be valid numbers."
      });
    }

    const results: POIResult[] = await searchPOIs(String(q), latitude, longitude);

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (err: any) {
    console.error("❌ [POI Controller] Error:", err.message || err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error"
    });
  }
};
