// backend/src/routes/uptimeRouter.ts
import { Router, Request, Response } from "express";
import { getUptimeRobotStatus } from "../services/uptimeRobotService.js";
import { UPTIMEROBOT_STATUS_PAGE } from "../config/index.js";

const router = Router();

/**
 * GET /api/v1/monitoring/status
 * Returns UptimeRobot monitoring status and stats
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = await getUptimeRobotStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/v1/monitoring/uptime
 * Returns overall uptime percentage
 */
router.get("/uptime", async (_req: Request, res: Response) => {
  try {
    const status = await getUptimeRobotStatus();
    res.json({
      success: true,
      data: {
        overallUptime: status.overallUptime,
        status: status.status,
        lastUpdated: status.lastUpdated,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/v1/monitoring/public-status
 * Returns public status page URL (no auth required)
 */
router.get("/public-status", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      statusPage: UPTIMEROBOT_STATUS_PAGE,
      message: "View detailed uptime statistics on our public status page",
    },
  });
});

export default router;
