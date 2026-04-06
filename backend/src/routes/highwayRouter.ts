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
 * GET /api/highways/:code
 * Returns specific highway geojson by code (NH01, NH02, etc.)
 */
router.get("/:code", highwayController.getHighwayByCode);

export default router;