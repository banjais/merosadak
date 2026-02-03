import fs from "fs/promises";
import path from "path";
import { logError, logInfo } from "../logs/logs.js";
import type { FeatureCollection } from "../types.js";
import { DATA_DIR, CACHE_DIR, CACHE_BOUNDARY, BOUNDARY_DATA } from "../config/paths.js";
import { withCache } from "./cacheService.js"; // Hybrid cache wrapper

/**
 * Strategy: Memory (L1) → Redis (L2) → Local File (Primary) → Disk Cache
 * Caches Nepal boundary GeoJSON for 24 hours.
 */
export async function getBoundaryData(): Promise<FeatureCollection> {
  return withCache("nepal_boundary", async () => {
    try {
      // Ensure cache directory exists
      await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});

      const primaryPath = path.join(DATA_DIR, BOUNDARY_DATA);

      // 1️⃣ Primary source (master geojson)
      try {
        const raw = await fs.readFile(primaryPath, "utf-8");
        const data = JSON.parse(raw) as FeatureCollection;

        // Background update of disk cache
        fs.writeFile(CACHE_BOUNDARY, JSON.stringify(data)).catch(err =>
          logError("[boundaryService] Disk cache write failed", { error: err.message })
        );

        logInfo("[boundaryService] Loaded from PRIMARY source");
        return data;
      } catch {
        logInfo(`[boundaryService] Primary missing at ${primaryPath}, checking Disk CACHE`);
      }

      // 2️⃣ Disk cache fallback
      try {
        const raw = await fs.readFile(CACHE_BOUNDARY, "utf-8");
        logInfo("[boundaryService] Loaded from Disk CACHE");
        return JSON.parse(raw) as FeatureCollection;
      } catch (err: any) {
        logError("[boundaryService] Disk cache load failed", { error: err.message });
      }

      // 3️⃣ Last resort
      return { type: "FeatureCollection", features: [] };
    } catch (err: any) {
      logError("[boundaryService] Unexpected error", { error: err.message });
      return { type: "FeatureCollection", features: [] };
    }
  }, 86400); // Cache TTL: 24 hours
}
