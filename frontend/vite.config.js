import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Polyfill WebSocket in Node dev
if (process.env.NODE_ENV === "development" && typeof WebSocket === "undefined") {
  import("ws")
    .then((mod) => {
      // @ts-ignore
      globalThis.WebSocket = mod.default;
      console.log("[VITE] WebSocket polyfilled in Node dev");
    })
    .catch((e) => console.warn("[VITE] WebSocket polyfill failed:", e));
}

export default defineConfig(({ mode }) => {
  // Load .env file based on mode
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL || "http://127.0.0.1:4000";

  // Parse the API base URL to construct WebSocket URL
  let wsTarget = "ws://127.0.0.1:4000";
  try {
    const url = new URL(apiBaseUrl);
    wsTarget = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  } catch {
    // Use default if parsing fails
  }

  return {
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom", "leaflet", "react-leaflet"],
    },
    server: {
      port: 5173,
      host: true,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("leaflet")) return "vendor";
              if (id.includes("@google/genai")) return "ai";
            }
          },
        },
      },
    },
  };
});
