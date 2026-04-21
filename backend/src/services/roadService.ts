// backend/src/services/roadService.ts
import fs from "fs/promises";
import crypto from "crypto";
import axios from "axios";
import path from "path";
import { CACHE_ROAD } from "@/config/paths.js";
import { OVERPASS_API_URL, OVERPASS_FALLBACK_URL, GAS_URL, SHEET_TAB } from "@/config/index.js";
import { logInfo, logError } from "@logs/logs.js";
import { getHighwayList, getHighwayGeoJSONRaw, getProvincesByDistricts } from "@/services/highwayService.js";
import { getCachedMonsoonRisk } from "@/services/monsoonService.js";
import { ROAD_STATUS, SHEET_HEADERS } from "@/constants/sheets.js";
import type { Label, RoadSegment, GeoJSONPoint } from "@/types.js";
import { resolveLabel } from "@/services/labelUtils.js";
import { isValidNepalCoordinate } from "@/services/geoUtils.js";

/* ------------------------------------------------ */
/* MEMORY CACHE (NEW - REPLACES REDIS FULL CACHE)   */
/* ------------------------------------------------ */

let roadMemoryCache: {
  merged: RoadSegment[];
  raw: any[];
  rowIssues?: any[];
} | null = null;
export let roadCacheTimestamp = 0;
const ROAD_CACHE_TTL = 5 * 60 * 1000; // Reduced to 5 minutes for better real-time accuracy

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

    // Use URL API to handle query parameters safely
    const url = new URL(GAS_URL);
    if (SHEET_TAB) {
      url.searchParams.set('tab', SHEET_TAB);
    }

    const res = await axios.get(url.toString(), { timeout: 15000 });

    const data = res.data?.data || [];

    return data
      .map((row: any) => {
        const rawStatus = String(row.status || "").trim();
        const status = STATUS_NORMALIZE[rawStatus] || "";

        return {
          road_refno: row.road_refno || "",
          road_name: { en: row.road_name || "" } as Label,
          incidentDistrict: { en: row.district || "" } as Label,
          incidentPlace: { en: row.incidentplace || "" } as Label,
          remarks: { en: row.remarks || "" } as Label,
          status,
          incidentCoordinate: row.coordinates || "",
          timestamp: row.timestamp || row.last_updated || new Date().toISOString(),
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

  const deduplicatedIncidents = new Map<string, RoadSegment>();

  try {
    const highways = await getHighwayList();
    logInfo(`[RoadService] Loading ${highways.length} highways...`);

    const incidents = await fetchSheetIncidents();
    logInfo(`[RoadService] Fetched ${incidents.length} incidents`);

    const monsoonRisks = await getCachedMonsoonRisk();
    logInfo(`[RoadService] Loaded ${monsoonRisks.length} monsoon risk assessments`);

    const roadStatusMap = new Map<string, string>();

    for (const inc of incidents) {
      if (inc.road_refno && inc.status) {
        roadStatusMap.set(inc.road_refno.toUpperCase(), inc.status);
      }
    }

    for (const highway of highways) {
      // Refactor: Use getHighwayGeoJSONRaw to prevent bloating the 24-hour L1 memory cache
      // with every highway file every time the 5-minute road refresh runs.
      const highwayData = await getHighwayGeoJSONRaw(highway.code);

      if (!highwayData?.features) continue;

      // 🔍 VALIDATION: Verify segment districts match the highway's assigned provinces
      const segmentDistricts = Array.from(new Set(
        highwayData.features.map((f: any) => f.properties?.dist_name).filter(Boolean)
      ));
      const actualProvinces = await getProvincesByDistricts(segmentDistricts);
      const expectedProvinces = highway.provinces || [];

      if (expectedProvinces.length > 0) {
        const invalidProvinces = actualProvinces.filter(p => !expectedProvinces.includes(p));
        if (invalidProvinces.length > 0) {
          rowIssues.push({
            id: highway.code,
            name: highway.name || highway.code,
            issue: "Province Alignment Mismatch",
            value: `Contains districts in ${invalidProvinces.join(", ")}, but index only expects ${expectedProvinces.join(", ")}`
          });
        }
      }

      const segments = highwayData.features.map((f: any) => {
        const code = highway.code.toUpperCase();

        // Check if this specific segment or highway has a high monsoon risk
        const risk = monsoonRisks.find(r => r.roadId === code || r.roadId === f.properties?.id);
        const isHighMonsoonRisk = risk && (risk.riskLevel === "HIGH" || risk.riskLevel === "EXTREME");

        const status =
          roadStatusMap.get(code) ||
          f.properties?.status ||
          "Resumed";

        // Elevate weight to 3 for blocked, restricted, or high monsoon risk segments to trigger the glow effect
        const isRestricted = status === ROAD_STATUS.BLOCKED || status === ROAD_STATUS.ONE_LANE || isHighMonsoonRisk;
        const segmentWeight = isRestricted ? 3 : (code.startsWith("NH") ? 2 : 1);

        return {
          id: f.properties?.id || `${code}-${crypto.createHash('md5').update(JSON.stringify(f.geometry)).digest('hex').substring(0, 8)}`,
          name: f.properties?.name || highway.name,
          geometry: f.geometry,
          status,
          source: "highway",
          weight: segmentWeight,
          properties: {
            ...f.properties,
            highway_code: highway.code,
            road_refno: code,
            road_name: f.properties?.road_name || highway.name || code,
          },
        } as RoadSegment;
      });

      merged.push(...segments);
    }

    // Add incidents as points
    for (const inc of incidents) {
      let geometry: GeoJSONPoint = { type: "Point", coordinates: [0, 0] };

      if (inc.incidentCoordinate) {
        const parts = inc.incidentCoordinate.split(/[\s,]+/).map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && isValidNepalCoordinate(parts[0], parts[1])) {
          // Sheet format is "Lat, Lng" -> [Lng, Lat] for GeoJSON
          geometry = { type: "Point", coordinates: [parts[1], parts[0]] };
        } else {
          const issue = parts.length < 2 ? "Malformed coordinate string" : "Invalid or out-of-bounds coordinates";
          rowIssues.push({ id: inc.road_refno, name: resolveLabel(inc.road_name), issue, value: inc.incidentCoordinate });
        }
      }

      // 🧠 Smart Deduplication: Keys by Road Ref + Place.
      // Prioritizes higher weight sources, then more recent timestamps.
      const incidentKey = `${inc.road_refno || 'no-ref'}-${resolveLabel(inc.incidentPlace, 'en') || 'no-place'}`;
      const newWeight = 3; // Department of Roads (Sheet) is high priority
      const newTime = new Date(inc.timestamp).getTime();

      const existing = deduplicatedIncidents.get(incidentKey);
      const existingWeight = existing?.weight ?? -1;
      const existingTime = existing ? new Date(existing.properties.timestamp).getTime() : 0;

      if (!existing || newWeight > existingWeight || (newWeight === existingWeight && newTime > existingTime)) {
        deduplicatedIncidents.set(incidentKey, {
          id: `incident-${inc.road_refno || crypto.randomUUID().substring(0, 8)}`,
          name: resolveLabel(inc.road_name) || resolveLabel(inc.incidentPlace) || "Unknown",
          geometry,
          status: inc.status,
          source: "Department of Roads",
          properties: inc,
          weight: newWeight,
        });
      }
    }

    merged.push(...Array.from(deduplicatedIncidents.values()));

    rawData = merged.filter((r) => r.source === "Department of Roads" || r.source === "sheet");

    const result = {
      merged,
      raw: rawData,
      rowIssues,
    };

    // ✅ SAVE TO MEMORY CACHE
    roadMemoryCache = result;
    roadCacheTimestamp = now;

    logInfo(`[RoadService] Cached in MEMORY: ${merged.length} segments`);

    // 🚀 REAL-TIME BROADCAST
    // Trigger a websocket update so clients know to refresh their incident lists
    try {
      const { broadcastLiveLog } = await import("@/services/websocketService.js");
      broadcastLiveLog({
        type: "road_update",
        message: "Real-time road status updated from Department of Roads",
        timestamp: new Date().toISOString(),
        count: merged.length
      });
    } catch (e) { /* Service might not be initialized yet during boot */ }

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
  const results = await getCachedRoads();
  const { refreshIndexFromCaches } = await import("@/services/searchService.js");
  await refreshIndexFromCaches();
  return results;
}