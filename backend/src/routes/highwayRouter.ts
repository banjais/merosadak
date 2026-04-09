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
 * GET /api/highways/:code/report
 * Returns comprehensive highway statistics and report
 * ⚠️ MUST be defined BEFORE /:code route to prevent route shadowing
 */
router.get("/:code/report", highwayController.getHighwayReport);

/**
 * GET /api/highways/:code/linked
 * Returns highway data linked from multiple sources (districts, provinces, local)
 * ⚠️ MUST be defined BEFORE /:code route to prevent route shadowing
 */
router.get("/:code/linked", highwayController.getHighwayLinkedData);

/**
 * GET /api/highways/:code/incidents
 * Returns fast incident data for a specific highway
 * ⚠️ MUST be defined BEFORE /:code route to prevent route shadowing
 */
router.get("/:code/incidents", highwayController.getHighwayIncidents);

/**
 * GET /api/highways/:code
 * Returns specific highway geojson by code (NH01, NH02, etc.)
 * ⚠️ MUST be defined AFTER all /:code/* routes to prevent route shadowing
 */
router.get("/:code", highwayController.getHighwayByCode);

export default router;
