// backend/src/services/boundaryService.ts

import fs from "fs/promises";
import { logError, logInfo } from "../logs/logs.js";
import type { FeatureCollection } from "../types.js";
import { CACHE_BOUNDARY, BOUNDARY_DATA } from "../config/paths.js";
import { withCache } from "./cacheService.js";

export async function getBoundaryData(): Promise<FeatureCollection> {
  return withCache("nepal_boundary", async () => {
    try {
      const primaryPath = BOUNDARY_DATA;

      // 🔹 Try PRIMARY source (backend/data/boundary.geojson)
      try {
        const raw = await fs.readFile(primaryPath, "utf-8");
        const data = JSON.parse(raw) as FeatureCollection;

        // 🔹 Save to disk cache (non-blocking)
        fs.writeFile(CACHE_BOUNDARY, JSON.stringify(data)).catch((err) =>
          logError("[boundaryService] Disk cache write failed", {
            error: err.message,
          })
        );

        logInfo("[boundaryService] Loaded from PRIMARY source");
        return data;
      } catch {
        logInfo(
          `[boundaryService] Primary missing at ${primaryPath}, checking Disk CACHE`
        );
      }

      // 🔹 Fallback to disk cache
      try {
        const raw = await fs.readFile(CACHE_BOUNDARY, "utf-8");
        logInfo("[boundaryService] Loaded from Disk CACHE");
        return JSON.parse(raw) as FeatureCollection;
      } catch (err: any) {
        logError("[boundaryService] Disk cache load failed", {
          error: err.message,
        });
      }

      // 🔹 Final fallback (empty data)
      return { type: "FeatureCollection", features: [] };
    } catch (err: any) {
      logError("[boundaryService] Unexpected error", {
        error: err.message,
      });

      return { type: "FeatureCollection", features: [] };
    }
  }, 86400); // cache for 24 hours
}