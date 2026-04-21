// backend/src/config/paths.ts
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Load config values from .env via index.ts
// Import after loading dotenv in index.ts
import { config } from "./index.js";

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

// 📁 Core directories - use config values if available, fallback to defaults
const dataDirFromConfig = config.DATA_DIR || "data";
const cacheDirFromConfig = config.CACHE_DIR || "data/cache";
const logDirFromConfig = config.LOG_DIR || "data/logs";

export const DATA_DIR = path.isAbsolute(dataDirFromConfig)
  ? dataDirFromConfig
  : path.join(ROOT, dataDirFromConfig);
export const CACHE_DIR = path.isAbsolute(cacheDirFromConfig)
  ? cacheDirFromConfig
  : path.join(ROOT, cacheDirFromConfig);
export const LOG_DIR = path.isAbsolute(logDirFromConfig)
  ? logDirFromConfig
  : path.join(ROOT, logDirFromConfig);

// 📄 Core data files - use config values if available
export const BASE_DATA = path.isAbsolute(config.BASE_DATA || "")
  ? config.BASE_DATA
  : path.join(ROOT, config.BASE_DATA || "data/highways_base.geojson");
export const BOUNDARY_DATA = path.isAbsolute(config.BOUNDARY_DATA || "")
  ? config.BOUNDARY_DATA
  : path.join(ROOT, config.BOUNDARY_DATA || "data/boundary.geojson");
export const HIGHWAY_DATA = path.isAbsolute(config.HIGHWAY_DATA || "")
  ? config.HIGHWAY_DATA
  : path.join(ROOT, config.HIGHWAY_DATA || "data/highway/index.json");
export const DISTRICT_DATA = path.isAbsolute(config.DISTRICT_DATA || "")
  ? config.DISTRICT_DATA
  : path.join(ROOT, config.DISTRICT_DATA || "data/districts.geojson");
export const LOCAL_DATA = path.isAbsolute(config.LOCAL_DATA || "")
  ? config.LOCAL_DATA
  : path.join(ROOT, config.LOCAL_DATA || "data/local.geojson");
export const PROVINCE_DATA = path.isAbsolute(config.PROVINCE_DATA || "")
  ? config.PROVINCE_DATA
  : path.join(ROOT, config.PROVINCE_DATA || "data/provinces.geojson");
export const DISTRICT_MAPPING = path.isAbsolute(config.DISTRICT_MAPPING || "")
  ? config.DISTRICT_MAPPING
  : path.join(ROOT, config.DISTRICT_MAPPING || "data/district_mapping.json");

// ⚡ Cache files - use config values if available
export const CACHE_ROAD = path.isAbsolute(config.CACHE_ROAD || "")
  ? config.CACHE_ROAD
  : path.join(ROOT, config.CACHE_ROAD || "data/cache/cacheRoad.json");
export const CACHE_DISTRICTS = path.isAbsolute(config.CACHE_DISTRICTS || "")
  ? config.CACHE_DISTRICTS
  : path.join(ROOT, config.CACHE_DISTRICTS || "data/cache/cacheDistricts.json");
export const CACHE_PROVINCES = path.isAbsolute(config.CACHE_PROVINCES || "")
  ? config.CACHE_PROVINCES
  : path.join(ROOT, config.CACHE_PROVINCES || "data/cache/cacheProvinces.json");
export const CACHE_LOCAL = path.isAbsolute(config.CACHE_LOCAL || "")
  ? config.CACHE_LOCAL
  : path.join(ROOT, config.CACHE_LOCAL || "data/cache/cacheLocal.json");
export const CACHE_POI = path.isAbsolute(config.CACHE_POI || "")
  ? config.CACHE_POI
  : path.join(ROOT, config.CACHE_POI || "data/cache/cachePOIs.json");
export const CACHE_TRAFFIC = path.isAbsolute(config.CACHE_TRAFFIC || "")
  ? config.CACHE_TRAFFIC
  : path.join(ROOT, config.CACHE_TRAFFIC || "data/cache/cacheTraffic.json");
export const CACHE_WEATHER = path.isAbsolute(config.CACHE_WEATHER || "")
  ? config.CACHE_WEATHER
  : path.join(ROOT, config.CACHE_WEATHER || "data/cache/cacheWeather.json");
export const CACHE_ALERTS = path.isAbsolute(config.CACHE_ALERTS || "")
  ? config.CACHE_ALERTS
  : path.join(ROOT, config.CACHE_ALERTS || "data/cache/cacheAlerts.json");
export const CACHE_MONSOON = path.isAbsolute(config.CACHE_MONSOON || "")
  ? config.CACHE_MONSOON
  : path.join(ROOT, config.CACHE_MONSOON || "data/cache/cacheMonsoon.json");
export const CACHE_WAZE = path.isAbsolute(config.CACHE_WAZE || "")
  ? config.CACHE_WAZE
  : path.join(ROOT, config.CACHE_WAZE || "data/cache/cacheWaze.json");
export const CACHE_BOUNDARY = path.isAbsolute(config.CACHE_BOUNDARY || "")
  ? config.CACHE_BOUNDARY
  : path.join(ROOT, config.CACHE_BOUNDARY || "data/cache/cacheBoundary.json");

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
  BOUNDARY_DATA,
  HIGHWAY_DATA,
  DISTRICT_DATA,
  LOCAL_DATA,
  PROVINCE_DATA,
  CACHE_ROAD,
  CACHE_DISTRICTS,
  CACHE_PROVINCES,
  CACHE_LOCAL,
  CACHE_BOUNDARY,
  CACHE_POI,
  CACHE_TRAFFIC,
  CACHE_WEATHER,
  CACHE_ALERTS,
  CACHE_MONSOON,
  CACHE_WAZE,
};
