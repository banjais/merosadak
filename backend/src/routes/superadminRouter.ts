import { Router } from "express";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";
import { getLogs, handleManualRefresh, downloadReport, getSystemStats, broadcastSystemMessage } from "../controllers/superadminController.js";

const router = Router();

// 🔐 All routes require JWT
router.use(authenticateJWT);

// 📊 Live Dashboard stats
router.get("/stats", authorizeRole("admin", "superadmin"), getSystemStats);

// 🟢 Fetch logs
router.get("/logs", authorizeRole("admin", "superadmin"), getLogs);

// 🔴 Manual Full Sync
router.post("/refresh", authorizeRole("superadmin"), handleManualRefresh);

// 📈 PDF Report
router.get("/report/download", authorizeRole("superadmin"), downloadReport);

// 📢 System Broadcast
router.post("/broadcast", authorizeRole("superadmin"), broadcastSystemMessage);

export default router;
