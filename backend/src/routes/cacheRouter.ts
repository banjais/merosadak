// backend/src/routes/cacheRouter.ts
import { Router } from "express";
import { listCache, handleClearCache, handleRefreshCache } from "../controllers/cacheController.js";

const router = Router();

/**
 * GET /api/cache
 * List all cache keys and stats
 */
router.get("/", listCache);

/**
 * POST /api/cache/refresh
 * Refresh specific cache (e.g., roads, weather, traffic)
 */
router.post("/refresh", handleRefreshCache);

/**
 * DELETE /api/cache/:key?
 * Clear cache for a specific key or all cache if no key provided
 */
router.delete("/:key?", handleClearCache);

export default router;
