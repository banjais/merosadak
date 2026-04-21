// backend/src/routes/searchRouter.ts
import { Router } from "express";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/rateLimiter.js";
import { handleSearch, triggerSearchRefresh } from "../controllers/searchController.js";

const router = Router();

/**
 * 🌐 GET /api/search
 * Search across roads, POIs, traffic, or other datasets
 * Query parameters:
 *   - q: string (search term)
 *   - limit: number (optional, default 10)
 */
router.get("/", handleSearch);

/**
 * 🔄 POST /api/search/refresh
 * Manually triggers a search index rebuild
 * Requires superadmin role.
 */
router.post("/refresh", adminLimiter, authenticateJWT, authorizeRole("superadmin"), triggerSearchRefresh);

export default router;
