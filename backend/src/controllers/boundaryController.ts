// backend/src/controllers/boundaryController.ts
import { Request, Response } from "express";
import { getBoundaryData } from "../services/boundaryService.js";
import { logError } from "../logs/logs.js";

/**
 * GET /api/boundary/districts
 * Returns districts GeoJSON boundary data
 */
export const getDistricts = async (_req: Request, res: Response) => {
  try {
    const data = await getBoundaryData("districts");
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err: any) {
    logError("[BoundaryController] Failed to fetch districts data", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve districts data",
      error: err.message,
    });
  }
};

/**
 * GET /api/boundary/provinces
 * Returns provinces GeoJSON boundary data
 */
export const getProvinces = async (_req: Request, res: Response) => {
  try {
    const data = await getBoundaryData("provinces");
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err: any) {
    logError("[BoundaryController] Failed to fetch provinces data", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve provinces data",
      error: err.message,
    });
  }
};

/**
 * GET /api/boundary/local
 * Returns local level GeoJSON boundary data
 */
export const getLocal = async (_req: Request, res: Response) => {
  try {
    const data = await getBoundaryData("local");
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err: any) {
    logError("[BoundaryController] Failed to fetch local data", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve local data",
      error: err.message,
    });
  }
};

/**
 * GET /api/boundary/country
 * Returns Nepal country boundary (using provinces data)
 */
export const getCountry = async (_req: Request, res: Response) => {
  try {
    const data = await getBoundaryData("country");

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err: any) {
    logError("[BoundaryController] Failed to fetch country data", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve country data",
      error: err.message,
    });
  }
};