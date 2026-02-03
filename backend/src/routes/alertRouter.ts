// backend/src/routes/alertRouter.ts
import { Router } from "express";
import { getAlerts } from "../services/alertService.js";

const router = Router();

// GET all active safety alerts
router.get("/", async (req, res) => {
  try {
    const alerts = await getAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

export default router;
