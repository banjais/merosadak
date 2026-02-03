// backend/src/config/paths.ts
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

/**
 * 🧭 Resolve current file location (ESM-safe)
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🔍 Find backend root by locating backend/package.json
 */
function findBackendRoot(startDir: string): string {
  let currentDir = startDir;

  while (currentDir !== path.parse(currentDir).root) {
    if (
      fs.existsSync(path.join(currentDir, 'package.json')) &&
      path.basename(currentDir) === 'backend'
    ) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error('❌ Could not resolve backend root directory');
}

export const ROOT = findBackendRoot(__dirname);
console.log(`📁 [Paths] Backend ROOT resolved to: ${ROOT}`);

/**
 * 📂 Core directories (STRICTLY backend/data)
 */
export const DATA_DIR  = path.join(ROOT, 'data');
export const LOG_DIR   = path.join(DATA_DIR, 'logs');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const MOCK_DIR  = path.join(DATA_DIR, 'mock');

/**
 * 📄 Source filenames (inside backend/data)
 */
export const BASE_DATA     = path.join(DATA_DIR, 'master.geojson');
export const BOUNDARY_DATA = path.join(DATA_DIR, 'boundary.geojson');
export const POI_DATA      = path.join(DATA_DIR, 'pois.geojson');

/**
 * 💾 Cache files (inside backend/data/cache)
 */
export const CACHE_ROAD     = path.join(CACHE_DIR, 'cacheRoad.json');
export const CACHE_POI      = path.join(CACHE_DIR, 'cachePOIs.json');
export const CACHE_BOUNDARY = path.join(CACHE_DIR, 'cacheBoundary.json');
export const CACHE_WEATHER  = path.join(CACHE_DIR, 'cacheWeather.json');
export const CACHE_TRAFFIC  = path.join(CACHE_DIR, 'cacheTraffic.json');
export const CACHE_ALERTS   = path.join(CACHE_DIR, 'cacheAlerts.json');
export const CACHE_MONSOON  = path.join(CACHE_DIR, 'cacheMonsoon.json');
export const CACHE_WAZE     = path.join(CACHE_DIR, 'cacheWaze.json');

/**
 * ✅ Default export
 */
export default {
  ROOT,
  DATA_DIR,
  LOG_DIR,
  CACHE_DIR,
  MOCK_DIR,
  BASE_DATA,
  POI_DATA,
  BOUNDARY_DATA,
  CACHE_ROAD,
  CACHE_POI,
  CACHE_BOUNDARY,
  CACHE_WEATHER,
  CACHE_TRAFFIC,
  CACHE_ALERTS,
  CACHE_MONSOON,
  CACHE_WAZE,
};
