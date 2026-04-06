// backend/src/config/paths.ts
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When running via tsx: __dirname = backend/src/config → go up 2 levels = backend/
// When running via tsup dist: __dirname = backend/dist → go up 1 level = backend/
// Detect which context by checking if we're in src/ or dist/
const isSource = __dirname.includes(`${path.sep}src${path.sep}`);
export const ROOT = isSource
  ? path.resolve(__dirname, "../..")   // src/config → backend/
  : path.resolve(__dirname, "..");     // dist → backend/

// 📁 Core directories (NO ENV NEEDED)
export const DATA_DIR = path.join(ROOT, "data");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const LOG_DIR = path.join(DATA_DIR, "logs");

// 📄 Core data files
export const BASE_DATA = path.join(DATA_DIR, "master.geojson");

// ⚡ Cache files
export const CACHE_ROAD = path.join(CACHE_DIR, "road.json");
export const CACHE_DISTRICTS = path.join(CACHE_DIR, "districts.json");
export const CACHE_PROVINCES = path.join(CACHE_DIR, "provinces.json");
export const CACHE_LOCAL = path.join(CACHE_DIR, "local.json");
export const CACHE_POI = path.join(CACHE_DIR, "poi.json");
export const CACHE_TRAFFIC = path.join(CACHE_DIR, "traffic.json");
export const CACHE_WEATHER = path.join(CACHE_DIR, "weather.json");
export const CACHE_ALERTS = path.join(CACHE_DIR, "alerts.json");
export const CACHE_MONSOON = path.join(CACHE_DIR, "monsoon.json");
export const CACHE_WAZE = path.join(CACHE_DIR, "waze.json");

// 📁 Ensure directories exist
[DATA_DIR, CACHE_DIR, LOG_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export default {
  ROOT,
  DATA_DIR,
  CACHE_DIR,
  LOG_DIR,
  BASE_DATA,
  CACHE_ROAD,
  CACHE_DISTRICTS,
  CACHE_PROVINCES,
  CACHE_LOCAL,
  CACHE_POI,
  CACHE_TRAFFIC,
  CACHE_WEATHER,
  CACHE_ALERTS,
  CACHE_MONSOON,
  CACHE_WAZE,
};