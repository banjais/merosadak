// backend/src/services/roadService.ts
import fs from "fs/promises";
import axios from "axios";
import path from "path";
import { CACHE_DIR, CACHE_ROAD, DATA_DIR } from "../config/paths.js";
import { OVERPASS_API_URL, GAS_URL, SHEET_TAB } from "../config/index.js";
import { logInfo, logError } from "../logs/logs.js";
import { withCache } from "./cacheService.js";
import type { LineString } from "geojson";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { getHighwayList, getHighwayByCode } from "./highwayService.js";
import { ROAD_STATUS, SHEET_HEADERS } from "../constants/sheets.js";

export interface RoadSegment {
  id: string;
  name: string;
  chainageStart?: number;
  chainageEnd?: number;
  geometry: GeoJSON.LineString | GeoJSON.Point;
  status: "Blocked" | "One-Lane" | "Resumed";
  source: "highway" | "sheet" | "overpass";
  properties: {
    road_refno?: string;
    road_name?: string;
    incidentDistrict?: string;
    status?: string;
    highway_code?: string;
    [key: string]: any;
  };
}

// Normalize status from Google Sheets
const STATUS_NORMALIZE: Record<string, string> = {
  "Blocked": ROAD_STATUS.BLOCKED,
  "blocked": ROAD_STATUS.BLOCKED,
  "BLOCKED": ROAD_STATUS.BLOCKED,
  "One-Lane": ROAD_STATUS.ONE_LANE,
  "One Lane": ROAD_STATUS.ONE_LANE,
  "One Way": ROAD_STATUS.ONE_LANE,
  "One-Way": ROAD_STATUS.ONE_LANE,
  "one-lane": ROAD_STATUS.ONE_LANE,
  "Resumed": ROAD_STATUS.RESUMED,
  "resumed": ROAD_STATUS.RESUMED,
  "RESUMED": ROAD_STATUS.RESUMED,
};

/**
 * Fetch road incident data directly from Google Sheets (GAS)
 */
async function fetchSheetIncidents(): Promise<any[]> {
  try {
    const gasUrl = GAS_URL + (SHEET_TAB ? `?tab=${encodeURIComponent(SHEET_TAB)}` : "");
    const res = await axios.get(gasUrl, { timeout: 15000 });
    const data = res.data?.data || [];

    return data.map((row: any) => {
      const rawStatus = (row[SHEET_HEADERS.STATUS] || "").toString().trim();
      const status = STATUS_NORMALIZE[rawStatus] || "";

      return {
        road_refno: row[SHEET_HEADERS.ROAD_CODE] || "",
        road_name: row[SHEET_HEADERS.ROAD_NAME] || "",
        incidentDistrict: row[SHEET_HEADERS.DISTRICT] || "",
        incidentPlace: row[SHEET_HEADERS.PLACE] || "",
        status: status,
        chainage: row[SHEET_HEADERS.CHAINAGE] || "",
        incidentCoordinate: row[SHEET_HEADERS.COORDINATES] || "",
        reportDate: row[SHEET_HEADERS.SUBMISSION_DATE] || "",
        div_name: row[SHEET_HEADERS.DIVISION] || "",
        incidentStarted: row[SHEET_HEADERS.START_DATE] || "",
        estimatedRestoration: row[SHEET_HEADERS.ESTIMATED_RESTORATION] || "",
        resumedDate: row[SHEET_HEADERS.RESUMED_DATE] || "",
        blockedHours: row[SHEET_HEADERS.BLOCKED_HOURS] || "",
        contactPerson: row[SHEET_HEADERS.CONTACT] || "",
        restorationEfforts: row[SHEET_HEADERS.EFFORTS] || "",
        remarks: row[SHEET_HEADERS.REMARKS] || "",
      };
    }).filter((row: any) => row.status); // Only keep rows with valid status
  } catch (err: any) {
    logError("[RoadService] Failed to fetch sheet incidents", err.message);
    return [];
  }
}

/* ------------------------------------------------ */
/* MAIN: Cached Roads from Highway Files + Sheet Incidents */
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

    // 1. Load highways from files
    try {
      const highways = await getHighwayList();
      logInfo(`[RoadService] Loading ${highways.length} highways...`);

      for (const highway of highways) {
        try {
          const highwayData = await getHighwayByCode(highway.code);
          if (highwayData && highwayData.features) {
            const segments = highwayData.features.map((f: any) => ({
              id: f.properties?.id ?? `${highway.code}-${Math.random().toString(36).substr(2, 9)}`,
              name: f.properties?.name ?? highway.name ?? highway.code,
              geometry: f.geometry,
              status: (f.properties?.status as RoadSegment["status"]) ?? "Resumed",
              source: "highway",
              properties: {
                ...f.properties,
                highway_code: highway.code,
                road_refno: highway.code,
                road_name: f.properties?.name ?? highway.name,
              },
            }));
            merged.push(...segments);
          }
        } catch (err: any) {
          logError(`[RoadService] Failed to load highway ${highway.code}`, err.message);
        }
      }
      logInfo(`[RoadService] Loaded ${merged.length} road segments from ${highways.length} highways`);
    } catch (err: any) {
      logError("[RoadService] Failed to load highways", err.message);
    }

    // 2. Fetch incidents from Google Sheets and add as point features
    try {
      const incidents = await fetchSheetIncidents();
      logInfo(`[RoadService] Fetched ${incidents.length} incidents from Google Sheets`);

      for (const incident of incidents) {
        let geometry: GeoJSON.Point | null = null;
        if (incident.incidentCoordinate) {
          const [lat, lng] = incident.incidentCoordinate.split(",").map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            geometry = { type: "Point", coordinates: [lng, lat] };
          }
        }

        merged.push({
          id: `sheet-${incident.road_refno || Math.random().toString(36).substr(2, 9)}`,
          name: incident.road_name || incident.incidentPlace || "Unknown Location",
          geometry: geometry || { type: "Point", coordinates: [0, 0] },
          status: incident.status as RoadSegment["status"],
          source: "sheet",
          properties: {
            ...incident,
          },
        });
      }
    } catch (err: any) {
      logError("[RoadService] Failed to fetch sheet incidents", err.message);
    }

    rawData = merged.filter(r => r.source === "sheet");
    rowIssues = [];

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
