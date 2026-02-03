// backend/src/routes/geocodeRouter.ts
import { Router } from "express";
import { handleSearch } from "../controllers/geocodeController.js";

const router = Router();

/**
 * GET /api/geocode/search
 * Search for coordinates via OSM Nominatim. 
 * Note: Rate limiting is now handled via logic in the geocodeService.
 */
router.get("/search", handleSearch);

export default router;