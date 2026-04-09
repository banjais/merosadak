// backend/src/routes/analyticsRouter.ts
import { Router } from "express";
import * as AnalyticsController from "../controllers/analyticsController.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = Router();

// Public analytics endpoints
router.get("/summary", AnalyticsController.getAnalyticsSummary);
router.get("/trends", AnalyticsController.getTrends);
router.get("/districts", AnalyticsController.getTopDistricts);
router.get("/highways", AnalyticsController.getTopHighways);

// Admin-only analytics
router.get("/daily/:date", AnalyticsController.getDailyAnalytics);
router.post("/snapshot", authenticateJWT, authorizeRole("admin", "superadmin"), AnalyticsController.captureSnapshot);

export default router;
