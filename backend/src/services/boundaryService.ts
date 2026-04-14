// backend/src/services/boundaryService.ts
import fs from "fs/promises";
import { BOUNDARY_DATA } from "../config/paths.js";
import { logError, logInfo } from "../logs/logs.js";
import type { FeatureCollection } from "../types.js";
import { withCache } from "./cacheService.js";

/**
 * Get Nepal boundary data for map display
 * Uses districts.geojson which contains all 77 districts with administrative boundaries
 */
export async function getNepalBoundary(): Promise<FeatureCollection> {
  return withCache(`boundary:nepal`, async () => {
    try {
      logInfo(`[BoundaryService] Loading Nepal boundary from ${BOUNDARY_DATA}`);

      const raw = await fs.readFile(BOUNDARY_DATA, "utf-8");
      const data = JSON.parse(raw) as FeatureCollection;

      logInfo(`[BoundaryService] Loaded Nepal boundary with ${data.features?.length || 0} districts`);

      return data;
    } catch (err: any) {
      logError(`[BoundaryService] Failed to load Nepal boundary`, {
        error: err.message,
        filePath: BOUNDARY_DATA
      });

      return { type: "FeatureCollection", features: [] };
    }
  }, 86400);
}