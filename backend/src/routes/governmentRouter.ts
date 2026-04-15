// backend/src/routes/governmentRouter.ts
import { Router, Request, Response } from "express";

const router = Router();

/**
 * POST /government/log
 * Log government traffic policy execution actions for audit trail.
 * Stores action metadata (road, message, priority, timestamp) for analytics.
 */
router.post("/log", async (req: Request, res: Response) => {
  try {
    const action = req.body;

    // Validate required fields
    if (!action.road || !action.message) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: road, message"
      });
    }

    // Log the action (in production, this would go to a database)
    const logEntry = {
      id: `gov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...action,
      timestamp: new Date().toISOString(),
      status: "logged"
    };

    console.log("📋 [Government Log]", JSON.stringify(logEntry, null, 2));

    // In production: await db.governmentActions.create(logEntry);

    res.json({
      success: true,
      data: logEntry,
      message: "Government action logged successfully"
    });
  } catch (err: any) {
    console.error("[GovernmentRouter] Error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
