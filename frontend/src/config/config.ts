/**
 * 🏔️ SadakSathi - Unified Configuration
 * Merged from config.ts and appConfig.ts
 */

// 1. Environment Variables (Vite Prefixed)
const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:4000";
const API_VERSION = "/api/v1"; // Optional: for cleaner versioning

export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || "SadakSathi",
  subHeader: "Safe Travels Across the Himalayas",
  version: "1.0.0",
  developer: "Expert Dev",
  defaultTheme: "indigo",
  
  // 🔐 Feature Flags
  auth: {
    loginRequired: import.meta.env.VITE_LOGIN_REQUIRED === "true",
    enableGeolocation: import.meta.env.VITE_ENABLE_GEOLOCATION === "true",
  },

  // 🧪 Mode Switcher
  // import.meta.env.DEV is true during 'npm run dev'
  useMocks: import.meta.env.VITE_USE_MOCK === "true", // Only force mocks if explicitly asked
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "", // Default to same-origin/proxy
  enable3D: import.meta.env.VITE_ENABLE_3D_MODE === "true",
  language: (import.meta.env.VITE_DEFAULT_LANGUAGE as "en" | "ne") || "en",

  // 🗺️ Map Configuration
  map: {
    center: [28.3949, 84.1240] as [number, number],
    zoom: 7,
    minZoom: 6,
    maxZoom: 18,
    // Tiles
    darkTile: "https://tiles.stadiamaps.com/tiles/alidade_dark/{z}/{x}/{y}{r}.png",
    streetTile: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    offline: {
      enabled: true,
      cacheMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      dbName: 'nepal-map-tiles'
    }
  }
};

// 🟢 API Endpoints
export const API_ENDPOINTS = {
  roads: "/roads",
  traffic: "/traffic",
  weather: "/weather",
  pois: "/pois",
  gemini: "/gemini",
  search: "/search",
  health: "/health",
  superadminStats: "/superadmin/stats",
  superadminLogs: "/superadmin/logs",
  superadminRefresh: "/superadmin/refresh",
  superadminReport: "/superadmin/report/download",
  // Boundary is hardcoded in App.tsx/Constants.tsx per your requirement
  boundary: null, 
};

// 🎨 UI Theme Definitions
export const COLOR_THEMES = [
  { id: 'indigo', primary: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-600', light: 'bg-indigo-50', hover: 'hover:bg-indigo-700' },
  { id: 'emerald', primary: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600', light: 'bg-emerald-50', hover: 'hover:bg-emerald-700' },
  { id: 'rose', primary: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-600', light: 'bg-rose-50', hover: 'hover:bg-rose-700' },
  { id: 'amber', primary: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-600', light: 'bg-amber-50', hover: 'hover:bg-amber-700' },
  { id: 'slate', primary: 'bg-slate-800', text: 'text-slate-800', border: 'border-slate-800', light: 'bg-slate-100', hover: 'hover:bg-slate-900' },
  { id: 'violet', primary: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-600', light: 'bg-violet-50', hover: 'hover:bg-violet-700' }
];

// 📍 Shortcut exports for common use
export const NEPAL_CENTER = APP_CONFIG.map.center;