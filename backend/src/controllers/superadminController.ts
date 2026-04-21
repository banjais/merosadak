import { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { getHistoricalLogs, generateMasterReport, cleanupSearchLogs } from "../services/superadminService.js";
import { forceRefresh } from "../services/schedulerService.js";
import { getUpstashUsage, getCacheStats } from "../services/cacheService.js";
import { logError, logInfo } from "../logs/logs.js";
import { addGeofenceZone, removeGeofenceZone, saveGeofences, getAllGeofences, type GeofenceZone } from "../services/geofenceService.js";
import { asyncHandler } from "../middleware/errorHandler.js";

/**
 * GET /api/superadmin/stats
 * Returns system stats, recent logs, cache info
 */
export const getSystemStats = asyncHandler(async (req: AuthRequest, res: Response) => {
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
});

/**
 * GET /api/superadmin/logs?limit=100
 * Returns audit logs
 */
export const getLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsedLimit = parseInt(String(req.query.limit));
  const limit = isNaN(parsedLimit) ? 100 : parsedLimit;
  const logs = await getHistoricalLogs(limit);
  res.json({ success: true, data: logs });
});

/**
 * POST /api/superadmin/refresh
 * Triggers a manual force-refresh
 * Sends real-time progress via WebSocket (schedulerService broadcasts)
 */
export const handleManualRefresh = asyncHandler(async (req: AuthRequest, res: Response) => {
  logInfo(`⚡ Manual Sync triggered by ${req.user?.email}`);
  const summary = await forceRefresh();
  res.json({
    success: summary.success,
    message: summary.message,
    timestamp: summary.timestamp
  });
});

/**
 * GET /api/superadmin/report/download
 * Generates PDF report with audit logs, cache stats, and infrastructure health
 */
export const downloadReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  logInfo(`📄 PDF Report generation requested by ${req.user?.email}`);
  const buffer = await generateMasterReport();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=MeroSadak_Admin_Report_${new Date().toISOString()}.pdf`
  );
  res.send(buffer);
});

/**
 * POST /api/superadmin/broadcast
 * Sends a live system message to all WS clients
 */
export const broadcastSystemMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { message, level = "info" } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }

  logInfo(`📢 System Broadcast by ${req.user?.email}: ${message}`);

  const { broadcastLiveLog } = await import("../services/websocketService.js");
  broadcastLiveLog({ type: "system", message, level });

  res.json({ success: true, message: "Broadcast sent successfully" });
});

/**
 * POST /api/superadmin/cleanup/search
 * Cleans up old search history entries to manage storage
 * Body: { days: number } - defaults to 30
 */
export const handleSearchCleanup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsedDays = parseInt(String(req.body.days));
  const days = isNaN(parsedDays) ? 30 : parsedDays;
  logInfo(`🧹 Search history cleanup triggered by ${req.user?.email} (Older than ${days} days)`);
  const deletedCount = await cleanupSearchLogs(days);

  res.json({
    success: true,
    message: "Search history cleanup completed",
    data: { deletedCount, retentionDays: days }
  });
});

/**
 * GET /api/superadmin/geofence
 * Lists all geofence zones (active and inactive) from the persistent store
 */
export const handleListGeofences = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const zones = getAllGeofences();
  res.json({
    success: true,
    data: zones
  });
});

/**
 * POST /api/superadmin/geofence
 * Manually adds a new geofence zone and persists it to disk
 */
export const handleAddGeofence = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Data is pre-validated by geofenceZoneSchema
  const zoneData = req.body as GeofenceZone;

  logInfo(`🛡️ Adding new geofence zone: ${zoneData.name} by ${req.user?.email}`);

  addGeofenceZone(zoneData);
  await saveGeofences();

  res.status(201).json({
    success: true,
    message: "Geofence zone added and persisted successfully",
    data: zoneData
  });
});

/**
 * DELETE /api/superadmin/geofence/:id
 * Removes a geofence zone and persists changes to disk
 */
export const handleRemoveGeofence = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: "Geofence ID is required" });
  }

  logInfo(`🛡️ Removing geofence zone: ${id} by ${req.user?.email}`);

  const success = removeGeofenceZone(id);
  if (!success) {
    return res.status(404).json({ success: false, message: "Geofence zone not found" });
  }

  await saveGeofences();

  res.json({
    success: true,
    message: "Geofence zone removed and persisted successfully"
  });
});
