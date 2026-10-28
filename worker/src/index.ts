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

/* ==================== EMOTION DETECTION ==================== */
type UserEmotion = 'calm' | 'urgent' | 'stressed' | 'tired' | 'anxious' | 'excited' | 'relaxed';

const EMOTION_KEYWORDS: Record<UserEmotion, string[]> = {
  calm: ['calm', 'relaxed', 'peaceful', 'chill', 'fine', 'okay', 'normal'],
  urgent: ['urgent', 'rush', 'asap', 'immediately', 'now', 'quickly', 'fast', 'emergency'],
  stressed: ['stress', 'stressed', 'overwhelmed', 'pressure', 'tense', 'worried about time'],
  tired: ['tired', 'sleepy', 'exhausted', 'fatigue', 'rest', 'break', 'sleep'],
  anxious: ['anxious', 'scared', 'afraid', 'nervous', 'dangerous', 'risky', 'unsafe', 'fear'],
  excited: ['excited', 'amazing', 'great', 'awesome', 'love', 'fantastic', 'thrilled'],
  relaxed: ['relax', 'chill', 'easy', 'slow', 'leisure', 'enjoy', 'cruise'],
};

function detectEmotion(text: string): UserEmotion {
  const lower = text.toLowerCase();
  let best: UserEmotion = 'calm';
  let bestCount = 0;
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let count = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = emotion as UserEmotion;
    }
  }
  return best;
}

function emotionTone(emotion: UserEmotion): string {
  const tones: Record<UserEmotion, string> = {
    calm: 'Speak in a steady, reassuring, balanced tone. Keep it clear and concise.',
    urgent: 'Speak with urgency and brevity. Prioritize the fastest, safest route. Get to the point quickly.',
    stressed: 'Speak gently and reassuringly. Acknowledge the pressure. Offer simple, calming guidance.',
    tired: 'Speak warmly and encouragingly. Suggest rest stops, breaks, and shorter driving segments.',
    anxious: 'Speak calmly and supportively. Emphasize safety, alternative routes, and emergency contacts.',
    excited: 'Speak with enthusiasm and energy. Highlight scenic spots, local food, and fun experiences.',
    relaxed: 'Speak in a laid-back, friendly tone. Suggest leisurely stops and scenic detours.',
  };
  return tones[emotion];
}

function buildSystemPrompt(role: string, context?: Record<string, any>, emotion?: UserEmotion): string {
  const emotionLine = emotion ? `\nUser emotion detected: ${emotion}. ${emotionTone(emotion)}` : '';
  const contextLine = context ? `\nRoute context: ${JSON.stringify(context)}` : '';
  return `You are Mero Sadak AI — a Nepal highway travel assistant. ${role}.${emotionLine}${contextLine}

Rules:
- Always answer in the user's language (English or Nepali as appropriate).
- Be helpful, safe, and accurate about Nepal highways, roads, fuel, tolls, and weather.
- Never make up toll prices, fuel rates, or road conditions — say "unknown" if unsure.
- Format responses as clean JSON when requested.
- Keep responses practical and actionable for travelers on Nepal's highways.`;
}

/* ==================== KV DATA UPDATE HELPERS ==================== */

async function updateFuelPrices(env: Env, updates: Record<string, number>): Promise<any> {
  const current = await readJsonData<any>(env, "fuel-prices.json", { prices: {}, lastUpdated: new Date().toISOString() });
  current.prices = { ...current.prices, ...updates };
  current.lastUpdated = new Date().toISOString();
  current.source = "admin-ai-command";
  await env.DATA.put("fuel-prices.json", JSON.stringify(current));
  return { updated: updates, saved: current };
}

async function updateTollRates(env: Env, updates: Record<string, any>): Promise<any> {
  const current = await readJsonData<any>(env, "toll-rates.json", { tolls: [], lastUpdated: new Date().toISOString() });
  current.tolls = updates.tolls || current.tolls;
  current.lastUpdated = new Date().toISOString();
  current.source = "admin-ai-command";
  await env.DATA.put("toll-rates.json", JSON.stringify(current));
  return { updated: updates.tolls, saved: current };
}

async function addIncident(env: Env, incident: any): Promise<any> {
  const reports = await readJsonData<any[]>(env, "user-reports.json", []);
  const newReport = {
    id: `admin-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...incident,
    reporterId: "admin-ai",
    upvotes: 0,
    createdAt: new Date().toISOString(),
    status: "active",
    verified: true,
  };
  reports.unshift(newReport);
  await env.DATA.put("user-reports.json", JSON.stringify(reports.slice(0, 500)));
  return { added: newReport };
}

async function updateCityData(env: Env, updates: any[]): Promise<any> {
  const current = await readJsonData<any[]>(env, "cities-and-junctions.json", []);
  const merged = [...current, ...updates];
  await env.DATA.put("cities-and-junctions.json", JSON.stringify(merged));
  return { added: updates.length, total: merged.length };
}

/* ==================== ADMIN COMMAND PARSING ==================== */

async function handleAiAdminCommand(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { command, adminKey } = body;

    if (!command || typeof command !== "string") {
      return jsonResponse(env, { error: "Command string is required" }, 400);
    }
    if (!adminKey || adminKey !== env.DOR_GOOGLE_SHEET_URL) {
      // Simple admin key check — in production use a proper secret
      return jsonResponse(env, { error: "Admin authentication required" }, 403);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(env, { error: "AI service not configured" }, 503);
    }

    const emotion = detectEmotion(command);
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL_PRIMARY || "gemini-1.5-flash" });

    const prompt = buildSystemPrompt(
      "You are an admin data manager for Mero Sadak. Parse the admin's natural language command and return JSON with: action (update_fuel | update_tolls | add_incident | update_cities | unknown), details (structured data for the action), confirmation (human-readable summary). If unsure, set action to 'unknown'.",
      { emotion },
      emotion
    );

    const result = await model.generateContent(`${prompt}\n\nAdmin command: "${command}"`);
    const text = result.response.text();

    // Try to parse the AI's JSON response
    let parsed: any = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {}

    // Execute the parsed action
    let execution: any = { action: parsed?.action || 'unknown', details: parsed?.details || null };

    if (parsed?.action === 'update_fuel' && parsed?.details) {
      execution.result = await updateFuelPrices(env, parsed.details);
    } else if (parsed?.action === 'update_tolls' && parsed?.details) {
      execution.result = await updateTollRates(env, parsed.details);
    } else if (parsed?.action === 'add_incident' && parsed?.details) {
      execution.result = await addIncident(env, parsed.details);
    } else if (parsed?.action === 'update_cities' && parsed?.details) {
      execution.result = await updateCityData(env, parsed.details);
    }

    return jsonResponse(env, {
      emotion,
      aiResponse: text,
      parsed,
      execution,
      confirmed: execution.action !== 'unknown',
    });
  } catch (e: any) {
    return jsonResponse(env, { error: "AI admin command failed", note: e?.message }, 500);
  }
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

async function handleCalculateRoute(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { originId, destinationId, preference, vehicle } = body;
    if (!originId || !destinationId) {
      return jsonResponse(env, { error: "Origin and destination are required" }, 400);
    }
    // Route calculation is done client-side using the comprehensive distance service
    // Worker serves static data (road-graph.json, snh-reference.json) for client-side calculation
    const roadGraph = await readJsonData<any>(env, "road-graph.json", null);
    const snhRef = await readJsonData<any>(env, "snh-reference.json", null);
    return jsonResponse(env, {
      note: "Route calculation should be performed client-side using comprehensiveDistance.ts",
      availableData: {
        roadGraph: !!roadGraph,
        snhReference: !!snhRef,
      },
    });
  } catch (e: any) {
    return jsonResponse(env, { error: "Invalid request", note: e?.message }, 400);
  }
}

async function handleAiSmartRouteQuery(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { query } = body;
    if (!query || typeof query !== "string") {
      return jsonResponse(env, { error: "Query string is required" }, 400);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(env, { error: "AI service not configured" }, 503);
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL_PRIMARY || "gemini-1.5-flash" });
    const emotion = detectEmotion(query);
    const prompt = buildSystemPrompt(
      "You are a Nepal highway route planner. Parse the user's natural language query and return a JSON object with: origin, destination, vehicle (car/suv_4wd/electric_vehicle/bike), preference (fastest/shortest/scenic/safest/ev_optimized), and any terrain filters (avoidHighPasses, requirePavedOnly, avoidSteepGrades, avoidActiveLandslideZones, maxElevationM).",
      { emotion },
      emotion
    );
    const result = await model.generateContent(`${prompt}\n\nQuery: "${query}"`);
    const text = result.response.text();
    return jsonResponse(env, { parsed: text, emotion });
  } catch (e: any) {
    return jsonResponse(env, { error: "AI query failed", note: e?.message }, 500);
  }
}

async function handleAiRouteAdvisor(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { origin, destination, routePlan, userEmotion } = body;
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(env, { error: "AI service not configured" }, 503);
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL_PRIMARY || "gemini-1.5-flash" });
    const emotion = userEmotion || detectEmotion(JSON.stringify({ origin, destination, routePlan }));
    const prompt = buildSystemPrompt(
      "You are a Nepal highway expert. Provide a concise safety advisory for a trip. Return JSON with: summary, riskLevel, keyRecommendations (array), monsoonOrWeatherWarning, bestDepartureWindow, emergencyContacts (array). Tailor your tone to the user's detected emotion.",
      { origin, destination, routePlan },
      emotion
    );
    const result = await model.generateContent(`${prompt}\n\nTrip from ${origin} to ${destination}. Route details: ${JSON.stringify(routePlan)}`);
    const text = result.response.text();
    return jsonResponse(env, { advisory: text, emotion });
  } catch (e: any) {
    return jsonResponse(env, { error: "AI advisor failed", note: e?.message }, 500);
  }
}

async function handleAiTripAssistant(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { query, context, userEmotion } = body;
    if (!query || typeof query !== "string") {
      return jsonResponse(env, { error: "Query string is required" }, 400);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(env, { error: "AI service not configured" }, 503);
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL_PRIMARY || "gemini-1.5-flash" });
    const emotion = userEmotion || detectEmotion(query);
    const prompt = buildSystemPrompt(
      "You are a Nepal trip planning assistant. Provide helpful trip planning advice including routes, stops, fuel, weather, permits. Return JSON with response. Tailor your tone to the user's detected emotion.",
      { ...context, emotion },
      emotion
    );
    const result = await model.generateContent(`${prompt}\n\nContext: ${JSON.stringify(context || {})}. User query: "${query}"`);
    const text = result.response.text();
    return jsonResponse(env, { response: text, emotion });
  } catch (e: any) {
    return jsonResponse(env, { error: "AI assistant failed", note: e?.message }, 500);
  }
}

async function handleSubmitReport(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { type, location, description, latitude, longitude, reporterId } = body;
    if (!type || !location || !description) {
      return jsonResponse(env, { error: "Type, location, and description are required" }, 400);
    }
    const reports = await readJsonData<any[]>(env, "user-reports.json", []);
    const newReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      location,
      description,
      latitude,
      longitude,
      reporterId: reporterId || "anonymous",
      upvotes: 0,
      createdAt: new Date().toISOString(),
      status: "active",
    };
    reports.unshift(newReport);
    if (env.DATA) await env.DATA.put("user-reports.json", JSON.stringify(reports.slice(0, 500)));
    return jsonResponse(env, { report: newReport });
  } catch (e: any) {
    return jsonResponse(env, { error: "Failed to submit report", note: e?.message }, 500);
  }
}

async function handleUpvoteReport(request: Request, env: Env): Promise<Response> {
  try {
    const reportId = new URL(request.url).pathname.split("/").pop();
    if (!reportId) return jsonResponse(env, { error: "Report ID required" }, 400);
    const reports = await readJsonData<any[]>(env, "user-reports.json", []);
    const idx = reports.findIndex((r) => r.id === reportId);
    if (idx === -1) return jsonResponse(env, { error: "Report not found" }, 404);
    reports[idx].upvotes = (reports[idx].upvotes || 0) + 1;
    if (env.DATA) await env.DATA.put("user-reports.json", JSON.stringify(reports));
    return jsonResponse(env, { report: reports[idx] });
  } catch (e: any) {
    return jsonResponse(env, { error: "Failed to upvote", note: e?.message }, 500);
  }
}

async function handleCachedSegments(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method === "GET") {
      const segments = await readJsonData<any>(env, "cached-segments.json", { segments: [] });
      return jsonResponse(env, segments);
    }
    const body = await request.json<any>();
    const { segments } = body;
    if (!Array.isArray(segments)) {
      return jsonResponse(env, { error: "Segments array required" }, 400);
    }
    if (env.DATA) await env.DATA.put("cached-segments.json", JSON.stringify({ segments, updatedAt: new Date().toISOString() }));
    return jsonResponse(env, { ok: true, count: segments.length });
  } catch (e: any) {
    return jsonResponse(env, { error: "Cached segments error", note: e?.message }, 500);
  }
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
    if (url.pathname === "/api/fuel-prices" && request.method === "GET") {
      const fuel = await readJsonData<any>(env, "fuel-prices.json", null);
      return jsonResponse(env, fuel || { prices: null, source: "unavailable" });
    }
    if (url.pathname === "/api/toll-rates" && request.method === "GET") {
      const tolls = await readJsonData<any>(env, "toll-rates.json", { tolls: [] });
      return jsonResponse(env, tolls);
    }
    if (url.pathname === "/api/all-toll-rates" && request.method === "GET") {
      const allTolls = await readJsonData<any>(env, "all-toll-rates.json", { tolls: [] });
      return jsonResponse(env, allTolls);
    }
    if (url.pathname === "/api/traffic" && request.method === "GET") {
      const corridors = await readJsonData<any[]>(env, "traffic-corridors.json", []);
      return jsonResponse(env, { corridors, source: "local_static" });
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

    if (url.pathname === "/api/calculate-route" && request.method === "POST") {
      return handleCalculateRoute(request, env);
    }
    if (url.pathname === "/api/ai-smart-route-query" && request.method === "POST") {
      return handleAiSmartRouteQuery(request, env);
    }
    if (url.pathname === "/api/ai-route-advisor" && request.method === "POST") {
      return handleAiRouteAdvisor(request, env);
    }
    if (url.pathname === "/api/ai-trip-assistant" && request.method === "POST") {
      return handleAiTripAssistant(request, env);
    }
    if (url.pathname === "/api/ai-admin-command" && request.method === "POST") {
      return handleAiAdminCommand(request, env);
    }
    if (url.pathname === "/api/submit-report" && request.method === "POST") {
      return handleSubmitReport(request, env);
    }
    if (url.pathname.match(/^\/api\/upvote-report\/[^/]+$/) && request.method === "POST") {
      return handleUpvoteReport(request, env);
    }
    if (url.pathname === "/api/cached-segments" && (request.method === "GET" || request.method === "POST")) {
      return handleCachedSegments(request, env);
    }

    return jsonResponse(env, { error: "not found" }, 404);
  },
};
