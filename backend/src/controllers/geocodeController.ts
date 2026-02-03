import { Request, Response } from "express";
import { searchLocation } from "../services/searchService.js";
import { logError } from "../logs/logs.js";

export const handleSearch = async (req: Request, res: Response) => {
  const { q } = req.query;

  try {
    if (!q) return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });

    const results = await searchLocation(q as string);
    res.json({ success: true, results });
  } catch (err: any) {
    logError("[geocodeController] Search failed", { error: err.message });
    res.status(500).json({ success: false, message: "Geocoding service failed" });
  }
};
