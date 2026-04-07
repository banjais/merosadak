// backend/src/routes/alertRouter.ts
import { Router } from "express";
import * as alertController from "../controllers/alertController.js";

const router = Router();

// -----------------------------
// GET /api/alerts
// Returns all active alerts, optional query ?lat=<number>&lng=<number> to filter nearby
// -----------------------------
router.get("/", alertController.getAlerts);

// -----------------------------
// POST /api/alerts/refresh
// Force refresh combined alerts cache
// Optional body: { lat, lng } to filter nearby
// -----------------------------
router.post("/refresh", alertController.refreshAlerts);

export default router;
