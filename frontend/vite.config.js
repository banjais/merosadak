import { defineConfig } from "vite";
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

export default defineConfig({
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
        target: process.env.VITE_API_BASE_URL || "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target:
          (process.env.VITE_API_BASE_URL?.startsWith("https") ? "wss" : "ws") +
          process.env.VITE_API_BASE_URL?.slice(process.env.VITE_API_BASE_URL.indexOf(":")) ||
          "ws://127.0.0.1:4000",
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
});
