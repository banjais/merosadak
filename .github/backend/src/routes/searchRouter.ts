// backend/src/routes/searchRouter.ts
import { Router } from "express";
import { handleSearch } from "../controllers/searchController.js";

const router = Router();

/**
 * 🌐 GET /api/search
 * Search across roads, POIs, traffic, or other datasets
 * Query parameters:
 *   - q: string (search term)
 *   - limit: number (optional, default 10)
 */
router.get("/", handleSearch);

export default router;
