// cf-worker.js
// MeroSadak Cloudflare Worker – Fixed Version (April 2026)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
  'X-Worker-Version': '2026-04-06',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    console.log(`[Worker] Incoming request: ${request.method} ${path}`);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ==================== API Proxy ====================
    if (path.startsWith("/api") || path.startsWith("/health")) {
      const isGet = request.method === "GET";

      // Normalize path: /api/boundary -> /boundary
      let normalizedPath = path;
      if (path.startsWith("/api/")) {
        normalizedPath = path.slice(4); // remove /api
      }

      console.log(`[Worker] Proxying ${request.method} ${path} -> ${normalizedPath}`);

      const fetchFromBackend = async (baseURL, name) => {
        if (!baseURL) return null;

        let targetURL = baseURL.replace(/\/$/, "");
        targetURL += normalizedPath;

        console.log(`[Worker] Fetching from ${name}: ${targetURL}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
          const res = await fetch(targetURL, {
            method: request.method,
            headers: request.headers,
            body: isGet ? undefined : await request.clone().arrayBuffer(),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          const finalHeaders = new Headers(res.headers);
          Object.entries(CORS_HEADERS).forEach(([k, v]) => finalHeaders.set(k, v));
          finalHeaders.set("X-Served-By", "Cloudflare-Worker");
          finalHeaders.set("X-Backend", name);

          return new Response(res.body, {
            status: res.status,
            headers: finalHeaders,
          });

        } catch (err) {
          clearTimeout(timeout);
          console.error(`[Worker] ${name} backend failed:`, err.message);
          return null;
        }
      };

      const response =
        (await fetchFromBackend(env.FIREBASE_BACKEND + "/api", "Firebase")) ||
        (await fetchFromBackend(env.RENDER_BACKEND + "/api", "Render"));

      if (!response) {
        return new Response(
          JSON.stringify({ success: false, error: "All backends unavailable" }),
          {
            status: 503,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
          }
        );
      }

      return response;
    }

    // ==================== Frontend Static Serving ====================
    const frontendURL = new URL(url.pathname + url.search, "https://merosadak.web.app");

    try {
      const frontendReq = new Request(frontendURL, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" ? undefined : await request.clone().arrayBuffer(),
      });

      const res = await fetch(frontendReq);
      const headers = new Headers(res.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
      headers.set("X-Served-By", "Cloudflare-Worker");

      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      return new Response("Frontend unavailable", {
        status: 502,
        headers: CORS_HEADERS
      });
    }
  },

  async scheduled(event, env, ctx) {
    console.log("[Worker] Scheduled keep-alive ping triggered");

    const urls = [
      { url: env.RENDER_BACKEND + "/health/live", name: "Render (live)" },
      { url: env.RENDER_BACKEND + "/health", name: "Render (health)" },
      { url: "https://merosadak.web.app", name: "Firebase" },
    ];

    // Optional: ping UptimeRobot API for stats tracking (if configured)
    if (env.UPTIMEROBOT_API_KEY) {
      urls.push({
        url: "https://api.uptimerobot.com/v2/getMonitors",
        name: "UptimeRobot API",
        method: "POST",
        body: JSON.stringify({ api_key: env.UPTIMEROBOT_API_KEY, format: "json" })
      });
    }

    const results = [];
    for (const target of urls) {
      try {
        const res = await fetch(target.url, {
          method: target.method || "GET",
          body: target.body || undefined,
        });
        results.push({ name: target.name, status: res.status, ok: res.ok });
        console.log(`[Worker] ✓ ${target.name}: ${res.status}`);
      } catch (err) {
        results.push({ name: target.name, error: err.message, ok: false });
        console.log(`[Worker] ✗ ${target.name}: ${err.message}`);
      }
    }

    console.log("[Worker] Keep-alive results:", JSON.stringify(results));
    ctx.waitUntil(Promise.resolve());
  },
};
