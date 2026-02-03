// backend/src/routes/cacheRouter.ts
import { Router } from "express";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";
import { listCache, handleClearCache } from "../controllers/cacheController.js";

const router = Router();

// 🔐 All cache routes are restricted to superadmins
router.use(authenticateJWT, authorizeRole("superadmin"));

/**
 * GET /api/cache
 * List all cache keys in the system
 */
router.get("/", listCache);

/**
 * DELETE /api/cache
 * Clear ALL cache entries
 */
router.delete("/", handleClearCache);

/**
 * DELETE /api/cache/:key
 * Clear a specific cache entry (e.g., /api/cache/roads_geojson)
 * Note: Removing '?' avoids PathError in modern routing.
 */
router.delete("/:key", handleClearCache);

export default router;
