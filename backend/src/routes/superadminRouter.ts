// backend/src/routes/superadminRouter.ts
import { Router } from "express";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";
import {
  getLogs,
  handleManualRefresh,
  downloadReport,
  getSystemStats,
  broadcastSystemMessage
} from "../controllers/superadminController.js";
import packageJson from "../../package.json" with { type: "json" };

const router = Router();

// 📢 GET /api/superadmin/version - Public version check (no auth)
router.get("/version", (_req, res) => {
  res.json({
    version: packageJson.version || "1.0.0",
    required: false,
    releaseDate: new Date().toISOString()
  });
});

// 🔐 All routes require JWT authentication
router.use(authenticateJWT as any);

// 📊 GET /api/superadmin/stats - Live dashboard stats
router.get(
  "/stats",
  authorizeRole("admin", "superadmin"),
  getSystemStats
);

// 🟢 GET /api/superadmin/logs - Fetch system logs
router.get(
  "/logs",
  authorizeRole("admin", "superadmin"),
  getLogs
);

// 🔴 POST /api/superadmin/refresh - Manual full sync
router.post(
  "/refresh",
  authorizeRole("superadmin"),
  handleManualRefresh
);

// 📈 GET /api/superadmin/report/download - PDF report download
router.get(
  "/report/download",
  authorizeRole("superadmin"),
  downloadReport
);

// 📢 POST /api/superadmin/broadcast - Broadcast system message
router.post(
  "/broadcast",
  authorizeRole("superadmin"),
  broadcastSystemMessage
);

export default router;
