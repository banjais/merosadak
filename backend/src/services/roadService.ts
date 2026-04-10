// backend/src/services/roadService.ts
import fs from "fs/promises";
import axios from "axios";
import path from "path";
import { CACHE_DIR, CACHE_ROAD, DATA_DIR } from "../config/paths.js";
import { OVERPASS_API_URL, OVERPASS_FALLBACK_URL, GAS_URL, SHEET_TAB } from "../config/index.js";
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
  source: "highway" | "sheet" | "overpass" | "Department of Roads";
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
    const res = await axios.get(gasUrl, { timeout: 15000, maxRedirects: 5 });
    const data = res.data?.data || [];

    return data.map((row: any) => {
      // Try multiple status key variations (case-insensitive)
      const statusKeys = Object.keys(row).filter(k => k.toLowerCase() === "status");
      const rawStatus = statusKeys.length > 0 ? String(row[statusKeys[0]] || "").trim() : "";
      const status = STATUS_NORMALIZE[rawStatus] || "";

      // Try multiple road code key variations
      const roadCodeKeys = Object.keys(row).filter(k => k.toLowerCase().includes("road") && k.toLowerCase().includes("ref"));
      const roadCode = roadCodeKeys.length > 0 ? row[roadCodeKeys[0]] || "" : "";

      // Try multiple district key variations
      const districtKeys = Object.keys(row).filter(k => k.toLowerCase().includes("district") || k.toLowerCase() === "dist_name");
      const incidentDistrict = districtKeys.length > 0 ? row[districtKeys[0]] || "" : "";

      return {
        road_refno: roadCode,
        road_name: row.road_name || "",
        incidentDistrict: incidentDistrict,
        incidentPlace: row.incidentplace || "",
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

      // First, fetch incidents from sheet to get status mappings
      const incidents = await fetchSheetIncidents();
      logInfo(`[RoadService] Fetched ${incidents.length} incidents from Google Sheets`);

      // Build maps: road_refno -> status, and road_refno + district -> status
      const roadStatusMap = new Map<string, string>();
      const roadDistrictStatusMap = new Map<string, string>();

      for (const inc of incidents) {
        if (inc.status && inc.incidentDistrict) {
          const roadCode = inc.road_refno?.toUpperCase() || "";
          const district = inc.incidentDistrict.toUpperCase();

          // Map: road_refno + district -> status
          if (roadCode && district) {
            roadDistrictStatusMap.set(`${roadCode}|${district}`, inc.status);
          }
          // Map: road_refno -> status (fallback)
          if (roadCode && inc.status !== "Resumed") {
            roadStatusMap.set(roadCode, inc.status);
          }
        }
      }

      for (const highway of highways) {
        try {
          const highwayData = await getHighwayByCode(highway.code);
          if (highwayData && highwayData.features) {
            const segments = highwayData.features.map((f: any) => {
              const highwayCodeUpper = highway.code.toUpperCase();
              const segmentDistrict = f.properties?.dist_name?.toUpperCase() || "";

              // First try: exact match (road + district)
              let incidentStatus = segmentDistrict
                ? roadDistrictStatusMap.get(`${highwayCodeUpper}|${segmentDistrict}`)
                : null;

              // Fallback: road_refno only
              if (!incidentStatus) {
                incidentStatus = roadStatusMap.get(highwayCodeUpper);
              }

              const segmentStatus = incidentStatus || (f.properties?.status as RoadSegment["status"]) || "Resumed";

              const segment: RoadSegment = {
                id: f.properties?.id ?? `${highway.code}-${Math.random().toString(36).substr(2, 9)}`,
                name: f.properties?.name ?? highway.name ?? highway.code,
                geometry: f.geometry,
                status: segmentStatus as RoadSegment["status"],
                source: "highway",
                properties: {
                  ...f.properties,
                  highway_code: highway.code,
                  road_refno: highway.code,
                  road_name: f.properties?.name ?? highway.name,
                  incident_status: incidentStatus || null,
                },
              };
              return segment;
            });
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

        // Tag with Official Government Source
        merged.push({
          id: `sheet-${incident.road_refno || Math.random().toString(36).substr(2, 9)}`,
          name: incident.road_name || incident.incidentPlace || "Unknown Location",
          geometry: geometry || { type: "Point", coordinates: [0, 0] },
          status: incident.status as RoadSegment["status"],
          source: "Department of Roads", // ✅ OFFICIAL SOURCE
          properties: {
            ...incident,
            sourceType: "government",
            confidence: "high",
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

  const tryFetch = async (baseUrl: string): Promise<RoadSegment | null> => {
    const res = await axios.get(`${baseUrl}/interpreter`, {
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
  };

  try {
    // Try main instance
    const result = await tryFetch(OVERPASS_API_URL);
    if (result) return result;

    // Try fallback
    logInfo("[RoadService] Overpass main failed, trying fallback...");
    return await tryFetch(OVERPASS_FALLBACK_URL);
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
