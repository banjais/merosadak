import { Request, Response } from "express";
import * as monsoonService from "../services/monsoonService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/monsoon/risk
 * Returns a list of road segments with their calculated landslide/monsoon risk.
 */
export const getRiskAssessment = async (req: Request, res: Response) => {
  try {
    const riskData = await monsoonService.calculateCurrentRisk();
    res.json({
      status: "success",
      timestamp: new Date().toISOString(),
      count: riskData.length,
      data: riskData
    });
  } catch (error: any) {
    logError("[monsoonController] Risk Assessment Failed", { message: error.message, stack: error.stack });
    res.status(500).json({
      status: "error",
      message: "Failed to calculate monsoon risks. Please check weather service connectivity.",
      details: error.message
    });
  }
};
