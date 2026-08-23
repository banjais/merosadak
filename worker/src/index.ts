/**
 * Mero Sadak — Cloudflare Worker backend
 *
 * Purpose: proxy calls that need a paid/rate-limited API key so the key
 * never ships to the browser. Everything that has a free, keyless public
 * endpoint (Nominatim, Photon, OSRM, Open-Meteo) is called directly from
 * the frontend and does NOT need to go through this worker.
 *
 * Secrets are set with:
 *   wrangler secret put TOMTOM_API_KEY
 *   wrangler secret put GEMINI_API_KEY
 * Never put real key values in wrangler.toml or in this file.
 */

export interface Env {
  TOMTOM_API_KEY: string;
  OPENWEATHERMAP_API_KEY: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL_PRIMARY: string;
  GEMINI_MODEL_SECONDARY: string;
  WAZE_FEED_URL: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  ALLOWED_ORIGIN: string;
  DATA: KVNamespace;
}

function cors(env: Env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Haversine distance in km — used to find the nearest Waze jam to a point.
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchWazeAlerts(env: Env): Promise<any[]> {
  if (!env.WAZE_FEED_URL) return [];
  try {
    const data = await fetch(env.WAZE_FEED_URL).then(r => r.json<any>());
    return data.alerts || [];
  } catch {
    return [];
  }
}

// Road incidents: merges TomTom's Incidents API (accidents, roadworks,
// closures, hazards) with Waze's crowd-sourced alerts for the same area.
// Neither source alone has full coverage in Nepal, so both run and their
// results are combined rather than one being a strict fallback for the
// other — more reports found beats picking just one provider.
async function handleIncidents(url: URL, env: Env): Promise<Response> {
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lon = parseFloat(url.searchParams.get("lon") || "");
  const radiusKm = Math.min(parseFloat(url.searchParams.get("radius_km") || "15"), 50);
  if (isNaN(lat) || isNaN(lon)) {
    return new Response(JSON.stringify({ error: "lat and lon are required" }), { status: 400 });
  }

  const results: Array<{ source: string; type: string; description: string; lat: number; lon: number }> = [];

  if (env.TOMTOM_API_KEY) {
    try {
      const delta = radiusKm / 111; // rough degrees for a bounding box
      const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
      const fields = "{incidents{type,geometry{type,coordinates},properties{iconCategory,events{description}}}}";
      const upstream = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${encodeURIComponent(fields)}&key=${env.TOMTOM_API_KEY}`;
      const res = await fetch(upstream);
      if (res.ok) {
        const data = await res.json<any>();
        for (const inc of data.incidents || []) {
          const coords = inc.geometry?.coordinates;
          const point = inc.geometry?.type === "Point" ? coords : coords?.[0];
          if (!point) continue;
          results.push({
            source: "tomtom",
            type: inc.properties?.iconCategory || "incident",
            description: inc.properties?.events?.[0]?.description || "Traffic incident",
            lat: point[1],
            lon: point[0],
          });
        }
      }
    } catch {
      // TomTom failed — Waze alerts below still run independently
    }
  }

  const alerts = await fetchWazeAlerts(env);
  for (const a of alerts) {
    if (!a.location || typeof a.location.y !== "number" || typeof a.location.x !== "number") continue;
    if (distanceKm(lat, lon, a.location.y, a.location.x) > radiusKm) continue;
    results.push({
      source: "waze",
      type: [a.type, a.subtype].filter(Boolean).join(" - ") || "incident",
      description: a.reportDescription || "",
      lat: a.location.y,
      lon: a.location.x,
    });
  }

  return new Response(JSON.stringify({ source: "combined", results }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

async function fetchWazeJams(env: Env): Promise<any[]> {
  if (!env.WAZE_FEED_URL) return [];
  try {
    const data = await fetch(env.WAZE_FEED_URL).then(r => r.json<any>());
    return data.jams || [];
  } catch {
    return [];
  }
}

// Traffic: TomTom primary. If TomTom errors or isn't configured, fall back
// to estimating conditions from the nearest jam in the Waze feed.
async function handleTraffic(url: URL, env: Env): Promise<Response> {
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (!lat || !lon) {
    return new Response(JSON.stringify({ error: "lat and lon are required" }), { status: 400 });
  }

  if (env.TOMTOM_API_KEY) {
    try {
      const upstream = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&key=${env.TOMTOM_API_KEY}`;
      const res = await fetch(upstream);
      if (res.ok) {
        const data = await res.json<any>();
        if (data.flowSegmentData) {
          return new Response(JSON.stringify({ source: "tomtom", ...data.flowSegmentData }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...cors(env) },
          });
        }
      }
    } catch {
      // fall through to Waze-based estimate
    }
  }

  // Fallback: nearest jam in the Waze feed within ~3km.
  const jams = await fetchWazeJams(env);
  let nearest: any = null;
  let nearestDist = Infinity;
  for (const j of jams) {
    const line = j.line || [];
    for (const pt of line) {
      if (typeof pt.y !== "number" || typeof pt.x !== "number") continue;
      const d = distanceKm(parseFloat(lat), parseFloat(lon), pt.y, pt.x);
      if (d < nearestDist) { nearestDist = d; nearest = j; }
    }
  }

  if (nearest && nearestDist < 3) {
    return new Response(JSON.stringify({
      source: "waze-fallback",
      currentSpeed: nearest.speedKmh || null,
      freeFlowSpeed: null,
      level: nearest.level, // Waze severity 0-5
      distanceKm: Math.round(nearestDist * 10) / 10,
    }), { status: 200, headers: { "Content-Type": "application/json", ...cors(env) } });
  }

  return new Response(JSON.stringify({ source: "none", message: "No traffic data available for this point" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

// Weather: Open-Meteo primary (free, keyless). Falls back to OpenWeatherMap
// only if Open-Meteo is unreachable — normalizes both into the same shape.
async function handleWeather(url: URL, env: Env): Promise<Response> {
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (!lat || !lon) {
    return new Response(JSON.stringify({ error: "lat and lon are required" }), { status: 400 });
  }

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`);
    if (res.ok) {
      const data = await res.json<any>();
      if (data.current) {
        return new Response(JSON.stringify({
          source: "open-meteo",
          temperature: data.current.temperature_2m,
          windSpeed: data.current.wind_speed_10m,
        }), { status: 200, headers: { "Content-Type": "application/json", ...cors(env) } });
      }
    }
  } catch {
    // fall through to OpenWeatherMap
  }

  if (env.OPENWEATHERMAP_API_KEY) {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${env.OPENWEATHERMAP_API_KEY}`);
      if (res.ok) {
        const data = await res.json<any>();
        return new Response(JSON.stringify({
          source: "openweathermap",
          temperature: data.main?.temp,
          windSpeed: data.wind?.speed,
        }), { status: 200, headers: { "Content-Type": "application/json", ...cors(env) } });
      }
    } catch {
      // both failed
    }
  }

  return new Response(JSON.stringify({ source: "none", error: "Weather unavailable" }), {
    status: 502,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

const POI_TAGS: Record<string, string> = {
  fuel: "amenity=fuel",
  hospital: "amenity=hospital",
  hotel: "tourism=hotel",
  atm: "amenity=atm",
  restaurant: "amenity=restaurant",
  police: "amenity=police",
};

// POIs: Overpass API primary (free, keyless, OpenStreetMap data). Falls
// back to a Nominatim bounding-box search if Overpass is slow/unreachable
// (Overpass has no SLA and occasionally rate-limits under load).
async function handlePois(url: URL, env: Env): Promise<Response> {
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lon = parseFloat(url.searchParams.get("lon") || "");
  const type = url.searchParams.get("type") || "fuel";
  const radius = Math.min(parseInt(url.searchParams.get("radius") || "5000", 10), 20000);
  const tag = POI_TAGS[type];
  if (isNaN(lat) || isNaN(lon) || !tag) {
    return new Response(JSON.stringify({ error: "valid lat, lon and a known type are required" }), { status: 400 });
  }

  try {
    const [k, v] = tag.split("=");
    const query = `[out:json][timeout:15];node["${k}"="${v}"](around:${radius},${lat},${lon});out body ${Math.min(radius / 100, 60)};`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (res.ok) {
      const data = await res.json<any>();
      const results = (data.elements || []).map((e: any) => ({
        name: e.tags?.name || type,
        lat: e.lat,
        lon: e.lon,
      }));
      return new Response(JSON.stringify({ source: "overpass", results }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors(env) },
      });
    }
  } catch {
    // fall through to Nominatim
  }

  try {
    const delta = radius / 111000; // rough degrees for the radius, for a bounding box
    const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&${tag.replace("=", "=")}&viewbox=${viewbox}&bounded=1&limit=20`, {
      headers: { "User-Agent": "MeroSadak/1.0" },
    });
    const data = await res.json<any[]>();
    const results = data.map((e: any) => ({ name: e.display_name?.split(",")[0] || type, lat: parseFloat(e.lat), lon: parseFloat(e.lon) }));
    return new Response(JSON.stringify({ source: "nominatim-fallback", results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors(env) },
    });
  } catch {
    return new Response(JSON.stringify({ source: "none", results: [], error: "POI lookup failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...cors(env) },
    });
  }
}

async function handleWaze(env: Env): Promise<Response> {
  const res = await fetch(env.WAZE_FEED_URL);
  const body = await res.text();
  // NOTE: check the Waze Partner Hub agreement in your dashboard for any
  // attribution, caching, or refresh-rate requirements before shipping
  // this to end users — those terms aren't something I can verify here.
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

// ---- Upstash Redis (REST API — works from Workers, no TCP needed) ----
// Used purely as a cache so the same question doesn't re-call Gemini.
// Best-effort: if Upstash is unreachable or not configured, we just skip
// caching rather than failing the request.

async function hashPrompt(prompt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(prompt));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getCachedAnswer(env: Env, key: string): Promise<string | null> {
  if (!env.UPSTASH_REDIS_REST_URL) return null;
  try {
    const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    const data = await res.json<{ result: string | null }>();
    return data.result;
  } catch {
    return null;
  }
}

async function setCachedAnswer(env: Env, key: string, value: string): Promise<void> {
  if (!env.UPSTASH_REDIS_REST_URL) return;
  try {
    // 24h TTL — long enough to dedupe repeat questions, short enough that
    // stale trip conditions don't linger forever.
    await fetch(`${env.UPSTASH_REDIS_REST_URL}/set/${key}/${encodeURIComponent(value)}?EX=86400`, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    });
  } catch {
    // cache write is best-effort, never block the response on it
  }
}

async function callGemini(env: Env, model: string, prompt: string): Promise<Response> {
  const upstream = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  return fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
}

async function handleAssistant(request: Request, env: Env): Promise<Response> {
  const { prompt } = await request.json<{ prompt?: string }>();
  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400 });
  }

  const cacheKey = `gemini:${await hashPrompt(prompt)}`;
  const cached = await getCachedAnswer(env, cacheKey);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Cache": "HIT", ...cors(env) },
    });
  }

  // Try the primary model first; if it errors (e.g. rate-limited /
  // "Resource Exhausted"), fall back to the secondary model automatically.
  const models = [
    env.GEMINI_MODEL_PRIMARY || "gemini-2.5-flash",
    env.GEMINI_MODEL_SECONDARY || "gemini-2.0-flash-lite",
  ];

  let lastRes: Response | null = null;
  for (const model of models) {
    const res = await callGemini(env, model, prompt);
    lastRes = res;
    if (res.ok) {
      const body = await res.text();
      await setCachedAnswer(env, cacheKey, body);
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Cache": "MISS", "X-Model-Used": model, ...cors(env) },
      });
    }
    // else: fall through and try the next model in the list
  }

  const body = lastRes ? await lastRes.text() : JSON.stringify({ error: "no response from any model" });
  return new Response(body, {
    status: lastRes ? lastRes.status : 502,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(env) });
    }

    if (url.pathname === "/api/traffic") {
      return handleTraffic(url, env);
    }
    if (url.pathname === "/api/weather") {
      return handleWeather(url, env);
    }
    if (url.pathname === "/api/pois") {
      return handlePois(url, env);
    }
    if (url.pathname === "/api/incidents") {
      return handleIncidents(url, env);
    }
    if (url.pathname === "/api/waze") {
      return handleWaze(env);
    }
    if (url.pathname === "/api/assistant" && request.method === "POST") {
      return handleAssistant(request, env);
    }

    if (url.pathname.startsWith("/api/data/") && request.method === "GET") {
      const key = url.pathname.replace("/api/data/", "");
      if (!key) {
        return new Response(JSON.stringify({ error: "data key is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors(env) },
        });
      }
      const value = await env.DATA.get(key);
      if (!value) {
        return new Response(JSON.stringify({ error: "data not found", key }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...cors(env) },
        });
      }
      return new Response(value, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, s-maxage=300",
          ...cors(env),
        },
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...cors(env) },
    });
  },
};
