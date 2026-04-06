// backend/src/controllers/highwayController.ts
import { Request, Response } from "express";
import { 
  getHighwayList, 
  getHighwayByCode, 
  getHighwayReport, 
  getAllHighwaysSummary,
  suggestAlternativeRoutes 
} from "../services/highwayService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/highways
 * Returns list of available highways
 */
export const getHighwayList = async (_req: Request, res: Response) => {
  try {
    const highways = await getHighwayList();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: highways.length,
      data: highways,
    });
  } catch (err: any) {
    logError("[HighwayController] Failed to get highway list", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve highway list",
      error: err.message,
    });
  }
};

/**
 * GET /api/highways/:code
 * Returns specific highway geojson by code
 */
export const getHighwayByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const highway = await getHighwayByCode(code.toUpperCase());

    if (!highway) {
      return res.status(404).json({
        success: false,
        message: `Highway ${code} not found`,
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: highway,
    });
  } catch (err: any) {
    logError("[HighwayController] Failed to get highway by code", {
      code: req.params.code,
      error: err.message
    });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve highway data",
      error: err.message,
    });
  }
};

/**
 * GET /api/highways/:code/report
 * Returns comprehensive highway statistics and report
 */
export const getHighwayReport = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const report = await getHighwayReport(code.toUpperCase());
    
    if (report.error) {
      return res.status(404).json({
        success: false,
        message: report.error,
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: report,
    });
  } catch (err: any) {
    logError("[HighwayController] Failed to get highway report", {
      code: req.params.code,
      error: err.message
    });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve highway report",
      error: err.message,
    });
  }
};

/**
 * GET /api/highways/summary
 * Returns summary statistics for all highways (top 20)
 */
export const getHighwaysSummary = async (_req: Request, res: Response) => {
  try {
    const summary = await getAllHighwaysSummary();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: summary.length,
      data: summary,
    });
  } catch (err: any) {
    logError("[HighwayController] Failed to get highways summary", {
      error: err.message
    });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve highways summary",
      error: err.message,
    });
  }
};

/**
 * GET /api/highways/alternatives?from=DistrictA&to=DistrictB
 * Suggests alternative routes based on road quality and conditions
 */
export const getAlternativeRoutes = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Missing 'from' or 'to' district parameter",
      });
    }

    const alternatives = await suggestAlternativeRoutes(
      String(from), 
      String(to)
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: alternatives.length,
      data: alternatives,
    });
  } catch (err: any) {
    logError("[HighwayController] Failed to get alternative routes", {
      error: err.message
    });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve alternative routes",
      error: err.message,
    });
  }
};
