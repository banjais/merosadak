/**
 * RESTORED - see artifacts
 * TEMPORARY stub while full file is restored
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
    return jsonResponse(env, {
      source: "dhm",
      syncedAt: new Date().toISOString(),
      thresholdsMm: DHM_THRESHOLDS,
      stationCount: stations.length,
      stations: stations.slice(0, 150),
      warnings: stations.filter((s) => s.isWarning || s.isDanger).slice(0, 80),
      attribution: "DHM Nepal https://www.dhm.gov.np/",
    }, 200, { "Cache-Control": "public, max-age=120, s-maxage=300" });
  } catch (e: any) {
    return jsonResponse(env, { source: "dhm-error", stations: [], warnings: [], note: e?.message || "fail", syncedAt: new Date().toISOString() });
  }
}

async function handleWeather(url: URL, env: Env): Promise<Response> {
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (!lat || !lon) {
    return jsonResponse(env, { source: "none", current: null, note: "lat/lon required" });
  }
  try {
    const res = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation&timezone=Asia%2FKathmandu`);
    if (res.ok) {
      const data = await res.json<any>();
      return jsonResponse(env, { source: "open-meteo", ...data });
    }
  } catch {}
  return jsonResponse(env, { source: "none", current: null, note: "Weather unavailable" });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      return jsonResponse(env, { ok: true, service: "merosadak" });
    }
    if (url.pathname === "/api/dhm-rainfall" && request.method === "GET") {
      return handleDhmRainfall(url, env);
    }
    if (url.pathname === "/api/weather") {
      return handleWeather(url, env);
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
    return jsonResponse(env, { error: "not found", note: "Full worker restore in progress; DHM rainfall and weather active" }, 404);
  },
};
