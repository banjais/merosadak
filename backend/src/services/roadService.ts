import fs from "fs/promises";
import axios from "axios";
import path from "path";

import { config } from "../config/index.js";
import { DATA_DIR, BASE_DATA, CACHE_ROAD } from "../config/paths.js";
import { SHEET_HEADERS, ROAD_STATUS } from "../constants/sheets.js";
import { logInfo, logError } from "@logs/logs";

/**
 * 📍 Canonical Paths
 */
const MASTER_PATH = path.join(DATA_DIR, BASE_DATA);

/**
 * 🚨 EMERGENCY MOCK DATA
 * Final safety net if the 5 merged map files and the cache are both missing.
 */
const EMERGENCY_MOCK_DATA = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [84.1240, 28.3949] },
      properties: {
        road_refno: "MOCK-001",
        road_name: "Prithvi Highway (Fallback)",
        dist_name: "DHADING",
        status: ROAD_STATUS.BLOCKED,
        remarks: "Emergency System Fallback: Connection to road database lost.",
        lastUpdate: new Date().toISOString(),
      }
    }
  ]
};

/**
 * 🩺 Sync Health State
 */
let syncHealth = {
  status: "pending",
  lastSuccess: "",
  lastError: "",
  incidentsMatched: 0,
  totalSegments: 0,
};

/**
 * 📐 Haversine Formula (Earth Great Circle Distance)
 */
export function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 🔄 Master Sync: Merge Sheets → GeoJSON
 */
export const updateMasterFromSheet = async () => {
  try {
    logInfo("🏗️ [ROAD SERVICE] Starting master road sync");

    // 1️⃣ Validate GAS_URL
    const gasUrl = config.GAS_URL;
    if (!gasUrl) {
      throw new Error("GAS_URL is missing in environment variables (.env)");
    }

    // 2️⃣ Load base road geometry (Your 5 merged map files)
    let masterGeoJSON;
    try {
      const masterRaw = await fs.readFile(MASTER_PATH, "utf-8");
      masterGeoJSON = JSON.parse(masterRaw);
    } catch (err) {
      throw new Error(`Base map file missing at ${MASTER_PATH}`);
    }

    // 3️⃣ Fetch live incidents (Apps Script / Real Data)
    const response = await axios.get(gasUrl, { timeout: 25000 });
    const sheetRows = response.data?.status === "Success" ? response.data.data : [];

    // 4️⃣ Build lookup map for performance (O(1))
    const incidentLookup = new Map<string, any[]>();
    for (const row of sheetRows) {
      const key = `${String(row[SHEET_HEADERS.ROAD_CODE]).trim().toUpperCase()}|${String(row[SHEET_HEADERS.DISTRICT]).trim().toUpperCase()}`;
      if (!incidentLookup.has(key)) incidentLookup.set(key, []);
      incidentLookup.get(key)!.push(row);
    }

    // 5️⃣ Merge incidents into road segments
    let matchedCount = 0;
    const mergedFeatures = masterGeoJSON.features.map((feature: any) => {
      const props = feature.properties;
      const lookupKey = `${String(props.road_refno).trim().toUpperCase()}|${String(props.dist_name).trim().toUpperCase()}`;
      const matches = incidentLookup.get(lookupKey) ?? [];

      let segmentStatus = ROAD_STATUS.RESUMED;

      if (matches.length > 0) {
        matchedCount++;
        const statuses = matches.map((m) => String(m[SHEET_HEADERS.STATUS]).toLowerCase());
        if (statuses.some((s) => s.includes("block") || s.includes("closed"))) {
          segmentStatus = ROAD_STATUS.BLOCKED;
        } else if (statuses.some((s) => s.includes("one"))) {
          segmentStatus = ROAD_STATUS.ONE_LANE;
        }
      }

      return {
        ...feature,
        properties: {
          ...props,
          status: segmentStatus,
          roadStatus: matches,
          lastUpdate: new Date().toISOString(),
        },
      };
    });

    const finalGeoJSON = { ...masterGeoJSON, features: mergedFeatures };

    // 6️⃣ Persist to local cache for offline fallback
    await fs.mkdir(path.dirname(CACHE_ROAD), { recursive: true });
    await fs.writeFile(CACHE_ROAD, JSON.stringify(finalGeoJSON));

    syncHealth = {
      status: "healthy",
      lastSuccess: new Date().toISOString(),
      lastError: "",
      incidentsMatched: matchedCount,
      totalSegments: mergedFeatures.length,
    };

    return finalGeoJSON;

  } catch (error: any) {
    syncHealth.status = "degraded";
    syncHealth.lastError = error.message;
    logError("❌ [ROAD SERVICE] Sync failed", error.message);

    // 🛡️ FALLBACK 1: Serve from local Cache
    try {
      const cached = await fs.readFile(CACHE_ROAD, "utf-8");
      logInfo("⚠️ Serving from local cache.");
      return JSON.parse(cached);
    } catch (cacheError) {
      // 🛡️ FALLBACK 2: Final Mock Data Safety Net
      logError("🚨 Cache missing! Using Emergency Mock Data.");
      return EMERGENCY_MOCK_DATA;
    }
  }
};

/**
 * 📂 Get cached roads (fast path for map rendering)
 */
export const getCachedRoads = async () => {
  try {
    const data = await fs.readFile(CACHE_ROAD, "utf-8");
    return JSON.parse(data);
  } catch {
    return updateMasterFromSheet();
  }
};

/**
 * 🛰️ Spatial query: find incidents near user coordinates
 */
export const getIncidentsNear = async (lat?: number, lng?: number, radiusKm = 5) => {
  try {
    const data = await getCachedRoads();

    // Filter for roads that aren't "RESUMED" (Clear)
    const incidentRoads = data.features.filter((f: any) =>
      [ROAD_STATUS.BLOCKED, ROAD_STATUS.ONE_LANE].includes(f.properties.status)
    );

    if (!lat || !lng) return incidentRoads;

    return incidentRoads
      .filter((f: any) => {
        // Extract coordinate from LineString or Point
        const coords = f.geometry.type === "LineString" ? f.geometry.coordinates[0] : f.geometry.coordinates;
        const [roadLng, roadLat] = coords;
        return calculateHaversine(lat, lng, roadLat, roadLng) <= radiusKm;
      })
      .map((f: any) => ({
        id: f.properties.id ?? f.properties.road_refno,
        roadName: f.properties.road_name ?? "Unknown Road",
        status: f.properties.status,
        remarks: f.properties.roadStatus?.[0]?.Remarks ?? "No details available",
        coordinates: {
          lat: f.geometry.type === "LineString" ? f.geometry.coordinates[0][1] : f.geometry.coordinates[1],
          lng: f.geometry.type === "LineString" ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0],
        },
      }));
  } catch (error) {
    logError("❌ [ROAD SERVICE] Spatial query failed", error);
    return [];
  }
};

export const getSyncHealth = () => syncHealth;
export const getMasterRoads = updateMasterFromSheet;
export const getRoads = getCachedRoads;
