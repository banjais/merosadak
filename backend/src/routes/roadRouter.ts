import { Router } from "express";
import * as RoadController from "../controllers/roadController.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = Router();

/**
 * 🛣️ GET /api/roads
 * Fetch full GeoJSON roads data
 * Cache for 5 minutes in the browser
 */
router.get("/", (req, res, next) => {
  res.set("Cache-Control", "public, max-age=300");
  next();
}, RoadController.getRoads);

/**
 * 📊 GET /api/roads/summary
 * Summarized dashboard view by Division Office
 */
router.get("/summary", RoadController.getOfficeSummary);

/**
 * 🔄 POST /api/roads/sync
 * Admin-only manual sync from Google Sheets
 */
router.post(
  "/sync",
  authenticateJWT,
  authorizeRole("admin", "superadmin"),
  RoadController.syncRoadsManual
);

export default router;
