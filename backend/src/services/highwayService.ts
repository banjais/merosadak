// backend/src/services/highwayService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import { logError, logInfo } from "../logs/logs.js";
import type { FeatureCollection } from "../types.js";

const HIGHWAY_DIR = path.join(DATA_DIR, "highway");
const HIGHWAY_INDEX = path.join(HIGHWAY_DIR, "index.json");

/**
 * Get list of available highways with metadata
 */
export async function getHighwayList(): Promise<Array<{code: string, file: string, name?: string}>> {
  try {
    const indexData = JSON.parse(await fs.readFile(HIGHWAY_INDEX, "utf-8"));
    return indexData;
  } catch (err: any) {
    logError("[HighwayService] Failed to load highway index", err.message);
    return [];
  }
}

/**
 * Get specific highway geojson by code
 */
export async function getHighwayByCode(code: string): Promise<FeatureCollection | null> {
  try {
    // Load index to find the file
    const indexData = await getHighwayList();
    const highwayEntry = indexData.find(h => h.code === code);

    if (!highwayEntry) {
      logInfo(`[HighwayService] Highway ${code} not found in index`);
      return null;
    }

    const filePath = path.join(HIGHWAY_DIR, highwayEntry.file);

    // Load the geojson file
    const geojsonData = JSON.parse(await fs.readFile(filePath, "utf-8")) as FeatureCollection;

    // Add code to properties for consistency
    if (geojsonData.features) {
      geojsonData.features.forEach(feature => {
        if (feature.properties) {
          feature.properties.highway_code = code;
        }
      });
    }

    logInfo(`[HighwayService] Loaded highway ${code} from ${highwayEntry.file}`);
    return geojsonData;

  } catch (err: any) {
    logError("[HighwayService] Failed to load highway by code", {
      code,
      error: err.message
    });
    return null;
  }
}

/**
 * Get highway metadata for a given code
 */
export async function getHighwayMetadata(code: string): Promise<{code: string, file: string, name?: string} | null> {
  const highways = await getHighwayList();
  return highways.find(h => h.code === code) || null;
}