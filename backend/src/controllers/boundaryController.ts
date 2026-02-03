import { Request, Response } from "express";
import { getBoundaryData } from "../services/boundaryService.js";
import { logError } from "../logs/logs.js";

export const getBoundary = async (req: Request, res: Response) => {
  try {
    const data = await getBoundaryData();
    return res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logError(`[boundaryController] Error: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to retrieve boundary data" });
  }
};
