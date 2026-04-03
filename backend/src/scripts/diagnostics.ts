// backend/src/scripts/diagnostics.ts
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import paths from "../config/paths.js";
import { ROAD_STATUS } from "../constants/sheets.js";
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

const ok   = (l: string, d = "") => { passed++;   console.log(`  ${PASS} ${l}${d ? `  ${C.dim}${d}${C.reset}` : ""}`); };
const err  = (l: string, d = "") => { failed++;   console.log(`  ${FAIL} ${l}${d ? `  ${C.red}${d}${C.reset}` : ""}`); };
const warn = (l: string, d = "") => { warnings++; console.log(`  ${WARN} ${l}${d ? `  ${C.dim}${d}${C.reset}` : ""}`); };

function header(title: string) {
  console.log(`\n${C.cyan}${C.bold}── ${title} ${"─".repeat(Math.max(0, 54 - title.length))}${C.reset}`);
}

// ─── API Check Helper ───
async function checkApi(label: string, url: string, opts?: { method?: string; timeout?: number; headers?: Record<string, string> }) {
  try {
    const res = await axios.get(url, {
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

  // ─── Sheet Data ───
  header("Road Incident Data");

  let gasRows = 0;
  let gasStatusCount: Record<string, number> = {};
  let mergedRows = 0;
  let mergedStatusCount = { Blocked: 0, "One-Lane": 0, Resumed: 0 };
  let droppedRows = 0;

  // 1. Fetch from GAS (Apps Script)
  try {
    const gasUrl = GAS_URL + (SHEET_TAB ? `?tab=${encodeURIComponent(SHEET_TAB)}` : "");
    const res = await axios.get(gasUrl, { timeout: 15000 });
    const gasData = res.data?.data || [];

    gasRows = gasData.length;

    gasData.forEach((row: any) => {
      const status = (row.status || "").toString().trim();
      gasStatusCount[status] = (gasStatusCount[status] || 0) + 1;
    });

    console.log(`  📡 Google Sheets (GAS)  →  ${gasRows} rows from tab '${SHEET_TAB || "default"}'`);
    console.log(`     Raw statuses: ${Object.entries(gasStatusCount).map(([k, v]) => `${k || "(empty)"}=${v}`).join(", ") || "none"}`);

    // Warn about non-standard status values
    const validStatuses = ["Blocked", "blocked", "BLOCKED", "One-Lane", "One Lane", "One Way", "One-Way", "One way", "one-lane", "Resumed", "resumed", "RESUMED"];
    for (const rawStatus of Object.keys(gasStatusCount)) {
      if (rawStatus && !validStatuses.includes(rawStatus)) {
        warn(`  GAS status '${rawStatus}'`, "Invalid — will be dropped during merge");
      }
    }
  } catch (e: any) {
    err("GAS Connection", e.message);
  }

  // 2. Fetch Merged Data (master.geojson)
  try {
    const masterPath = paths.BASE_DATA;
    const content = await fs.readFile(masterPath, "utf-8");
    const geojson = JSON.parse(content);
    const features = geojson.features || [];

    mergedRows = features.length;

    features.forEach((f: any) => {
      const status = f.properties?.status || "";
      if (status === ROAD_STATUS.BLOCKED) mergedStatusCount.Blocked++;
      else if (status === ROAD_STATUS.ONE_LANE) mergedStatusCount["One-Lane"]++;
      else if (status === ROAD_STATUS.RESUMED) mergedStatusCount.Resumed++;
    });

    const stats = await fs.stat(masterPath);
    const lastUpdated = new Date(stats.mtime);
    const ageMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);

    console.log(`\n  📦 Merged (master.geojson)  →  ${mergedRows} rows`);
    console.log(`     Last updated: ${lastUpdated.toLocaleString()} (${Math.round(ageMinutes)} min ago)`);

    if (ageMinutes > 30) {
      warn("Data freshness", `Stale — ${Math.round(ageMinutes)} min old, run 'npm run merge'`);
    }

    droppedRows = gasRows - mergedRows;
    if (droppedRows > 0) {
      warn("Rows dropped", `${droppedRows} rows dropped during merge (invalid status)`);
    } else if (gasRows > 0) {
      ok("Merge integrity", "All GAS rows merged");
    }

    // GAS vs merged comparison
    if (gasRows > 0 && gasRows !== mergedRows) {
      warn("GAS vs merged mismatch", `GAS: ${gasRows}, Merged: ${mergedRows}`);
    }
  } catch (e: any) {
    if (e.code === "ENOENT") {
      warn("Merged Data", "master.geojson not found — run 'npm run merge'");
    } else {
      err("Merged Data", e.message);
    }
  }

  // ─── Status Breakdown ───
  if (mergedRows > 0) {
    header("Status Breakdown");

    const total = mergedRows;
    const statuses = [
      { name: "Blocked",  count: mergedStatusCount.Blocked,    icon: "■" },
      { name: "One-Lane", count: mergedStatusCount["One-Lane"], icon: "▲" },
      { name: "Resumed",  count: mergedStatusCount.Resumed,    icon: "●" },
    ];

    for (const { name, count, icon } of statuses) {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
      const fn = count > 0 ? ok : warn;
      fn(`  ${icon} ${name}`, `${count}  (${pct}%)`);
    }
    console.log(`     Total: ${C.bold}${total}${C.reset}`);
  }

  // ─── Files ───
  header("Files");
  for (const f of [
    { label: `${SHEET_TAB || "Roads"} (master)`, p: paths.BASE_DATA },
    { label: "Boundary", p: paths.BOUNDARY_DATA },
  ]) {
    try {
      const s = await fs.stat(f.p);
      ok(f.label, `${(s.size / 1024).toFixed(0)} KB`);
    } catch { err(f.label, "not found"); }
  }

  // ─── Caches ───
  header("Caches");
  for (const c of [
    { label: SHEET_TAB || "Roads", p: paths.CACHE_ROAD },
    { label: "Traffic",  p: paths.CACHE_TRAFFIC },
    { label: "Weather",  p: paths.CACHE_WEATHER },
    { label: "POI",      p: paths.CACHE_POI },
    { label: "Alerts",   p: paths.CACHE_ALERTS },
    { label: "Monsoon",  p: paths.CACHE_MONSOON },
    { label: "Waze",     p: paths.CACHE_WAZE },
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
  } else { warn("Google Sheets (GAS)", "GAS_URL not set"); }

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
  await checkApi("Overpass (OSM)  [fallback]", `${OVERPASS_API_URL}/status`, { timeout: 8000 });

  // POI: TomTom (main) → Overpass (fallback) — TomTom checked above

  // Search: Local (main) → Nominatim (fallback)
  if (NOMINATIM_API_URL) {
    await checkApi("Nominatim  [search:fallback]", `${NOMINATIM_API_URL}/search?q=kathmandu&format=json&limit=1`, { timeout: 8000, headers: { "User-Agent": "MeroSadak-Diagnostics/1.0" } });
  }

  // Gemini AI
  if (GEMINI_API_KEY) {
    ok("Gemini AI  [ai]", "configured");
  } else { ok("Gemini AI", "not configured (optional feature)"); }

  // Upstash Redis
  if (UPSTASH.REST_URL && UPSTASH.REST_TOKEN) {
    const redisUrl = UPSTASH.REST_URL.replace(/\/$/, "");
    await checkApi("Upstash Redis  [cache]", `${redisUrl}/get/diag_test`, {
      timeout: 5000,
      headers: { Authorization: `Bearer ${UPSTASH.REST_TOKEN}` },
    });
  } else { ok("Upstash Redis", "not configured (using in-memory cache)"); }

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
  const memFn = mem.heapUsed / mem.heapTotal > 0.95 ? err : ok;
  memFn("Memory (heap)", `${heapUsedMB} / ${heapTotalMB} MB`);
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

  // Boundary validation
  try {
    const boundaryRaw = await fs.readFile(paths.BOUNDARY_DATA, "utf-8");
    const boundaryGeo = JSON.parse(boundaryRaw);
    if (boundaryGeo.type === "FeatureCollection" && Array.isArray(boundaryGeo.features)) {
      ok("Boundary GeoJSON", `${boundaryGeo.features.length} feature(s)`);
    } else if (boundaryGeo.type === "Feature") {
      ok("Boundary GeoJSON", "single Feature");
    } else {
      warn("Boundary GeoJSON", `unexpected type: ${boundaryGeo.type}`);
    }
  } catch (e: any) {
    if (e.code === "ENOENT") warn("Boundary GeoJSON", "file not found");
    else if (e instanceof SyntaxError) err("Boundary GeoJSON", "invalid JSON");
    else err("Boundary GeoJSON", e.message);
  }

  // Coordinate bounds check (Nepal: 80-88°E, 26-30°N)
  try {
    const masterRaw = await fs.readFile(paths.BASE_DATA, "utf-8");
    const masterGeo = JSON.parse(masterRaw);
    if (masterGeo.features?.length) {
      let invalidCoords = 0;
      let pointCount = 0;
      for (const f of masterGeo.features) {
        const geom = f.geometry;
        if (!geom) continue;
        const checkCoord = (coord: number[]) => {
          const [lng, lat] = coord;
          if (lng < 80 || lng > 88 || lat < 26 || lat > 30) invalidCoords++;
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
      if (invalidCoords > 0) {
        warn("Coordinate bounds", `${invalidCoords}/${pointCount} points outside Nepal bounds`);
      } else if (pointCount > 0) {
        ok("Coordinate bounds", `${pointCount} points within Nepal bounds`);
      }
    }
  } catch { /* already handled above */ }

  // ─── Upstash Redis Ping ───
  header("Upstash Redis");
  if (UPSTASH.REST_URL && UPSTASH.REST_TOKEN) {
    const redisUrl = UPSTASH.REST_URL.replace(/\/$/, "");
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
  }

  // ─── Summary ───
  header("Summary");
  console.log(`  ${C.green}Passed:   ${passed}${C.reset}`);
  console.log(`  ${C.yellow}Warnings: ${warnings}${C.reset}`);
  console.log(`  ${C.red}Failed:   ${failed}${C.reset}`);
  console.log(`  ${C.bold}Total:    ${passed + warnings + failed}${C.reset}`);

  const status =
    failed > 0       ? `${C.red}${C.bold}DEGRADED${C.reset}` :
    warnings > 0     ? `${C.yellow}${C.bold}HEALTHY (with warnings)${C.reset}` :
                       `${C.green}${C.bold}HEALTHY${C.reset}`;

  console.log(`\n  Status: ${status}\n`);
}

runDiagnostics().catch((e) => {
  console.error(`${C.red}Diagnostics failed:${C.reset}`, e.message);
  process.exit(1);
});
