// backend/src/routes/monsoonRouter.ts
import { Router, Request, Response } from "express";
import * as monsoonService from "../services/monsoonService.js";

const router = Router();

// -----------------------------
// GET /api/monsoon/risk
// Returns current or cached monsoon risk assessments
// -----------------------------
router.get("/risk", async (_req: Request, res: Response) => {
  try {
    // 1️⃣ Try cached risk first
    let risk = await monsoonService.getCachedMonsoonRisk();

    // 2️⃣ Fallback to fresh calculation if cache is empty
    if (!risk || risk.length === 0) {
      risk = await monsoonService.calculateCurrentRisk();
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: risk.length,
      data: risk,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch monsoon risk",
      error: err.message,
    });
  }
});

export default router;
