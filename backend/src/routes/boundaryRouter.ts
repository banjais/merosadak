// backend/src/routes/boundaryRouter.ts
import { Router } from "express";
import * as boundaryController from "../controllers/boundaryController.js";

const router = Router();

/**
 * GET /api/boundary/districts
 * Returns districts GeoJSON boundary data
 */
router.get("/districts", boundaryController.getDistricts);

/**
 * GET /api/boundary/provinces
 * Returns provinces GeoJSON boundary data
 */
router.get("/provinces", boundaryController.getProvinces);

/**
 * GET /api/boundary/local
 * Returns local level GeoJSON boundary data
 */
router.get("/local", boundaryController.getLocal);

/**
 * GET /api/boundary/country
 * Returns Nepal country boundary (fallback - empty for now)
 */
router.get("/country", boundaryController.getCountry);

export default router;