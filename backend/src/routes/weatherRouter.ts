// backend/src/routes/weatherRouter.ts
import { Router, Request, Response } from "express";
import * as weatherController from "../controllers/weatherController.js";

const router = Router();

// -----------------------------
// GET /api/weather
// Fetch current weather (temperature, precipitation, etc.)
// -----------------------------
router.get("/", weatherController.getCurrentWeather);

export default router;
