import { Request, Response } from "express";
import { getHistoricalLogs, generateMasterReport } from "../services/superadminService.js";
import { forceRefresh } from "../services/schedulerService.js";
import { getUpstashUsage, getCacheStats } from "../services/cacheService.js";
import { logError, logInfo } from "../logs/logs.js";

/**
 * GET /api/superadmin/stats
 * Returns system stats, recent logs, cache info
 */
export const getSystemStats = async (req: Request, res: Response) => {
  try {
    const [logs, upstash, cache] = await Promise.all([
      getHistoricalLogs(20),
      getUpstashUsage(),
      getCacheStats()
    ]);

    res.json({
      success: true,
      data: {
        admin: req.user?.email,
        logs,
        upstash: upstash || { message: "Management API stats unavailable" },
        cache
      }
    });
  } catch (err: any) {
    logError("[superadminController] Failed to fetch system stats", { error: err.message });
    res.status(500).json({ success: false, message: "Could not retrieve system stats" });
  }
};

/**
 * GET /api/superadmin/logs?limit=100
 * Returns audit logs
 */
export const getLogs = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const logs = await getHistoricalLogs(limit);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    logError("[superadminController] Failed to fetch logs", { error: err.message });
    res.status(500).json({ success: false, message: "Could not retrieve logs" });
  }
};

/**
 * POST /api/superadmin/refresh
 * Triggers a manual force-refresh
 * Sends real-time progress via WebSocket (schedulerService broadcasts)
 */
export const handleManualRefresh = async (req: Request, res: Response) => {
  try {
    logInfo(`⚡ Manual Sync triggered by ${req.user?.email}`);

    // Start the refresh, scheduler broadcasts live progress to WS clients
    const summary = await forceRefresh();

    res.json({
      success: summary.success,
      message: summary.message,
      timestamp: summary.timestamp
    });
  } catch (err: any) {
    logError("[superadminController] Manual refresh failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Manual refresh failed: " + err.message
    });
  }
};

/**
 * GET /api/superadmin/report/download
 * Generates PDF report with audit logs, cache stats, and infrastructure health
 */
export const downloadReport = async (req: Request, res: Response) => {
  try {
    logInfo(`📄 PDF Report generation requested by ${req.user?.email}`);
    const buffer = await generateMasterReport();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=SadakSathi_Admin_Report_${new Date().toISOString()}.pdf`
    );
    res.send(buffer);
  } catch (err: any) {
    logError("[superadminController] PDF generation failed", { error: err.message });
    res.status(500).json({ success: false, message: "Internal error generating PDF report" });
  }
};

/**
 * POST /api/superadmin/broadcast
 * Sends a live system message to all WS clients
 */
export const broadcastSystemMessage = async (req: Request, res: Response) => {
  try {
    const { message, level = "info" } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    logInfo(`📢 System Broadcast by ${req.user?.email}: ${message}`);

    // Call the websocket service to broadcast
    const { broadcastLiveLog } = await import("../services/websocketService.js");
    broadcastLiveLog({
      type: "system",
      message: message,
      level: level,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: "Broadcast sent successfully" });
  } catch (err: any) {
    logError("[superadminController] Broadcast failed", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to send broadcast" });
  }
};
