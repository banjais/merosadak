import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import circularDependency from "vite-plugin-circular-dependency";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL || "http://127.0.0.1:4000";

  let wsTarget = "ws://127.0.0.1:4000";
  try {
    const url = new URL(apiBaseUrl);
    wsTarget = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  } catch { }

  return {
    plugins: [
      react(),
      circularDependency({
        exclude: [/node_modules/],
        throwOnError: true
      })
    ],

    resolve: {
      dedupe: ["react", "react-dom", "leaflet", "react-leaflet"]
    },

    server: {
      port: 5173,
      host: true,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false
          // No rewrite needed — backend already mounts at /api/v1
          // Frontend apiFetch normalizes URLs to /api/v1/* which match directly
        },
        "/ws": {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    },

    build: {
      chunkSizeWarningLimit: 1600,

      minify: "esbuild", // ✅ faster + safer than terser

      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",

          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("leaflet")) return "vendor";
              if (id.includes("@google/genai")) return "ai";
            }
          }
        }
      }
    }
  };
});