// backend/src/controllers/searchController.ts
import { Request, Response } from "express";
import { searchEntities, SearchResult } from "../services/searchService.js";

/**
 * @route   GET /api/search
 * @desc    Unified search: roads, traffic, POIs, locations, weather
 * @access  Public
 * @query   q: string (search term)
 * @query   limit: number (optional, default 10)
 */
export const handleSearch = async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
    }

    const maxResults = limit ? parseInt(String(limit), 10) : 10;

    const results: SearchResult[] = await searchEntities(q, maxResults);

    return res.status(200).json({
      success: true,
      query: q,
      count: results.length,
      data: results
    });
  } catch (err: any) {
    console.error("[SearchController] Error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
