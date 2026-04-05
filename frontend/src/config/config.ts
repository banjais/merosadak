/**
 * 🏔️ MeroSadak - Unified Configuration
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://merosadak.banjays.workers.dev";

export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || "MeroSadak",
  subHeader: "Safe Travels Across the Himalayas",
  version: "1.0.0",
  developer: "Expert Dev",

  defaultTheme: "indigo",

  auth: {
    loginRequired: import.meta.env.VITE_LOGIN_REQUIRED === "true",
    enableGeolocation: import.meta.env.VITE_ENABLE_GEOLOCATION !== "false",
  },

  useMocks: import.meta.env.VITE_USE_MOCK === "true",

  apiBaseUrl: BASE_URL,

  enable3D: import.meta.env.VITE_ENABLE_3D_MODE === "true",

  language: (import.meta.env.VITE_DEFAULT_LANGUAGE as "en" | "ne") || "en",

  map: {
    center: [28.3949, 84.1240] as [number, number],
    zoom: 7,
    minZoom: 6,
    maxZoom: 19,

    // Tile URLs
    darkTile: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    streetTile: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    satelliteTile: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    terrainTile: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    nepalTile: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",   // Default for Nepal

    // Offline settings (if you use PouchDB caching later)
    offline: {
      enabled: true,
      cacheMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      dbName: "nepal-map-tiles",
    },
  },
};

// Export useful constants
export const NEPAL_CENTER = APP_CONFIG.map.center;
export const NEPAL_MAX_BOUNDS: [[number, number], [number, number]] = [
  [26.0, 79.5],
  [30.5, 88.5]
];