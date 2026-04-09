// backend/src/routes/webPushRouter.ts
import { Router } from "express";
import * as WebPushController from "../controllers/webPushController.js";

const router = Router();

// Push notification endpoints
router.post("/subscribe", WebPushController.subscribe);
router.post("/unsubscribe", WebPushController.unsubscribe);
router.put("/preferences", WebPushController.updatePreferences);

// Public endpoint for VAPID key
router.get("/vapid-public-key", WebPushController.getVapidPublicKey);

// Admin endpoint for stats
router.get("/stats", WebPushController.getPushStats);

export default router;
