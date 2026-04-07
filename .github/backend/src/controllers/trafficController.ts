// backend/src/controllers/trafficController.ts
import { Request, Response } from "express";
import { logError } from "../logs/logs.js";
import { getCachedRoads } from "../services/roadService.js";
import { trafficService } from "../services/trafficService.js";
import { ROAD_STATUS } from "../constants/sheets.js";

/**
 * Approx distance in KM (fast & good enough)
 */
function approxKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dx = (lat1 - lat2) * 111;
  const dy = (lng1 - lng2) * 111;
  return Math.sqrt(dx * dx + dy * dy);
}

function getFirstCoord(feature: any): [number, number] | null {
  const g = feature.geometry;
  if (!g) return null;

  if (g.type === "Point") return g.coordinates; // Added Point support
  if (g.type === "LineString") return g.coordinates[0];
  if (g.type === "MultiLineString") return g.coordinates[0][0];
  return null;
}

// -----------------------------
// Nearby Incidents
// -----------------------------
export const findNearbyIncidents = async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius ?? 5);

    if (isNaN(lat) || isNaN(lng))
      return res.status(400).json({ error: "lat/lng required" });

    const roads = await getCachedRoads();
    const nearby = roads.merged.filter((f) => {
      if (!f.properties || f.properties.status === ROAD_STATUS.RESUMED) return false;
      const coord = getFirstCoord(f);
      if (!coord) return false;
      return approxKm(lat, lng, coord[1], coord[0]) <= radius;
    });

    res.json({ count: nearby.length, incidents: nearby });
  } catch (err: any) {
    logError("findNearbyIncidents failed", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// -----------------------------
// Nearby Roads
// -----------------------------
export const getNearbyTraffic = async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (isNaN(lat) || isNaN(lng))
      return res.status(400).json({ error: "lat/lng required" });

    const roads = await getCachedRoads();
    const nearby = roads.merged.filter((f) => {
      const coord = getFirstCoord(f);
      if (!coord) return false;
      return approxKm(lat, lng, coord[1], coord[0]) <= 2;
    });

    res.json({ count: nearby.length, roads: nearby });
  } catch (err: any) {
    logError("getNearbyTraffic failed", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// -----------------------------
// Road status by refno
// -----------------------------
export const getRoadStatus = async (req: Request, res: Response) => {
  try {
    const { refno } = req.params;
    const roads = await getCachedRoads();
    const road = roads.merged.find((r) => r.properties && r.properties.road_refno === refno);
    res.json({ refno, road });
  } catch (err: any) {
    logError("getRoadStatus failed", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// -----------------------------
// Highway traffic by refno (new, includes live flow)
// -----------------------------
export const getHighwayTraffic = async (req: Request, res: Response) => {
  try {
    const { refno } = req.params;
    const roads = await getCachedRoads();
    const road = roads.merged.find((r) => r.properties && r.properties.road_refno === refno);

    if (!road) return res.status(404).json({ error: "Road not found" });

    // Get traffic flow at first coordinate (optional)
    const coord = getFirstCoord(road);
    let flow = null;
    if (coord) {
      flow = await trafficService.getTrafficFlow(coord[1], coord[0]);
    }

    res.json({ refno, road, flow });
  } catch (err: any) {
    logError("getHighwayTraffic failed", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// -----------------------------
// Unified summary
// -----------------------------
export const getUnifiedTrafficStatus = async (_req: Request, res: Response) => {
  try {
    const roads = await getCachedRoads();
    res.json({
      total: roads.merged.length,
      blocked: roads.merged.filter((f) => f.properties?.status === ROAD_STATUS.BLOCKED).length,
      oneLane: roads.merged.filter((f) => f.properties?.status === ROAD_STATUS.ONE_LANE).length,
      resumed: roads.merged.filter((f) => f.properties?.status === ROAD_STATUS.RESUMED).length,
    });
  } catch (err: any) {
    logError("getUnifiedTrafficStatus failed", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
