// backend/src/services/boundaryService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR, CACHE_DISTRICTS, CACHE_PROVINCES, CACHE_LOCAL } from "../config/paths.js";
import { logError, logInfo } from "../logs/logs.js";
import type { FeatureCollection } from "../types.js";
import { withCache } from "./cacheService.js";

const BOUNDARY_FILES = {
  districts: path.join(DATA_DIR, "districts.geojson"),
  provinces: path.join(DATA_DIR, "provinces.geojson"),
  local: path.join(DATA_DIR, "local.geojson"),
};

/**
 * Get boundary data by type
 */
export async function getBoundaryData(type: "districts" | "provinces" | "local"): Promise<FeatureCollection> {
  const cacheKeys = {
    districts: CACHE_DISTRICTS,
    provinces: CACHE_PROVINCES,
    local: CACHE_LOCAL,
  };

  const cacheKey = cacheKeys[type];
  const filePath = BOUNDARY_FILES[type];

  if (!filePath || !cacheKey) {
    throw new Error(`Unknown boundary type: ${type}`);
  }

  return withCache(`boundary:${type}`, async () => {
    try {
      logInfo(`[BoundaryService] Loading ${type} boundary data from ${filePath}`);

      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as FeatureCollection;

      logInfo(`[BoundaryService] Loaded ${type} boundary with ${data.features?.length || 0} features`);

      return data;
    } catch (err: any) {
      logError(`[BoundaryService] Failed to load ${type} boundary data`, {
        error: err.message,
        filePath
      });

      // Return empty FeatureCollection as fallback
      return { type: "FeatureCollection", features: [] };
    }
  }, 86400); // cache for 24 hours
}