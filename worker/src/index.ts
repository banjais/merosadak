/**
 * Mero Sadak Worker — free-first APIs (DHM, Open-Meteo, Overpass via client, KV data)
 */
import { DHM_RAIN_API, DHM_THRESHOLDS, normalizeDhmRainfall } from "./dhm-rainfall";

export interface Env {
  TOMTOM_API_KEY: string;
  OPENWEATHERMAP_API_KEY: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL_PRIMARY: string;
  GEMINI_MODEL_SECONDARY: string;
  WAZE_FEED_URL: string;
  DOR_GOOGLE_SHEET_URL: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  ALLOWED_ORIGIN: string;
  DATA: KVNamespace;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(env: Env, body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env), ...headers },
  });
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonData<T>(env: Env, key: string, fallback: T): Promise<T> {
  try {
    const raw = await env.DATA?.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function handleDhmRainfall(url: URL, env: Env): Promise<Response> {
  const warningsOnly = url.searchParams.get("warnings") === "1";
  try {
    const res = await fetchWithTimeout(DHM_RAIN_API, {
      headers: { Accept: "application/json", "User-Agent": "MeroSadak/1.0" },
      timeoutMs: 12000,
    } as any);
    if (!res.ok) {
      return jsonResponse(env, { source: "dhm-unavailable", stations: [], warnings: [], syncedAt: new Date().toISOString() });
    }
    const raw = await res.json<any>();
    let stations = normalizeDhmRainfall(raw);
    if (warningsOnly) stations = stations.filter((s) => s.isWarning || s.isDanger);
    stations.sort((a, b) => Number(b.isDanger) - Number(a.isDanger) || Number(b.isWarning) - Number(a.isWarning));
    return jsonResponse(
      env,
      {
        source: "dhm",
        syncedAt: new Date().toISOString(),
        thresholdsMm: DHM_THRESHOLDS,
        stationCount: stations.length,
        stations: stations.slice(0, 150),
        warnings: stations.filter((s) => s.isWarning || s.isDanger).slice(0, 80),
        attribution: "DHM Nepal https://www.dhm.gov.np/",
      },
      200,
      { "Cache-Control": "public, max-age=120, s-maxage=300" }
    );
  } catch (e: any) {
    return jsonResponse(env, {
      source: "dhm-error",
      stations: [],
      warnings: [],
      note: e?.message || "fail",
      syncedAt: new Date().toISOString(),
    });
  }
}

async function handleWeather(url: URL, env: Env): Promise<Response> {
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (!lat || !lon) {
    const weatherNodes = await readJsonData<any[]>(env, "mountain-weather.json", []);
    return jsonResponse(env, { weatherNodes, source: "baseline", syncedAt: new Date().toISOString() });
  }
  try {
    const res = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FKathmandu`
    );
    if (res.ok) {
      const data = await res.json<any>();
      return jsonResponse(env, { source: "open-meteo", ...data });
    }
  } catch {}
  if (env.OPENWEATHERMAP_API_KEY) {
    try {
      const res = await fetchWithTimeout(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${env.OPENWEATHERMAP_API_KEY}`
      );
      if (res.ok) {
        const owm = await res.json<any>();
        return jsonResponse(env, {
          source: "openweathermap",
          current: {
            temperature_2m: owm.main?.temp,
            wind_speed_10m: owm.wind?.speed,
            relative_humidity_2m: owm.main?.humidity,
            precipitation: owm.rain?.["1h"] || 0,
          },
        });
      }
    } catch {}
  }
  return jsonResponse(env, { source: "none", current: null, note: "Weather unavailable" });
}

async function handleRoadAlerts(env: Env): Promise<Response> {
  let dorIncidents: any[] = [];
  if (env.DOR_GOOGLE_SHEET_URL) {
    try {
      const res = await fetchWithTimeout(env.DOR_GOOGLE_SHEET_URL);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length >= 2) {
          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
          const idx = (name: string) => headers.indexOf(name);
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",");
            const get = (name: string) => (cols[idx(name)] || "").trim();
            const status = get("status") || "";
            if (!status || status.toLowerCase() === "clear") continue;
            const roadRef = get("road_refno") || "";
            const roadName = get("road_name") || roadRef;
            dorIncidents.push({
              id: `dor-${i}-${roadRef}`.replace(/\s+/g, "-"),
              highwayCode: roadRef,
              highwayName: roadName,
              locationName: get("incidentplace") || get("dist_name") || "Unknown",
              type: "landslide",
              severity: "moderate",
              title: `${status}: ${roadName}`,
              description: get("remarks") || status,
              status: "caution",
              reportedAt: get("incidentstarted") || new Date().toISOString(),
              dorVerified: true,
              source: "dor",
            });
          }
        }
      }
    } catch {}
  }
  let wazeIncidents: any[] = [];
  if (env.WAZE_FEED_URL) {
    try {
      const data = await fetchWithTimeout(env.WAZE_FEED_URL).then((r) => r.json<any>());
      for (const a of data.alerts || []) {
        wazeIncidents.push({
          id: `waze-${a.uuid || Math.random().toString(36).slice(2)}`,
          locationName: a.street || "Unknown",
          lat: a.location?.y,
          lng: a.location?.x,
          type: a.type || "traffic_jam",
          title: `${a.type || "Alert"}: ${a.reportDescription || ""}`.trim(),
          description: a.reportDescription || "",
          status: "caution",
          reportedAt: new Date(a.startTime || Date.now()).toISOString(),
          source: "waze",
        });
      }
    } catch {}
  }
  const local = await readJsonData<any[]>(env, "incidents.json", []);
  const merged = [...dorIncidents, ...wazeIncidents, ...(Array.isArray(local) ? local : [])];
  return jsonResponse(env, {
    source: "dor+waze+local",
    syncedAt: new Date().toISOString(),
    incidents: merged,
    counts: { dor: dorIncidents.length, waze: wazeIncidents.length, local: Array.isArray(local) ? local.length : 0, total: merged.length },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/api/health") {
      return jsonResponse(env, { ok: true, service: "merosadak", free: ["dhm", "open-meteo"] });
    }
    if (url.pathname === "/api/dhm-rainfall" && request.method === "GET") {
      return handleDhmRainfall(url, env);
    }
    if (url.pathname === "/api/weather") {
      return handleWeather(url, env);
    }
    if (url.pathname === "/api/road-alerts") {
      return handleRoadAlerts(env);
    }
    if (url.pathname === "/api/highways" && request.method === "GET") {
      const highways = await readJsonData<any[]>(env, "highway/index.json", []);
      return jsonResponse(env, { highways, source: "local_static" });
    }
    if (url.pathname === "/api/cities" && request.method === "GET") {
      const cities = await readJsonData<any[]>(env, "cities-and-junctions.json", []);
      return jsonResponse(env, { cities, source: "local_static" });
    }
    if (url.pathname === "/api/pois" && request.method === "GET") {
      const pois = await readJsonData<any[]>(env, "pois.json", []);
      return jsonResponse(env, { pois, source: "kv" });
    }
    if (url.pathname === "/api/offline-bundle" && request.method === "GET") {
      const [highways, cities, incidents, pois] = await Promise.all([
        readJsonData<any[]>(env, "highway/index.json", []),
        readJsonData<any[]>(env, "cities-and-junctions.json", []),
        readJsonData<any[]>(env, "incidents.json", []),
        readJsonData<any[]>(env, "pois.json", []),
      ]);
      return jsonResponse(env, { version: "1.6.0", syncedAt: new Date().toISOString(), highways, cities, incidents, pois });
    }
    if (url.pathname.startsWith("/api/data/") && request.method === "GET") {
      const key = url.pathname.replace("/api/data/", "");
      const value = await env.DATA.get(key);
      if (!value) return jsonResponse(env, { error: "not found", key }, 404);
      return new Response(value, {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60", ...corsHeaders(env) },
      });
    }
    return jsonResponse(env, { error: "not found" }, 404);
  },
};
