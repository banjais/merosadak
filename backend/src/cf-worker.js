// backend/src/cf-worker.js
// Sadak-Sathi Cloudflare Worker – Production (fixed)

export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    // ------------------- API Proxy -------------------
    if (path.startsWith("/api")) {
      const isGet = request.method === "GET";
      let backendName = "none";

      const fetchFromBackend = async (baseURL, name) => {
        if (!baseURL) return null;

        const targetURL = baseURL.replace(/\/$/, "") + path;
        const cacheKey = new Request(targetURL, request);

        // ---- Cache HIT ----
        if (isGet) {
          const cached = await cache.match(cacheKey);
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set("X-Cache-Status", "HIT");
            headers.set("X-Backend", name);
            return new Response(cached.body, { status: cached.status, headers });
          }
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);

        try {
          const res = await fetch(targetURL, {
            method: request.method,
            headers: request.headers,
            body: isGet ? undefined : await request.clone().arrayBuffer(),
            signal: controller.signal,
          });

          clearTimeout(timeout);
          if (res.status >= 500) throw new Error("5xx");

          backendName = name;

          // ---- Cache PUT ----
          if (isGet && res.ok) {
            const headers = new Headers(res.headers);
            headers.set("Cache-Control", "public, max-age=300");
            headers.set("X-Cache-Status", "MISS");
            headers.set("X-Backend", name);

            const cacheable = new Response(res.body, {
              status: res.status,
              headers,
            });

            ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
            return cacheable;
          }

          return res;
        } catch {
          clearTimeout(timeout);
          return null;
        }
      };

      let response =
        (await fetchFromBackend(env.FIREBASE_BACKEND, "Firebase")) ||
        (await fetchFromBackend(env.RENDER_BACKEND, "Render"));

      if (!response) {
        return new Response(
          JSON.stringify({
            error: "All API backends unavailable",
            time: new Date().toISOString(),
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Worker-Version": "2026-01-09",
            },
          }
        );
      }

      const headers = new Headers(response.headers);
      headers.set("X-Served-By", "Cloudflare-Worker");
      headers.set("X-Backend", backendName);
      headers.set("X-Worker-Version", "2026-01-09");

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    // ------------------- Frontend -------------------
    const frontendURL = new URL(path || "/", "https://sadaksathi.web.app");

    const frontendReq = new Request(frontendURL, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" ? undefined : request.body,
    });

    const res = await fetch(frontendReq);
    const headers = new Headers(res.headers);
    headers.set("X-Served-By", "Cloudflare-Worker");
    headers.set("X-Worker-Version", "2026-01-09");

    return new Response(res.body, { status: res.status, headers });
  },

  // ------------------- Cron -------------------
  async scheduled(event, env, ctx) {
    const urls = [];

    if (env.FIREBASE_BACKEND)
      urls.push(env.FIREBASE_BACKEND + "/api/health");

    if (env.RENDER_BACKEND)
      urls.push(env.RENDER_BACKEND + "/health");

    ctx.waitUntil(
      Promise.allSettled(
        urls.map(url => fetch(url).catch(() => null))
      )
    );
  },
};
