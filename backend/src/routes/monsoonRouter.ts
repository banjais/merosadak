// backend/src/routes/monsoonRouter.ts
import { Router } from "express";
import { getRiskAssessment } from "../controllers/monsoonController.js"; // <-- ESM compatible

const router = Router();

// Endpoint: GET /api/monsoon/risk
router.get("/risk", getRiskAssessment);

export default router;
