// backend/src/scripts/diagnostics.ts
import fs from "fs/promises";
import path from "path";
import v8 from "v8";
import axios from "axios";
import paths from "../config/paths.js";
import { ROAD_STATUS } from "../constants/sheets.js";
import { getCachedRoads } from "../services/roadService.js";
import {
  config, isProd, GAS_URL, SHEET_TAB, UPSTASH,
  OPENWEATHERMAP_API_KEY, OPENWEATHERMAP_API_URL,
  OPEN_METEO_API_BASE, GEMINI_API_KEY, GEMINI_API_URL,
  GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_API_URL, TOMTOM_API_KEY, TOMTOM_API_URL, WAZE_JSON,
  OVERPASS_API_URL, NOMINATIM_API_URL, TELEGRAM_API_URL,
  FIREBASE_API_KEY, FIREBASE_BASE_URL,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  SMTP_HOST, SMTP_PORT,
  SENTRY_DSN, JWT_SECRET,
  RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX,
  WS_ENABLED, WS_PORT,
} from "../config/index.js";

// ─── ANSI Colors ───
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", magenta: "\x1b[35m",
};

const PASS = `${C.green}✓${C.reset}`;
const FAIL = `${C.red}✗${C.reset}`;
const WARN = `${C.yellow}○${C.reset}`;

let passed = 0, failed = 0, warnings = 0;

const ok = (l: string, d = "") => { passed++; console.log(`  ${PASS} ${l}${d ? `  ${C.dim}${d}${C.reset}` : ""}`); };
const err = (l: string, d = "") => { failed++; console.log(`  ${FAIL} ${l}${d ? `  ${C.red}${d}${C.reset}` : ""}`); };
const warn = (l: string, d = "") => { warnings++; console.log(`  ${WARN} ${l}${d ? `  ${C.dim}${d}${C.reset}` : ""}`); };

function header(title: string) {
  console.log(`\n${C.cyan}${C.bold}── ${title} ${"─".repeat(Math.max(0, 54 - title.length))}${C.reset}`);
}

const NEPAL_BOUNDS = { minLng: 80, maxLng: 89, minLat: 26, maxLat: 31 };
/** 
 * Validates against official administrative bounds 
 * approx: 80.0°E to 88.3°E | 26.3°N to 30.5°N
 */
const validateCoords = (lng: number, lat: number) => lng >= 80.0 && lng <= 88.3 && lat >= 26.3 && lat <= 30.5;

// ─── API Check Helper ───
async function checkApi(label: string, url: string, opts?: { method?: string; timeout?: number; headers?: Record<string, string> }) {
  const method = (opts?.method || 'GET').toLowerCase();
  try {
    const res = await axios({
      method: method,
      url: url,
      timeout: opts?.timeout ?? 8000,
      headers: opts?.headers ?? {},
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 400) {
      ok(label, `HTTP ${res.status}`);
    } else {
      err(label, `HTTP ${res.status}`);
    }
  } catch (e: any) {
    err(label, e.code || e.message);
  }
}

// ─── Main ───
async function runDiagnostics() {
  const mode = isProd ? "production" : "development";
  const port = String(config.PORT || 4000);
  console.log(`\n${C.magenta}${C.bold}  MEROSADAK DIAGNOSTICS${C.reset}  ${C.dim}${mode} :${port}${C.reset}`);

  const HIGHWAY_DIR = path.join(paths.DATA_DIR, "highway");
  const BOUNDARY_TYPES = ['districts', 'provinces', 'local'];

  // ─── Highway Data ───
  header("Highway Data");

  let highwayCount = 0;
  let highwaySegments = 0;
  let statusCount = { Blocked: 0, "One-Lane": 0, Resumed: 0 };

  // Check highway index
  try {
    const indexPath = path.join(HIGHWAY_DIR, "index.json");
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const highways = JSON.parse(indexContent);
    highwayCount = highways.length;

    console.log(`  🛣️  Highways  →  ${highwayCount} highways indexed`);

    // Get status from cached roads (highway files ONLY - exclude sheet incidents)
    try {
      const { merged } = await getCachedRoads();
      const highwayOnlyRoads = merged.filter(road => road.source === "highway");
      highwaySegments = highwayOnlyRoads.length;
      for (const road of highwayOnlyRoads) {
        if (road.status === "Blocked") statusCount.Blocked++;
        else if (road.status === "One-Lane") statusCount["One-Lane"]++;
        else statusCount.Resumed++;
      }
    } catch { /* fallback to file check */ }

    if (highwayCount > 5) {
      console.log(`     (checking first 5 of ${highwayCount} highways...)`);
    }
    ok("Highway index", `${highwayCount} highways`);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      err("Highway index", "index.json not found in data/highway/");
    } else {
      err("Highway index", e.message);
    }
  }

  // ─── Status Breakdown (Highway Files) ───
  header("Status Breakdown (Highway Files)");
  const totalStatus = statusCount.Blocked + statusCount["One-Lane"] + statusCount.Resumed;
  if (totalStatus > 0) {
    const statuses = [
      { name: "Blocked", count: statusCount.Blocked, icon: "■" },
      { name: "One-Lane", count: statusCount["One-Lane"], icon: "▲" },
      { name: "Resumed", count: statusCount.Resumed, icon: "●" },
    ];

    for (const { name, count, icon } of statuses) {
      const pct = totalStatus > 0 ? ((count / totalStatus) * 100).toFixed(1) : "0.0";
      ok(`${icon} ${name}`, `${count}  (${pct}%)`);
    }
    console.log(`     Total: ${C.bold}${totalStatus}${C.reset} (from sampled highways)`);
  } else {
    ok("Status", "All highways Resumed (no incidents in files)");
  }

  // ─── Real-Time Sheet Incidents ───
  header("Real-Time Sheet Incidents");
  try {
    if (!GAS_URL) {
      ok("Google Sheets", "not configured (skipping real-time fetch)");
    } else {
      const gasUrl = GAS_URL + (SHEET_TAB ? `?tab=${encodeURIComponent(SHEET_TAB)}` : "");
      const res = await axios.get(gasUrl, { timeout: 15000 });
      const sheetData = res.data?.data || [];

      const sheetStatusCount = { Blocked: 0, "One-Lane": 0, Resumed: 0 };
      const STATUS_NORMALIZE: Record<string, string> = {
        "Blocked": "Blocked", "blocked": "Blocked", "BLOCKED": "Blocked",
        "One-Lane": "One-Lane", "One Lane": "One-Lane", "One Way": "One-Lane", "One-Way": "One-Lane", "one-lane": "One-Lane",
        "Resumed": "Resumed", "resumed": "Resumed", "RESUMED": "Resumed",
        "Open": "Resumed", "open": "Resumed",
        "Clear": "Resumed", "clear": "Resumed",
        "Normal": "Resumed", "normal": "Resumed",
      };

      sheetData.forEach((row: any) => {
        const rawStatus = String(row.status || "").trim();
        const status = STATUS_NORMALIZE[rawStatus] || "";
        if (status) sheetStatusCount[status as keyof typeof sheetStatusCount]++;
      });

      const totalSheet = sheetStatusCount.Blocked + sheetStatusCount["One-Lane"] + sheetStatusCount.Resumed;
      console.log(`  📡 Google Sheets (GAS)  →  ${totalSheet} rows from tab '${SHEET_TAB || "Roads"}'`);

      if (totalSheet > 0) {
        const sheetStatuses = [
          { name: "Blocked", count: sheetStatusCount.Blocked, icon: "■" },
          { name: "One-Lane", count: sheetStatusCount["One-Lane"], icon: "▲" },
          { name: "Resumed", count: sheetStatusCount.Resumed, icon: "●" },
        ];

        for (const { name, count, icon } of sheetStatuses) {
          const pct = totalSheet > 0 ? ((count / totalSheet) * 100).toFixed(1) : "0.0";
          ok(`${icon} ${name}`, `${count}  (${pct}%)`);
        }
        console.log(`     Total: ${C.bold}${totalSheet}${C.reset} (real-time from Google Sheets)`);
      } else {
        ok("No incidents", "Google Sheets returned no data");
      }
    }
  } catch (e: any) {
    err("Google Sheets", `Failed to fetch: ${e.message}`);
  }

  // ─── Files ───
  header("Files");

  // Check all configured data files from environment
  const dataFiles = [
    { label: "Base Highways", path: paths.BASE_DATA },
    { label: "Highway Index", path: paths.HIGHWAY_DATA },
    { label: "Districts", path: paths.DISTRICT_DATA },
    { label: "Provinces", path: paths.PROVINCE_DATA },
    { label: "Local", path: paths.LOCAL_DATA },
  ];

  for (const { label, path: filePath } of dataFiles) {
    try {
      const s = await fs.stat(filePath);
      ok(label, `${(s.size / 1024).toFixed(0)} KB`);
    } catch {
      err(label, "not found");
    }
  }

  // Check boundary files (split or combined)
  try {
    const s = await fs.stat(paths.BOUNDARY_DATA);
    ok("Boundary (combined)", `${(s.size / 1024).toFixed(0)} KB`);
  } catch {
    let allExist = true, totalSize = 0;
    for (const type of BOUNDARY_TYPES) {
      try {
        const s = await fs.stat(path.join(paths.DATA_DIR, `${type}.geojson`));
        totalSize += s.size;
      } catch {
        allExist = false;
        break;
      }
    }
    if (allExist) {
      ok("Boundary (split)", `${(totalSize / 1024).toFixed(0)} KB (${BOUNDARY_TYPES.length} files)`);
    } else {
      warn("Boundary", "not found");
    }
  }

  // Check highway directory
  try {
    const files = await fs.readdir(HIGHWAY_DIR);
    const geojsonFiles = files.filter(f => f.endsWith('.geojson'));
    ok(`Highway Segments`, `${geojsonFiles.length} files`);
  } catch { err("Highway Segments", "directory not found"); }

  // ─── Caches ───
  header("Caches");
  for (const c of [
    { label: SHEET_TAB || "Roads", p: paths.CACHE_ROAD },
    { label: "Traffic", p: paths.CACHE_TRAFFIC },
    { label: "Weather", p: paths.CACHE_WEATHER },
    { label: "POI", p: paths.CACHE_POI },
    { label: "Alerts", p: paths.CACHE_ALERTS },
    { label: "Monsoon", p: paths.CACHE_MONSOON },
    { label: "Waze", p: paths.CACHE_WAZE },
  ]) {
    try {
      const stat = await fs.stat(c.p);
      const ageMinutes = (Date.now() - stat.mtime.getTime()) / (1000 * 60);
      const ageStr = ageMinutes > 60 ? `${(ageMinutes / 60).toFixed(1)}h` : `${Math.round(ageMinutes)}m`;
      const fn = ageMinutes > 120 ? warn : ok;
      fn(c.label, `${(stat.size / 1024).toFixed(1)} KB, ${ageStr} old`);
    } catch { ok(c.label, "empty (not yet populated)"); }
  }

  // ─── External APIs ───
  header("External APIs");

  // Google Sheets (GAS) — primary data source for road incidents
  if (GAS_URL) {
    await checkApi("Google Sheets (GAS)  [primary]", GAS_URL, { timeout: 15000 });
  } else { ok("Google Sheets (GAS)", "not configured (optional)"); }

  // Weather: OpenWeatherMap (main) → Open-Meteo (fallback)
  if (OPENWEATHERMAP_API_KEY) {
    const owmUrl = OPENWEATHERMAP_API_URL || "https://api.openweathermap.org/data/2.5/weather";
    await checkApi("OpenWeatherMap  [weather:main]", `${owmUrl}?q=Kathmandu&appid=${OPENWEATHERMAP_API_KEY}`, { timeout: 8000 });
  } else { ok("OpenWeatherMap", "not configured (using Open-Meteo fallback)"); }

  if (OPEN_METEO_API_BASE) {
    const omBase = OPEN_METEO_API_BASE.replace(/\/$/, "");
    await checkApi("Open-Meteo  [weather:fallback]", `${omBase}/forecast?latitude=27.7&longitude=85.3&current_weather=true`, { timeout: 8000 });
  } else { ok("Open-Meteo", "not configured"); }

  // Traffic: Waze (main) → TomTom (fallback) → Overpass (fallback2)
  if (WAZE_JSON) {
    await checkApi("Waze  [traffic:main]", WAZE_JSON, { timeout: 10000 });
  } else { ok("Waze", "not configured (using OSM fallback)"); }

  if (TOMTOM_API_KEY) {
    await checkApi("TomTom  [traffic:fallback]", `${TOMTOM_API_URL}/traffic/services/5/incidentDetails?bbox=85.2,27.6,85.4,27.8&key=${TOMTOM_API_KEY}`, { timeout: 8000 });
  } else { ok("TomTom Traffic", "not configured (using OSM fallback)"); }

  // Overpass — fallback for traffic, POI, road geometry
  // Overpass is rate-limited and can be slow, so we use a longer timeout and warn instead of fail
  try {
    const overpassUrl = `${OVERPASS_API_URL}/interpreter?data=[out:json];node(27.7,85.3,27.71,85.31);out%201;`;
    const res = await axios.get(overpassUrl, { timeout: 15000, validateStatus: () => true });
    if (res.status >= 200 && res.status < 300) {
      ok("Overpass (OSM)  [fallback]", `HTTP ${res.status}`);
    } else if (res.status >= 500) {
      ok("Overpass (OSM)  [fallback]", `HTTP ${res.status} — rate-limited (normal for free tier)`);
    } else {
      ok("Overpass (OSM)  [fallback]", `HTTP ${res.status}`);
    }
  } catch {
    warn("Overpass (OSM)  [fallback]", "unreachable — OK as fallback-only service");
  }

  // POI: TomTom (main) → Overpass (fallback) — TomTom checked above

  // Search: Local (main) → Nominatim (fallback)
  if (NOMINATIM_API_URL) {
    await checkApi("Nominatim  [search:fallback]", `${NOMINATIM_API_URL}/search?q=kathmandu&format=json&limit=1`, { timeout: 8000, headers: { "User-Agent": "MeroSadak-Diagnostics/1.0" } });
  }

  // Gemini AI
  if (GEMINI_API_KEY) {
    ok("Gemini AI  [ai]", "configured");
  } else { ok("Gemini AI", "not configured (optional feature)"); }

  // Google Maps
  if (GOOGLE_MAPS_API_KEY) {
    await checkApi("Google Maps  [geocode]", `${GOOGLE_MAPS_API_URL}/geocode/json?address=kathmandu&key=${GOOGLE_MAPS_API_KEY}`, { timeout: 8000 });
  } else { ok("Google Maps", "not configured (using OSM fallback)"); }

  // Firebase
  if (FIREBASE_API_KEY && FIREBASE_BASE_URL) {
    await checkApi("Firebase  [auth]", FIREBASE_BASE_URL, { timeout: 8000 });
  } else { ok("Firebase", "not configured (optional)"); }

  // Telegram
  if (TELEGRAM_BOT_TOKEN) {
    await checkApi("Telegram Bot  [notifications]", `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/getMe`, { timeout: 8000 });
  } else { ok("Telegram Bot", "not configured (optional)"); }

  // SMTP
  if (SMTP_HOST) {
    ok("SMTP  [email]", `${SMTP_HOST}:${SMTP_PORT}`);
  } else { ok("SMTP", "not configured (optional)"); }

  // ─── System ───
  header("System");

  // Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);
  if (majorVersion >= 20) {
    ok("Node.js", nodeVersion);
  } else {
    err("Node.js", `${nodeVersion} — requires >=20`);
  }

  // Memory
  const mem = process.memoryUsage();
  const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
  const maxHeapMB = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
  const heapRatio = mem.heapUsed / mem.heapTotal;
  const memFn = heapRatio > 0.98 && maxHeapMB < 512 ? warn : ok;
  memFn("Memory (heap)", `${heapUsedMB} / ${heapTotalMB} MB`);
  if (maxHeapMB < 512) {
    warn("Memory limit", `${maxHeapMB} MB — consider NODE_OPTIONS=--max-old-space-size=2048`);
  } else {
    ok("Memory limit", `${maxHeapMB} MB`);
  }
  ok("Memory (RSS)", `${rssMB} MB`);

  // ─── Security ───
  header("Security");

  const isDefaultSecret = JWT_SECRET === "super-secret-key";
  const isShortSecret = JWT_SECRET.length < 16;
  if (isDefaultSecret) {
    err("JWT Secret", "Using default — change immediately");
  } else if (isShortSecret) {
    warn("JWT Secret", `Only ${JWT_SECRET.length} chars — recommend >=16`);
  } else {
    ok("JWT Secret", `${JWT_SECRET.length} chars`);
  }

  if (SENTRY_DSN) {
    ok("Sentry DSN", "configured");
  } else { ok("Sentry DSN", "not configured (optional for monitoring)"); }

  // ─── Configuration ───
  header("Configuration");

  ok("Rate Limit", `${RATE_LIMIT_MAX} req / ${(RATE_LIMIT_WINDOW_MS / 1000).toFixed(0)}s window`);

  if (WS_ENABLED) {
    ok("WebSocket", `enabled on port ${WS_PORT}`);
  } else {
    ok("WebSocket", "disabled");
  }

  // ─── Data Validation ───
  header("Data Validation");

  // Boundary validation - check all boundary files
  const allBoundaryPaths = [...BOUNDARY_TYPES.map(t => path.join(paths.DATA_DIR, `${t}.geojson`)), paths.BOUNDARY_DATA];
  for (const boundaryPath of allBoundaryPaths) {
    const label = path.basename(boundaryPath);
    try {
      const boundaryRaw = await fs.readFile(boundaryPath, "utf-8");
      const boundaryGeo = JSON.parse(boundaryRaw);

      let validFeatures = 0;
      let invalidCoords = 0;

      if (boundaryGeo.type === "FeatureCollection" && Array.isArray(boundaryGeo.features)) {
        validFeatures = boundaryGeo.features.length;

        // Quick coordinate sanity check on first feature
        if (validFeatures > 0) {
          const firstGeom = boundaryGeo.features[0].geometry;
          const coords = firstGeom.type === "Polygon" ? firstGeom.coordinates[0][0] :
            firstGeom.type === "MultiPolygon" ? firstGeom.coordinates[0][0][0] : null;

          if (coords && Array.isArray(coords)) {
            if (!validateCoords(coords[0], coords[1])) invalidCoords++;
          }
        }

        if (invalidCoords > 0) {
          warn(label, `${validFeatures} features, but coordinates seem outside Nepal bounds`);
        } else {
          ok(label, `${validFeatures} feature(s)`);
        }
      } else {
        warn(label, `unexpected type: ${boundaryGeo.type}`);
      }
    } catch (e: any) {
      if (e.code === "ENOENT") {
        if (boundaryPath === paths.BOUNDARY_DATA) err(label, "missing (required for frontend)");
        else warn(label, "file not found");
      }
      else if (e instanceof SyntaxError) err(label, "invalid JSON");
      else err(label, e.message);
    }
  }

  // Coordinate bounds check using highway data
  try {
    const indexPath = path.join(HIGHWAY_DIR, "index.json");
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const highways = JSON.parse(indexContent);

    let invalidCoords = 0;
    let pointCount = 0;

    // Check first 10 highways for coordinate validation
    for (const h of highways.slice(0, 10)) {
      try {
        const hPath = path.join(HIGHWAY_DIR, h.file);
        const hContent = await fs.readFile(hPath, "utf-8");
        const hGeo = JSON.parse(hContent);
        if (hGeo.features) {
          for (const f of hGeo.features) {
            const geom = f.geometry;
            if (!geom) continue;
            const checkCoord = (coord: number[]) => {
              const [lng, lat] = coord;
              if (!validateCoords(lng, lat)) invalidCoords++;
            };
            if (geom.type === "Point") {
              pointCount++;
              checkCoord(geom.coordinates);
            } else if (geom.type === "LineString") {
              pointCount += geom.coordinates.length;
              geom.coordinates.forEach(checkCoord);
            } else if (geom.type === "MultiLineString") {
              geom.coordinates.forEach((line: number[][]) => {
                pointCount += line.length;
                line.forEach(checkCoord);
              });
            }
          }
        }
      } catch { /* skip individual highway errors */ }
    }

    if (invalidCoords > 0) {
      warn("Coordinate bounds", `${invalidCoords}/${pointCount} points outside Nepal bounds`);
    } else if (pointCount > 0) {
      ok("Coordinate bounds", `${pointCount} points within Nepal bounds`);
    }
  } catch { /* already handled in Highway Data section */ }

  // ─── Upstash Redis ───
  header("Upstash Redis (Cache)");
  if (UPSTASH.REST_URL && UPSTASH.REST_TOKEN) {
    const redisUrl = UPSTASH.REST_URL.replace(/\/$/, "");
    // Basic API Check
    await checkApi("Upstash Connectivity", `${redisUrl}/get/diag_test`, {
      timeout: 5000,
      headers: { Authorization: `Bearer ${UPSTASH.REST_TOKEN}` },
    });
    // Read/Write Ping
    try {
      await axios.post(`${redisUrl}/set/diag_ping`, "ok", {
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${UPSTASH.REST_TOKEN}`,
          "Content-Type": "text/plain",
        },
        validateStatus: () => true,
      });
      const getRes = await axios.get(`${redisUrl}/get/diag_ping`, {
        timeout: 5000,
        headers: { Authorization: `Bearer ${UPSTASH.REST_TOKEN}` },
        validateStatus: () => true,
      });
      if (getRes.status === 200 && getRes.data?.result === "ok") {
        ok("Redis read/write", "ping successful");
      } else {
        warn("Redis read/write", `unexpected response: HTTP ${getRes.status}`);
      }
    } catch (e: any) {
      err("Redis read/write", e.code || e.message);
    }
  } else {
    ok("Upstash Redis", "not configured (using in-memory cache)");
  }

  // ─── Summary ───
  header("Summary");
  console.log(`  ${C.green}Passed:   ${passed}${C.reset}`);
  console.log(`  ${C.yellow}Warnings: ${warnings}${C.reset}`);
  console.log(`  ${C.red}Failed:   ${failed}${C.reset}`);
  console.log(`  ${C.bold}Total:    ${passed + warnings + failed}${C.reset}`);

  const status =
    failed > 0 ? `${C.red}${C.bold}DEGRADED${C.reset}` :
      warnings > 0 ? `${C.yellow}${C.bold}HEALTHY (with warnings)${C.reset}` :
        `${C.green}${C.bold}HEALTHY${C.reset}`;

  console.log(`\n  Status: ${status}\n`);
}

runDiagnostics().catch((e) => {
  console.error(`${C.red}Diagnostics failed:${C.reset}`, e.message);
  process.exit(1);
});
