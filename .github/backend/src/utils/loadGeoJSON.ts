// backend/src/utils/loadGeoJSON.ts
import fs from "fs";
import type { FeatureCollection } from "../types.js";

/**
 * Load a GeoJSON file from disk and parse it
 */
export default function loadGeoJSON(filePath: string): FeatureCollection {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as FeatureCollection;
}
