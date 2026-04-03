import { Router } from "express";
import { GeminiController } from "../controllers/geminiController.js";
// If you have an authorization middleware, import it here
// import { authenticate } from "../middleware/auth.js";

const router = Router();

/**
 * @route   POST /api/gemini/query
 * @desc    Send a prompt to the Gemini AI
 * @access  Public (or Protected if you add middleware)
 */
router.post("/query", GeminiController.handleQuery);

/**
 * @route   GET /api/gemini/usage
 * @desc    Get current API usage stats
 */
router.get("/usage", GeminiController.getUserUsage);

/**
 * @route   GET /api/gemini/logs
 * @desc    Get AI request logs
 */
router.get("/logs", GeminiController.getLogs);

export default router;