// backend/src/controllers/roadController.ts
import { Request, Response } from "express";
import { getCachedRoads } from "@/services/roadService.js";
import { ROAD_STATUS } from "@/constants/sheets.js";
import { resolveLabel } from "@/services/labelUtils.js";

export const root = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "roads",
  });
};

export const getAllRoads = async (_req: Request, res: Response) => {
  try {
    const roads = await getCachedRoads();
    res.json(roads);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Simple search by road_refno, road_name, or district
 */
export const searchRoads = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").toLowerCase();
    const roads = await getCachedRoads();
    const results = roads.merged.filter(r => {
      const p = r.properties || {};
      const dist = resolveLabel(p.incidentDistrict) || "";
      const name = resolveLabel(p.road_name) || "";
      return (
        p.road_refno?.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        dist.toLowerCase().includes(q)
      );
    });
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all current incidents (Blocked / One-Lane)
 */
export const getIncidents = async (_req: Request, res: Response) => {
  try {
    const roads = await getCachedRoads();
    const incidents = roads.merged.filter(r =>
      r.properties && r.properties.status && [ROAD_STATUS.BLOCKED, ROAD_STATUS.ONE_LANE].includes(r.properties.status)
    );
    res.json(incidents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
