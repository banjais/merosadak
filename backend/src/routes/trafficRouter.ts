// backend/src/routes/trafficRouter.ts
import { Router } from "express";
import * as TrafficController from "../controllers/trafficController.js";

const router = Router();

/**
 * GET /traffic/flow
 * Get real-time traffic flow with colored polylines
 */
router.get("/flow", TrafficController.getTrafficFlow);

/**
 * GET /traffic/alerts
 * Get Waze traffic alerts
 */
router.get("/alerts", TrafficController.getTrafficAlerts);

/**
 * GET /traffic/summary
 * Get traffic summary
 */
router.get("/summary", TrafficController.getTrafficSummary);

/**
 * POST /traffic/refresh
 * Manually refresh traffic cache
 */
router.post("/refresh", TrafficController.refreshTraffic);

/**
 * GET /traffic/nearby
 * Get nearby traffic incidents (frontend compatibility alias)
 */
router.get("/nearby", TrafficController.getTrafficNearby);

export default router;
