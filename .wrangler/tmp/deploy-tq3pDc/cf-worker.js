var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// backend/cloudflare/cf-worker.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // Change to 'https://merosadak.web.app' for production
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "X-Worker-Version": "2026-04-05"
};
var cf_worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname + url.search;
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (path.startsWith("/api") || path.startsWith("/v1")) {
      const isGet = request.method === "GET";
      let backendName = "none";
      const fetchFromBackend = /* @__PURE__ */ __name(async (baseURL, name) => {
        if (!baseURL) return null;
        let targetURL = baseURL.replace(/\/$/, "");
        targetURL += path.startsWith("/v1") ? path : `/v1${path}`;
        const cacheKey = new Request(targetURL, { method: request.method });
        if (isGet) {
          const cached = await caches.default.match(cacheKey);
          if (cached) {
            const headers = new Headers(cached.headers);
            Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
            headers.set("X-Cache-Status", "HIT");
            headers.set("X-Backend", name);
            return new Response(cached.body, { status: cached.status, headers });
          }
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15e3);
        try {
          const res = await fetch(targetURL, {
            method: request.method,
            headers: request.headers,
            body: isGet ? void 0 : await request.clone().arrayBuffer(),
            signal: controller.signal
          });
          clearTimeout(timeout);
          backendName = name;
          if (isGet && res.ok) {
            const responseClone = res.clone();
            const headers = new Headers(res.headers);
            Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
            headers.set("Cache-Control", "public, max-age=300");
            headers.set("X-Cache-Status", "MISS");
            headers.set("X-Backend", name);
            ctx.waitUntil(caches.default.put(cacheKey, responseClone));
          }
          const finalHeaders = new Headers(res.headers);
          Object.entries(CORS_HEADERS).forEach(([k, v]) => finalHeaders.set(k, v));
          finalHeaders.set("X-Served-By", "Cloudflare-Worker");
          finalHeaders.set("X-Backend", backendName);
          return new Response(res.body, {
            status: res.status,
            headers: finalHeaders
          });
        } catch (err) {
          clearTimeout(timeout);
          console.error(`[Worker] ${name} backend failed:`, err.message);
          return null;
        }
      }, "fetchFromBackend");
      const response = await fetchFromBackend(env.FIREBASE_BACKEND, "Firebase") || await fetchFromBackend(env.RENDER_BACKEND, "Render");
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
    const frontendURL = new URL(url.pathname + url.search, "https://merosadak.web.app");
    try {
      const frontendReq = new Request(frontendURL, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" ? void 0 : await request.clone().arrayBuffer()
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
      Promise.allSettled(urls.map((u) => fetch(u).catch(() => null)))
    );
  }
};
export {
  cf_worker_default as default
};
//# sourceMappingURL=cf-worker.js.map
