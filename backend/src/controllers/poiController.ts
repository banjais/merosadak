import { Request, Response } from "express";
import { searchPOIs, POIResult } from "../services/poiService.js";

/**
 * @route   GET /api/pois
 * @desc    Search Points of Interest (Petrol, Hospitals, Tourist Spots, etc.)
 * @access  Public
 * @query   q: string (search query)
 * @query   lat: number (user latitude)
 * @query   lng: number (user longitude)
 */
export const handleGetPOI = async (req: Request, res: Response) => {
  try {
    // --- Extract and sanitize query parameters ---
    const query = String(req.query.q || "").trim();
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!query || Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: "Valid query (q), latitude (lat), and longitude (lng) are required."
      });
    }

    // --- Delegate all logic to poiService ---
    const results: POIResult[] = await searchPOIs(query, lat, lng);

    // --- Return structured response ---
    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (err: any) {
    console.error("❌ [POI Controller] Error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error"
    });
  }
};
