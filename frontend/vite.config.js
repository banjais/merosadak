// frontend/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import circularDependency from "vite-plugin-circular-dependency";

/**
 * ✅ FIXED: version injection plugin (no require(), safe ESM)
 */
const versionInjection = {
  name: "version-injection",
  apply: "build",

  closeBundle: async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const pkg = JSON.parse(
      fs.readFileSync(path.resolve("package.json"), "utf-8")
    );

    const version = pkg.version || "1.0.0";

    // Path to service worker
    const swPath = path.resolve("public/sw.js");

    if (fs.existsSync(swPath)) {
      let sw = fs.readFileSync(swPath, "utf-8");

      // Inject app version
      sw = sw.replace(
        /const APP_VERSION = '.*?'/,
        `const APP_VERSION = '${version}'`
      );

      // Update cache version
      sw = sw.replace(
        /CACHE_NAME = 'merosadak-v\d+'/,
        `CACHE_NAME = 'merosadak-v${version.replace(/\./g, "")}'`
      );

      fs.writeFileSync(swPath, sw, "utf-8");

      console.log(`✅ Service worker updated to version ${version}`);
    } else {
      console.warn("⚠️ sw.js not found in public folder");
    }
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiBaseUrl =
    env.VITE_API_BASE_URL || "http://127.0.0.1:4000";

  let wsTarget = "ws://127.0.0.1:4000";

  try {
    const url = new URL(apiBaseUrl);
    wsTarget = `${url.protocol === "https:" ? "wss:" : "ws:"}//${
      url.hostname
    }:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  } catch (err) {
    console.warn("⚠️ Invalid API base URL, using default WS target");
  }

  return {
    plugins: [
      react(),
      circularDependency(),
      versionInjection
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

      minify: "esbuild",

      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",

          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (
                id.includes("react") ||
                id.includes("leaflet")
              ) {
                return "vendor";
              }

              if (id.includes("@google/genai")) {
                return "ai";
              }
            }
          }
        }
      }
    }
  };
});