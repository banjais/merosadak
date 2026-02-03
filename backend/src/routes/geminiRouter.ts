// backend/src/routes/geminiRouter.ts
import { Router } from "express";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";
import * as GeminiController from "../controllers/geminiController.js"; // <-- ESM compatible

const router = Router();

// Apply Authentication to all Gemini AI routes
router.use(authenticateJWT);

/**
 * POST /api/gemini/query
 * Send a prompt to the AI. Usage tracking handled in controller.
 */
router.post("/query", GeminiController.handleQuery);

/**
 * GET /api/gemini/usage
 * Get current user's AI token usage stats
 */
router.get("/usage", GeminiController.getUserUsage);

/**
 * GET /api/gemini/logs
 * Strictly for superadmins to audit AI interactions
 */
router.get("/logs", authorizeRole("superadmin"), GeminiController.getLogs);

export default router;
