// backend/src/services/roadService.ts
import fs from "fs/promises";
import axios from "axios";
import path from "path";
import { CACHE_ROAD } from "../config/paths.js";
import { OVERPASS_API_URL, OVERPASS_FALLBACK_URL, GAS_URL, SHEET_TAB } from "../config/index.js";
import { logInfo, logError } from "../logs/logs.js";
import { getHighwayList, getHighwayByCode } from "./highwayService.js";
import { ROAD_STATUS, SHEET_HEADERS } from "../constants/sheets.js";

/* ------------------------------------------------ */
/* MEMORY CACHE (NEW - REPLACES REDIS FULL CACHE)   */
/* ------------------------------------------------ */

let roadMemoryCache: any = null;
let roadCacheTimestamp = 0;
const ROAD_CACHE_TTL = 60 * 60 * 1000; // 1 hour

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

/* ------------------------------------------------ */
/* STATUS NORMALIZATION                            */
/* ------------------------------------------------ */

const STATUS_NORMALIZE: Record<string, string> = {
  Blocked: ROAD_STATUS.BLOCKED,
  blocked: ROAD_STATUS.BLOCKED,
  BLOCKED: ROAD_STATUS.BLOCKED,
  "One-Lane": ROAD_STATUS.ONE_LANE,
  "One Lane": ROAD_STATUS.ONE_LANE,
  "One Way": ROAD_STATUS.ONE_LANE,
  "one-lane": ROAD_STATUS.ONE_LANE,
  Resumed: ROAD_STATUS.RESUMED,
  resumed: ROAD_STATUS.RESUMED,
  Open: ROAD_STATUS.RESUMED,
  clear: ROAD_STATUS.RESUMED,
};

/* ------------------------------------------------ */
/* FETCH SHEET INCIDENTS                           */
/* ------------------------------------------------ */

async function fetchSheetIncidents(): Promise<any[]> {
  try {
    if (!GAS_URL) return [];

    const gasUrl = GAS_URL + (SHEET_TAB ? `?tab=${encodeURIComponent(SHEET_TAB)}` : "");
    const res = await axios.get(gasUrl, { timeout: 15000 });

    const data = res.data?.data || [];

    return data
      .map((row: any) => {
        const rawStatus = String(row.status || "").trim();
        const status = STATUS_NORMALIZE[rawStatus] || "";

        return {
          road_refno: row.road_refno || "",
          road_name: row.road_name || "",
          incidentDistrict: row.district || "",
          incidentPlace: row.incidentplace || "",
          status,
          incidentCoordinate: row.coordinates || "",
        };
      })
      .filter((r: any) => r.status);
  } catch (err: any) {
    logError("[RoadService] Sheet fetch failed", err.message);
    return [];
  }
}

/* ------------------------------------------------ */
/* MAIN ROAD FUNCTION (MEMORY CACHE VERSION)       */
/* ------------------------------------------------ */

export async function getCachedRoads(): Promise<{
  merged: RoadSegment[];
  raw: any[];
  rowIssues?: any[];
}> {
  const now = Date.now();

  // ✅ 1. MEMORY CACHE HIT
  if (roadMemoryCache && now - roadCacheTimestamp < ROAD_CACHE_TTL) {
    logInfo("[RoadService] Returning MEMORY cache");
    return roadMemoryCache;
  }

  let merged: RoadSegment[] = [];
  let rawData: any[] = [];
  let rowIssues: any[] = [];

  try {
    const highways = await getHighwayList();
    logInfo(`[RoadService] Loading ${highways.length} highways...`);

    const incidents = await fetchSheetIncidents();
    logInfo(`[RoadService] Fetched ${incidents.length} incidents`);

    const roadStatusMap = new Map<string, string>();

    for (const inc of incidents) {
      if (inc.road_refno && inc.status) {
        roadStatusMap.set(inc.road_refno.toUpperCase(), inc.status);
      }
    }

    for (const highway of highways) {
      const highwayData = await getHighwayByCode(highway.code);

      if (!highwayData?.features) continue;

      const segments = highwayData.features.map((f: any) => {
        const code = highway.code.toUpperCase();
        const status =
          roadStatusMap.get(code) ||
          f.properties?.status ||
          "Resumed";

        return {
          id: f.properties?.id || `${code}-${Math.random()}`,
          name: f.properties?.name || highway.name,
          geometry: f.geometry,
          status,
          source: "highway",
          properties: {
            ...f.properties,
            highway_code: highway.code,
          },
        };
      });

      merged.push(...segments);
    }

    // Add incidents as points
    for (const inc of incidents) {
      let geometry: any = { type: "Point", coordinates: [0, 0] };

      if (inc.incidentCoordinate) {
        const [lat, lng] = inc.incidentCoordinate.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          geometry = { type: "Point", coordinates: [lng, lat] };
        }
      }

      merged.push({
        id: `incident-${Math.random()}`,
        name: inc.road_name || inc.incidentPlace,
        geometry,
        status: inc.status,
        source: "Department of Roads",
        properties: inc,
      });
    }

    rawData = merged.filter((r) => r.source === "sheet");

    const result = {
      merged,
      raw: rawData,
      rowIssues,
    };

    // ✅ SAVE TO MEMORY CACHE
    roadMemoryCache = result;
    roadCacheTimestamp = now;

    logInfo(`[RoadService] Cached in MEMORY: ${merged.length} segments`);

    return result;
  } catch (err: any) {
    logError("[RoadService] Failed", err.message);
    return { merged: [], raw: [], rowIssues: [] };
  }
}

/* ------------------------------------------------ */
/* OPTIONAL: FORCE REFRESH                         */
/* ------------------------------------------------ */

export async function refreshRoadCache() {
  logInfo("[RoadService] Force refreshing memory cache...");
  roadMemoryCache = null;
  roadCacheTimestamp = 0;
  return await getCachedRoads();
}