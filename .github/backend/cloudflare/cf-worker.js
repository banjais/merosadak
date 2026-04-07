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

    // ==================== API Proxy (v1 routes) ====================
    if (path.startsWith("/api") || path.startsWith("/v1") || path.startsWith("/health")) {
      const isGet = request.method === "GET";

      // Normalize path: /api/v1/boundary -> /v1/boundary
      let normalizedPath = path;
      if (path.startsWith("/api/v1")) {
        normalizedPath = "/v1" + path.slice(8);
      } else if (path.startsWith("/api/")) {
        normalizedPath = "/v1" + path.slice(5);
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
    const urls = [];
    if (env.FIREBASE_BACKEND) urls.push(env.FIREBASE_BACKEND + "/api/health");
    if (env.RENDER_BACKEND) urls.push(env.RENDER_BACKEND + "/health");

    ctx.waitUntil(
      Promise.allSettled(urls.map(u => fetch(u).catch(() => null)))
    );
  },
};
