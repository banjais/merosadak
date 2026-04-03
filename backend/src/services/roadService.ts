// backend/src/services/roadService.ts
import fs from "fs/promises";
import axios from "axios";
import path from "path";
import { CACHE_DIR, CACHE_ROAD, BASE_DATA } from "../config/paths.js";
import { OVERPASS_API_URL } from "../config/index.js";
import { logInfo, logError } from "../logs/logs.js";
import { withCache } from "./cacheService.js";
import type { LineString } from "geojson";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export interface RoadSegment {
  id: string;
  name: string;
  chainageStart?: number;
  chainageEnd?: number;
  geometry: GeoJSON.LineString | GeoJSON.Point;
  status: "Blocked" | "One-Lane" | "Resumed";
  source: "sheet" | "master" | "overpass";
  properties: {
    road_refno?: string;
    road_name?: string;
    incidentDistrict?: string;
    status?: string;
    [key: string]: any;
  };
}

/* ------------------------------------------------ */
/* MAIN: Cached Merged Roads                       */
/* ------------------------------------------------ */
export async function getCachedRoads(): Promise<{
  merged: RoadSegment[];
  raw: any[];
  rowIssues?: any[];
}> {
  return withCache("road:merged", async () => {
    let rawData: RoadSegment[] = [];
    let merged: RoadSegment[] = [];
    let rowIssues: any[] = [];

    try {
      const masterJSON = JSON.parse(await fs.readFile(BASE_DATA, "utf-8"));
      if (Array.isArray(masterJSON.features)) {
        merged = masterJSON.features.map((f: any) => ({
          id: f.properties?.id ?? `master-${Math.random()}`,
          name: f.properties?.name ?? "Unnamed",
          geometry: f.geometry,
          status: f.properties?.status ?? "",
          source: "master",
          properties: f.properties || {}, // Preserving properties
        }));
      }
    } catch (err: any) {
      logError("[RoadService] Failed to load master roads", err.message);
    }

    // Optional: Here you would merge Google Sheet rows
    // rawData = await fetchSheetRows(); // implement your sheet fetch if needed
    // For now, rawData empty; in your real code, merge Sheet rows and detect issues
    rowIssues = []; // collect rows that failed merge

    // Skip Overpass fallback for sheet-only rows (no geometry = expected for GAS data)
    // Only attempt Overpass for segments that have a road_refno (real roads, not incidents)
    const missingSegments = merged.filter((r) =>
      !r.geometry?.coordinates?.length && r.properties?.road_refno
    );
    if (missingSegments.length > 0 && missingSegments.length <= 3) {
      logInfo(`[RoadService] Fetching ${missingSegments.length} missing segments from Overpass`);
      for (const seg of missingSegments) {
        try {
          const overpassSeg = await fetchOverpassRoad(seg.name);
          if (overpassSeg) merged.push(overpassSeg);
          // Delay between requests to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (err: any) {
          logError("[RoadService] Overpass fetch failed", { name: seg.name, error: err.message });
        }
      }
    } else if (missingSegments.length > 3) {
      logInfo(`[RoadService] Skipping Overpass for ${missingSegments.length} segments (too many, would rate-limit)`);
    }

    return { merged, raw: rawData, rowIssues };
  }, 60 * 60); // 1h cache TTL
}

/* ------------------------------------------------ */
/* OVERPASS FALLBACK                                */
/* ------------------------------------------------ */
async function fetchOverpassRoad(name: string): Promise<RoadSegment | null> {
  const sanitized = name.replace(/["';]/g, "").trim();
  const query = `
    [out:json][timeout:25];
    way["name"~"${sanitized}",i];
    out geom tags;
  `;
  try {
    const res = await axios.get(`${OVERPASS_API_URL}/interpreter`, {
      params: { data: query },
      timeout: 20_000,
    });
    if (!res.data.elements?.length) return null;

    // Take the first matching way
    const way = res.data.elements[0];
    const coords =
      way.geometry?.map((p: any) => [p.lon, p.lat]) ??
        way.center
        ? [[way.center.lon, way.center.lat]]
        : [];

    if (!coords.length) return null;

    return {
      id: `op-${way.id}`,
      name: way.tags?.name ?? sanitized,
      geometry: { type: "LineString", coordinates: coords },
      status: "Resumed",
      source: "overpass",
      properties: {
        road_refno: way.tags?.ref,
        road_name: way.tags?.name,
        incidentDistrict: way.tags?.["addr:district"],
      status: "" as const,
      },
    };
  } catch (err: any) {
    logError("[RoadService] Overpass fetch failed", err.message);
    return null;
  }
}

/* ------------------------------------------------ */
/* FORCE CACHE (used by build + cron)              */
/* ------------------------------------------------ */
export async function refreshRoadCache() {
  logInfo("[RoadService] Pre-warming road cache...");
  const data = await getCachedRoads();
  await fs.writeFile(CACHE_ROAD, JSON.stringify(data, null, 2), "utf-8");
  logInfo(`[RoadService] Cached ${data.merged.length} road segments`);
  return data;
}

/* ------------------------------------------------ */
/* HELPERS                                          */
/* ------------------------------------------------ */
