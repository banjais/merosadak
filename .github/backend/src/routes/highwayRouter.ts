// backend/src/routes/highwayRouter.ts
import { Router } from "express";
import * as highwayController from "../controllers/highwayController.js";

const router = Router();

/**
 * GET /api/highways
 * Returns list of available highways with metadata
 */
router.get("/", highwayController.getHighwayList);

/**
 * GET /api/highways/summary
 * Returns summary statistics for all highways (top 20)
 */
router.get("/summary", highwayController.getHighwaysSummary);

/**
 * GET /api/highways/alternatives?from=DistrictA&to=DistrictB
 * Suggests alternative routes based on road quality and conditions
 */
router.get("/alternatives", highwayController.getAlternativeRoutes);

/**
 * GET /api/highways/:code
 * Returns specific highway geojson by code (NH01, NH02, etc.)
 */
router.get("/:code", highwayController.getHighwayByCode);

/**
 * GET /api/highways/:code/report
 * Returns comprehensive highway statistics and report
 */
router.get("/:code/report", highwayController.getHighwayReport);

export default router;
