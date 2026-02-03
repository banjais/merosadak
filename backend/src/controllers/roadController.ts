import { Request, Response } from "express";
import { getCachedRoads, updateMasterFromSheet } from "../services/roadService.js";
import { withCache } from "../services/cacheService.js";
import { ROAD_STATUS } from "../constants/sheets.js";

export const getRoads = async (req: Request, res: Response) => {
  try {
    const { status, office, road_refno } = req.query;

    // Fetch cached master roads with 30-minute TTL
    const geojson = await withCache("api:roads:all", getCachedRoads, 1800);

    let features = geojson.features || [];

    // Apply optional filters
    if (status) {
      features = features.filter(f => f.properties.status === String(status).toUpperCase());
    }
    if (office) {
      features = features.filter(f => f.properties.div_name?.toLowerCase() === String(office).toLowerCase());
    }
    if (road_refno) {
      features = features.filter(f => f.properties.road_refno === String(road_refno).toUpperCase());
    }

    res.json({
      success: true,
      total: features.length,
      data: { ...geojson, features }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
};

export const getOfficeSummary = async (req: Request, res: Response) => {
  try {
    const geojson = await getCachedRoads();
    const summary: Record<string, { blocked: number; one_lane: number; resumed: number; total_segments: number }> = {};

    geojson.features.forEach((f: any) => {
      const office = f.properties.div_name || "Unknown Office";
      if (!summary[office]) summary[office] = { blocked: 0, one_lane: 0, resumed: 0, total_segments: 0 };

      const status = f.properties.status;
      if (status === ROAD_STATUS.BLOCKED) summary[office].blocked++;
      else if (status === ROAD_STATUS.ONE_LANE) summary[office].one_lane++;
      else summary[office].resumed++;

      summary[office].total_segments++;
    });

    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
};

export const syncRoadsManual = async (req: Request, res: Response) => {
  try {
    const masterData = await updateMasterFromSheet();
    const activeIncidents = masterData.features.filter(f => f.properties.status !== ROAD_STATUS.RESUMED).length;

    res.json({
      success: true,
      message: "Sync completed successfully",
      matched: activeIncidents,
      totalSegments: masterData.features.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
};
