// backend/src/routes/boundaryRouter.ts
import { Router } from "express";
import { getNepalBoundary } from "../controllers/boundaryController.js";

const router = Router();

/**
 * GET /api/boundary
 * Returns Nepal boundary GeoJSON for map display
 */
router.get("/", getNepalBoundary);

export default router;