// backend/src/routes/trafficRouter.ts
import { Router } from "express";
import * as trafficController from "../controllers/trafficController.js";

const router = Router();

// -----------------------------
// Nearby incidents within a radius (km)
// Example: /traffic/incidents?lat=27.7&lng=85.3&radius=5
// -----------------------------
router.get("/incidents", trafficController.findNearbyIncidents);

// -----------------------------
// Nearby roads within ~2 km
// Example: /traffic/nearby?lat=27.7&lng=85.3
// -----------------------------
router.get("/nearby", trafficController.getNearbyTraffic);

// -----------------------------
// Road status by refno
// Example: /traffic/road/NH01
// -----------------------------
router.get("/road/:refno", trafficController.getRoadStatus);

// -----------------------------
// Highway traffic by refno (includes live flow)
// Example: /traffic/highway/NH01
// -----------------------------
router.get("/highway/:refno", trafficController.getHighwayTraffic);

// -----------------------------
// Unified traffic summary (all roads)
// Example: /traffic/summary
// -----------------------------
router.get("/summary", trafficController.getUnifiedTrafficStatus);

export default router;
