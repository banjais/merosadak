/**
 * Mero Sadak Worker — free-first APIs (DHM, Open-Meteo, Overpass via client, KV data)
 */
import { DHM_RAIN_API, DHM_THRESHOLDS, normalizeDhmRainfall } from "./dhm-rainfall";
import { normalizeAccountEmail, SUPER_ADMIN_EMAIL, type AccessRole, type OfficeAdmin } from "../../shared/accessControl";

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
  FIREBASE_API_KEY: string;
  DATA: KVNamespace;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
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

interface VerifiedIdentity {
  email: string;
}

async function verifyFirebaseIdentity(request: Request, env: Env): Promise<VerifiedIdentity | Response> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse(env, { error: "Sign-in required" }, 401);
  if (!env.FIREBASE_API_KEY) {
    console.error("[Mero Sadak] Firebase identity verification is not configured.");
    return jsonResponse(env, { error: "Sign-in services are unavailable" }, 503);
  }

  try {
    const response = await fetchWithTimeout(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        timeoutMs: 8000,
      }
    );
    if (response.status === 400 || response.status === 401) {
      return jsonResponse(env, { error: "Your sign-in has expired. Please sign in again." }, 401);
    }
    if (!response.ok) {
      console.error("[Mero Sadak] Firebase identity verification returned", response.status);
      return jsonResponse(env, { error: "Could not verify your sign-in. Please try again." }, 503);
    }

    const result = await response.json<{
      users?: Array<{
        email?: string;
        emailVerified?: boolean;
        providerUserInfo?: Array<{ providerId?: string }>;
      }>;
    }>();
    const account = result.users?.[0];
    const email = account?.email ? normalizeAccountEmail(account.email) : "";
    const isGoogleAccount = account?.providerUserInfo?.some((provider) => provider.providerId === "google.com");
    if (!email || !account?.emailVerified || !isGoogleAccount) {
      return jsonResponse(env, { error: "Use a verified Google account to access Mero Sadak." }, 403);
    }
    return { email };
  } catch (error) {
    console.error("[Mero Sadak] Firebase identity verification failed:", error);
    return jsonResponse(env, { error: "Could not verify your sign-in. Please try again." }, 503);
  }
}

async function getOfficeAdmins(env: Env): Promise<OfficeAdmin[]> {
  const stored = await env.DATA.get("access-control:office-admins");
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error("Stored office administrator list is invalid.");
  }
  const officeAdmins: OfficeAdmin[] = [];
  for (const entry of parsed) {
    if (
      !entry || typeof entry !== "object" ||
      typeof entry.email !== "string" ||
      typeof entry.addedAt !== "string" ||
      typeof entry.addedBy !== "string"
    ) {
      throw new Error("Stored office administrator list is invalid.");
    }
    const email = normalizeAccountEmail(entry.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === normalizeAccountEmail(SUPER_ADMIN_EMAIL)) {
      throw new Error("Stored office administrator email is invalid.");
    }
    officeAdmins.push({ email, addedAt: entry.addedAt, addedBy: entry.addedBy });
  }
  return officeAdmins;
}

function roleForEmail(email: string, officeAdmins: OfficeAdmin[]): AccessRole {
  if (email === normalizeAccountEmail(SUPER_ADMIN_EMAIL)) return "SuperAdmin";
  if (officeAdmins.some((officeAdmin) => officeAdmin.email === email)) return "OfficeAdmin";
  return "GeneralUser";
}

async function handleAccessProfile(request: Request, env: Env): Promise<Response> {
  const identity = await verifyFirebaseIdentity(request, env);
  if (identity instanceof Response) return identity;
  try {
    const officeAdmins = await getOfficeAdmins(env);
    return jsonResponse(env, {
      email: identity.email,
      role: roleForEmail(identity.email, officeAdmins),
    }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[Mero Sadak] Failed to read access roles:", error);
    return jsonResponse(env, { error: "Could not load account permissions. Please try again." }, 503);
  }
}

async function handleOfficeAdmins(request: Request, env: Env): Promise<Response> {
  const identity = await verifyFirebaseIdentity(request, env);
  if (identity instanceof Response) return identity;
  if (identity.email !== normalizeAccountEmail(SUPER_ADMIN_EMAIL)) {
    return jsonResponse(env, { error: "Only the SuperAdmin can manage OfficeAdmin accounts." }, 403);
  }

  try {
    const officeAdmins = await getOfficeAdmins(env);
    if (request.method === "GET") {
      return jsonResponse(env, { officeAdmins }, 200, { "Cache-Control": "no-store" });
    }
    if (request.method !== "POST") {
      return jsonResponse(env, { error: "Method not allowed" }, 405);
    }

    let body: { action?: unknown; email?: unknown };
    try {
      body = await request.json<{ action?: unknown; email?: unknown }>();
    } catch {
      return jsonResponse(env, { error: "Request body must be valid JSON." }, 400);
    }
    const email = typeof body.email === "string" ? normalizeAccountEmail(body.email) : "";
    if (body.action !== "add" && body.action !== "remove") {
      return jsonResponse(env, { error: "Choose whether to add or remove an OfficeAdmin." }, 400);
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(env, { error: "Enter a valid email address." }, 400);
    }
    if (email === normalizeAccountEmail(SUPER_ADMIN_EMAIL)) {
      return jsonResponse(env, { error: "The SuperAdmin account cannot be changed from this list." }, 400);
    }

    const updatedAdmins = body.action === "add"
      ? officeAdmins.some((officeAdmin) => officeAdmin.email === email)
        ? officeAdmins
        : [...officeAdmins, { email, addedAt: new Date().toISOString(), addedBy: identity.email }]
      : officeAdmins.filter((officeAdmin) => officeAdmin.email !== email);
    updatedAdmins.sort((a, b) => a.email.localeCompare(b.email));
    await env.DATA.put("access-control:office-admins", JSON.stringify(updatedAdmins));
    return jsonResponse(env, { officeAdmins: updatedAdmins }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[Mero Sadak] OfficeAdmin management failed:", error);
    return jsonResponse(env, { error: "Could not update OfficeAdmin accounts. Please try again." }, 503);
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
    const prompt = `You are a Nepal highway route planner. Parse the user's natural language query and return a JSON object with: origin, destination, vehicle (car/suv_4wd/electric_vehicle/bike), preference (fastest/shortest/scenic/safest/ev_optimized), and any terrain filters (avoidHighPasses, requirePavedOnly, avoidSteepGrades, avoidActiveLandslideZones, maxElevationM). Query: "${query}"`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return jsonResponse(env, { parsed: text });
  } catch (e: any) {
    return jsonResponse(env, { error: "AI query failed", note: e?.message }, 500);
  }
}

async function handleAiRouteAdvisor(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { origin, destination, routePlan } = body;
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(env, { error: "AI service not configured" }, 503);
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL_PRIMARY || "gemini-1.5-flash" });
    const prompt = `You are a Nepal highway expert. Provide a concise advisory for a trip from ${origin} to ${destination}. Route details: ${JSON.stringify(routePlan)}. Return JSON with: summary, riskLevel, keyRecommendations (array), monsoonOrWeatherWarning, bestDepartureWindow, emergencyContacts (array).`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return jsonResponse(env, { advisory: text });
  } catch (e: any) {
    return jsonResponse(env, { error: "AI advisor failed", note: e?.message }, 500);
  }
}

async function handleAiTripAssistant(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<any>();
    const { query, context } = body;
    if (!query || typeof query !== "string") {
      return jsonResponse(env, { error: "Query string is required" }, 400);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(env, { error: "AI service not configured" }, 503);
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL_PRIMARY || "gemini-1.5-flash" });
    const prompt = `You are a Nepal trip planning assistant. Context: ${JSON.stringify(context || {})}. User query: "${query}". Provide helpful trip planning advice including routes, stops, fuel, weather, permits. Return JSON with response.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return jsonResponse(env, { response: text });
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
    if (url.pathname === "/api/access/profile" && request.method === "GET") {
      return handleAccessProfile(request, env);
    }
    if (url.pathname === "/api/access/office-admins" && (request.method === "GET" || request.method === "POST")) {
      return handleOfficeAdmins(request, env);
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
