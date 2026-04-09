// backend/src/controllers/analyticsController.ts
import { Request, Response } from "express";
import * as AnalyticsService from "../services/analyticsService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/v1/analytics/summary
 * Get analytics summary for dashboard
 */
export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const summary = await AnalyticsService.getAnalyticsSummary(
      (period as "7d" | "30d" | "90d") || "7d"
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    logError("[AnalyticsController] getAnalyticsSummary failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get analytics summary",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/analytics/trends
 * Get trend analysis
 */
export const getTrends = async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const trends = await AnalyticsService.getTrendAnalysis(
      (period as "7d" | "30d" | "90d") || "7d"
    );

    if (!trends) {
      return res.status(404).json({
        success: false,
        message: "Not enough data for trend analysis",
      });
    }

    res.json({
      success: true,
      data: trends,
    });
  } catch (err: any) {
    logError("[AnalyticsController] getTrends failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get trends",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/analytics/districts
 * Get most affected districts
 */
export const getTopDistricts = async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const districts = await AnalyticsService.getMostAffectedDistricts(
      parseInt(limit as string) || 10
    );

    res.json({
      success: true,
      data: districts,
    });
  } catch (err: any) {
    logError("[AnalyticsController] getTopDistricts failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get districts",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/analytics/highways
 * Get most affected highways
 */
export const getTopHighways = async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const highways = await AnalyticsService.getMostAffectedHighways(
      parseInt(limit as string) || 10
    );

    res.json({
      success: true,
      data: highways,
    });
  } catch (err: any) {
    logError("[AnalyticsController] getTopHighways failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get highways",
      error: err.message,
    });
  }
};

/**
 * POST /api/v1/analytics/snapshot
 * Capture manual snapshot
 */
export const captureSnapshot = async (req: Request, res: Response) => {
  try {
    const snapshot = await AnalyticsService.captureSnapshot();

    if (!snapshot) {
      return res.status(500).json({
        success: false,
        message: "Failed to capture snapshot",
      });
    }

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (err: any) {
    logError("[AnalyticsController] captureSnapshot failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to capture snapshot",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/analytics/daily/:date
 * Get daily analytics
 */
export const getDailyAnalytics = async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const dateStr = Array.isArray(date) ? date[0] : date;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    const analytics = await AnalyticsService.getDailyAnalytics(dateStr);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: "No data available for this date",
      });
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (err: any) {
    logError("[AnalyticsController] getDailyAnalytics failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to get daily analytics",
      error: err.message,
    });
  }
};
