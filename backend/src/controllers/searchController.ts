// backend/src/controllers/searchController.ts
import { Request, Response } from "express";
import { searchEntities } from "../services/searchService.js";
import type { SearchResult } from "../types.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { withCache } from "../services/cacheService.js";

/**
 * @route   GET /api/search
 * @desc    Unified search: roads, traffic, POIs, locations, weather
 * @access  Public
 * @query   q: string (search term)
 * @query   limit: number (optional, default 10)
 */
export const handleSearch = asyncHandler(async (req: Request, res: Response) => {
  // Data is pre-validated and coerced by validation middleware (validateQuery)
  const { q, limit, lang } = req.query as any;

  // Generate a unique cache key based on query, limit, and language
  const cacheKey = `search:${lang}:${limit}:${String(q).toLowerCase().trim()}`;

  const results: SearchResult[] = await withCache(
    cacheKey,
    () => searchEntities(q, limit, lang),
    300 // Cache results for 5 minutes (300 seconds)
  );

  res.status(200).json({
    success: true,
    query: q,
    count: results.length,
    data: results
  });
});