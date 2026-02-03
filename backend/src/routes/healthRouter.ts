// backend/src/routes/healthRouter.ts
import { Router, Request, Response } from "express";
import os from "os";
import { getCacheHealth, getUpstashUsage } from "../services/cacheService.js";

const router = Router();

/**
 * GET /api/health
 * Returns detailed system, cache, and Upstash connectivity status
 */
router.get("/", async (_req: Request, res: Response) => {
  let cacheReport: any = { status: "UNKNOWN" };
  let liveUsage: any = "Stats API key missing or invalid";

  try {
    // 1️⃣ Hybrid Cache status (L1 + L2)
    const stats = getCacheHealth();
    cacheReport = {
      status: stats.status,
      l1_items: stats.l1_items,
      l2_items: stats.l2_items,
      circuit_breaker: stats.circuit_breaker
    };

    // 2️⃣ Upstash management API check
    const upstashStats = await getUpstashUsage();
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;

    let upstashReachable = false;
    if (upstashUrl) {
      try {
        const response = await fetch(upstashUrl, { method: "GET" });
        upstashReachable = response.ok;
      } catch {
        upstashReachable = false;
      }
    }

    cacheReport.upstash_reachable = upstashReachable;

    if (upstashStats) {
      liveUsage = {
        commands_today: upstashStats.daily_net_commands || 0,
        reads: upstashStats.daily_read_requests || 0,
        writes: upstashStats.daily_write_requests || 0,
        limit: 10000,
      };
    }
  } catch (err: any) {
    cacheReport.status = "ERROR";
    liveUsage = { error: err.message };
  }

  // Determine overall status
  const systemStatus = 
    cacheReport.status.includes("HEALTHY") ? "operational" : "degraded";

  res.json({
    success: true,
    status: systemStatus,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    cache: {
      ...cacheReport,
      live_usage: liveUsage,
    },
    system: {
      load: os.loadavg(),
      memory: {
        free: Math.round(os.freemem() / 1024 / 1024) + "MB",
        total: Math.round(os.totalmem() / 1024 / 1024) + "MB",
      },
    },
  });
});

export default router;
