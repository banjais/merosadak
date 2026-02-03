// backend/src/routes/boundaryRouter.ts
import { Router } from "express";
import { getBoundary } from "../controllers/boundaryController.js"; // ESM import

const router = Router();

/**
 * GET /api/boundary
 * Returns the GeoJSON boundary data (Nepal map shape) for the frontend
 */
router.get("/", getBoundary);

export default router;
