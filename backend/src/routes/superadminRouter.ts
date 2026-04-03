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

const router = Router();

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
