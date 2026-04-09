// backend/src/routes/etaRouter.ts
import { Router } from "express";
import * as ETAController from "../controllers/etaController.js";
import { validateQuery } from "../middleware/validation.js";

const router = Router();

// Calculate ETA
router.post("/calculate", ETAController.calculateETA);
router.post("/quick", ETAController.getQuickETA);

export default router;
