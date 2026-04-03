// backend/src/routes/boundaryRouter.ts
import { Router } from "express";
import { getBoundary } from "../controllers/boundaryController.js";

const router = Router();

/**
 * GET /api/boundary
 * Returns the GeoJSON boundary for frontend maps
 */
router.get("/", getBoundary);

export default router;
