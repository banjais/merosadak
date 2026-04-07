import { Router } from "express";
import * as WazeController from "../controllers/wazeController.js";

const router = Router();

// -----------------------------
// GET /api/waze
// Fetch live Waze alerts
// -----------------------------
router.get("/", WazeController.getWazeAlerts);

export default router;
