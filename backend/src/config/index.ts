// backend/src/config/index.ts
import * as path from "path";
import dotenv from "dotenv";
import { z } from "zod";

// -----------------------------
// Load .env based on NODE_ENV
// -----------------------------
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// -----------------------------
// JWT Secret Validation
// -----------------------------
const isProduction = process.env.NODE_ENV === "production";
let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (isProduction) {
    console.warn("⚠️ [Config] No JWT_SECRET provided, generating temporary key for deployment");
    jwtSecret = "temp-" + Math.random().toString(36).substring(2) + Date.now().toString(36);
  } else {
    jwtSecret = "super-secret-key";
  }
}

// Helper to parse boolean from string (dotenv quirk)
const boolSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    if (val.toLocaleLowerCase() === "true") return true;
    if (val.toLocaleLowerCase() === "false") return false;
  }
  return val;
}, z.boolean());

// -----------------------------
// Environment Schema
// -----------------------------
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("/api"),
  JWT_SECRET: isProduction
    ? z.string().min(32, "JWT_SECRET must be at least 32 characters in production")
    : z.string().default("super-secret-key"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  GAS_URL: z.string().url().optional().or(z.literal("")),
  SHEET_ID: z.string().optional(),
  SHEET_TAB: z.string().default("Roads"),

  // Sheet Header Mappings
  HEADER_ROADCODE: z.string().optional(),
  HEADER_STATUS: z.string().optional(),
  HEADER_CHAINAGE: z.string().optional(),
  HEADER_INCIDENT_STARTED: z.string().optional(),
  HEADER_INCIDENT_DISTRICT: z.string().optional(),
  HEADER_INCIDENT_PLACE: z.string().optional(),
  HEADER_INCIDENT_COORDINATE: z.string().optional(),
  HEADER_ESTIMATED_RESTORATION: z.string().optional(),
  HEADER_RESTORATION_EFFORTS: z.string().optional(),
  HEADER_DATA_PULLED_DATE: z.string().optional(),
  HEADER_REMARKS: z.string().optional(),

  // Status Values
  STATUS_BLOCKED: z.string().optional(),
  STATUS_ONE_LANE: z.string().optional(),
  STATUS_RESUMED: z.string().optional(),

  // Tab Mappings
  TAB_TOLL: z.string().optional(),

  // Cloudflare
  CLOUDFLARE_URL: z.string().url().optional().or(z.literal("")),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  // Waze
  WAZE_XML: z.string().url().optional().or(z.literal("")),

  // Upstash
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Gemini API
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_URL: z.string().optional(),
  GEMINI_MODEL_PRIMARY: z.string().optional(),
  GEMINI_MODEL_SECONDARY: z.string().optional(),
  GEMINI_MODEL_LITE: z.string().optional(),
  GEMINI_MODEL_EMBEDDING: z.string().optional(),

  // OpenWeatherMap
  OPENWEATHERMAP_API_KEY: z.string().optional(),
  OPENWEATHERMAP_API_URL: z.string().default("https://api.openweathermap.org/data/2.5/weather"),
  OPEN_METEO_API_BASE: z.string().default("https://api.open-meteo.com/v1"),
  TOMTOM_API_URL: z.string().default("https://api.tomtom.com"),
  OVERPASS_API_URL: z.string().default("https://overpass-api.de/api"),
  OVERPASS_FALLBACK_URL: z.string().default("https://overpass.kumi.systems/api"),
  NOMINATIM_API_URL: z.string().default("https://nominatim.openstreetmap.org"),
  WAZE_API_BASE: z.string().default("https://www.waze.com"),
  TELEGRAM_API_URL: z.string().default("https://api.telegram.org"),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_URL: z.string().default("https://maps.googleapis.com/maps/api"),

  // TomTom
  TOMTOM_API_KEY: z.string().optional(),

  // OpenStreetMap
  OSM_API_KEY: z.string().optional(),

  // Waze
  WAZE_JSON: z.string().url().optional().or(z.literal("")),

  // Firebase
  FIREBASE_API_KEY: z.string().optional(),
  FIREBASE_TOKEN: z.string().optional(),
  FIREBASE_BASE_URL: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  FIREBASE_APP_ID: z.string().optional(),
  FIREBASE_MEASUREMENT_ID: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  FIREBASE_BACKEND: z.string().url().optional().or(z.literal("")),

  // Render
  RENDER_TOKEN: z.string().optional(),
  RENDER_BACKEND: z.string().url().optional().or(z.literal("")),
  RENDER_DEPLOY_HOOK: z.string().url().optional().or(z.literal("")),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.union([z.boolean(), z.string()]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  ALERT_EMAIL_TO: z.string().optional(),

  // OTP
  OTP_TTL_MS: z.coerce.number().optional(),
  OTP_MAX_ATTEMPTS: z.coerce.number().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional(),
  RATE_LIMIT_MAX: z.coerce.number().optional(),

  // WebSocket
  WS_ENABLED: boolSchema.default(true),
  WS_PORT: z.coerce.number().default(8080),

  // Alerts
  ALERT_SUMMARY_THRESHOLD: z.coerce.number().default(5),
  ALERT_NOTIFICATION_TTL_SEC: z.coerce.number().default(86400),
  PRIORITY_ROADS: z.string().default(""),

  // Web Push
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  // Feature Flags
  FORCE_FETCH: boolSchema.default(false),
  DEFAULT_LANGUAGE: z.string().default("en"),
  ENABLE_3D_MODE: boolSchema.default(false),
  SHOW_DEV_PANEL: boolSchema.default(false),
  MASTER_UPDATE_INTERVAL_MS: z.coerce.number().default(300000),

  // Mock data
  USE_MOCK: boolSchema.default(false),

  // Paths (driven by .env)
  DATA_DIR: z.string().default("data"),
  LOG_DIR: z.string().default("data/logs"),
  CACHE_DIR: z.string().default("data/cache"),

  BASE_DATA: z.string().default("data/highways_base.geojson"),
  BOUNDARY_DATA: z.string().default("data/districts.geojson"),
  HIGHWAY_DATA: z.string().default("data/highway/index.json"),
  DISTRICT_DATA: z.string().default("data/districts.geojson"),
  LOCAL_DATA: z.string().default("data/local.geojson"),
  PROVINCE_DATA: z.string().default("data/provinces.geojson"),

  CACHE_ROAD: z.string().default("data/cache/cacheRoad.json"),
  CACHE_DISTRICTS: z.string().default("data/cache/cacheDistricts.json"),
  CACHE_PROVINCES: z.string().default("data/cache/cacheProvinces.json"),
  CACHE_LOCAL: z.string().default("data/cache/cacheLocal.json"),
  CACHE_POI: z.string().default("data/cache/cachePOIs.json"),
  CACHE_TRAFFIC: z.string().default("data/cache/cacheTraffic.json"),
  CACHE_WEATHER: z.string().default("data/cache/cacheWeather.json"),
  CACHE_ALERTS: z.string().default("data/cache/cacheAlerts.json"),
  CACHE_MONSOON: z.string().default("data/cache/cacheMonsoon.json"),
  CACHE_WAZE: z.string().default("data/cache/cacheWaze.json"),
});

// -----------------------------
// Validate env
// -----------------------------
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ [Config] Environment validation failed:", parsed.error.format());
  if (process.env.NODE_ENV === "production") process.exit(1);
}

export const config = parsed.success ? parsed.data : ({} as any);

// -----------------------------
// Named exports
// -----------------------------
export const NODE_ENV = config.NODE_ENV;
export const PORT = config.PORT;
export const API_PREFIX = config.API_PREFIX;
export const JWT_SECRET = config.JWT_SECRET;
export const GAS_URL = config.GAS_URL || "";
export const SHEET_ID = config.SHEET_ID || "";
export const SHEET_TAB = config.SHEET_TAB || "";
export const JWT_EXPIRES_IN = config.JWT_EXPIRES_IN || "7d";

// -----------------------------
// Sheet Header Mappings
// -----------------------------
export const HEADER_ROADCODE = config.HEADER_ROADCODE || "RoadCode";
export const HEADER_STATUS = config.HEADER_STATUS || "Status";
export const HEADER_CHAINAGE = config.HEADER_CHAINAGE || "Chainage";
export const HEADER_INCIDENT_STARTED = config.HEADER_INCIDENT_STARTED || "Incident Started";
export const HEADER_INCIDENT_DISTRICT = config.HEADER_INCIDENT_DISTRICT || "District";
export const HEADER_INCIDENT_PLACE = config.HEADER_INCIDENT_PLACE || "Place";
export const HEADER_INCIDENT_COORDINATE = config.HEADER_INCIDENT_COORDINATE || "Coordinate";
export const HEADER_ESTIMATED_RESTORATION = config.HEADER_ESTIMATED_RESTORATION || "Estimated Restoration";
export const HEADER_RESTORATION_EFFORTS = config.HEADER_RESTORATION_EFFORTS || "Restoration Efforts";
export const HEADER_DATA_PULLED_DATE = config.HEADER_DATA_PULLED_DATE || "Data Pulled Date";
export const HEADER_REMARKS = config.HEADER_REMARKS || "Remarks";

// -----------------------------
// Status Values
// -----------------------------
export const STATUS_BLOCKED = config.STATUS_BLOCKED || "Blocked";
export const STATUS_ONE_LANE = config.STATUS_ONE_LANE || "One-Lane";
export const STATUS_RESUMED = config.STATUS_RESUMED || "Resumed";

// -----------------------------
// Tab Mappings
// -----------------------------
export const TAB_TOLL = config.TAB_TOLL || "Toll";

// Cloudflare
// -----------------------------
export const CLOUDFLARE_URL = config.CLOUDFLARE_URL || "";
export const CLOUDFLARE_API_TOKEN = config.CLOUDFLARE_API_TOKEN || "";

// -----------------------------
// Waze
// -----------------------------
export const WAZE_JSON = config.WAZE_JSON || "";
export const WAZE_XML = config.WAZE_XML || "";

// -----------------------------
// Data file paths
// -----------------------------
export const BASE_DATA = config.BASE_DATA || "data/highways_base.geojson";
export const BOUNDARY_DATA = config.BOUNDARY_DATA || "data/boundary.geojson";
export const HIGHWAY_DATA = config.HIGHWAY_DATA || "data/highway/index.json";
export const DISTRICT_DATA = config.DISTRICT_DATA || "data/districts.geojson";
export const LOCAL_DATA = config.LOCAL_DATA || "data/local.geojson";
export const PROVINCE_DATA = config.PROVINCE_DATA || "data/provinces.geojson";

export const UPSTASH = {
  REST_URL: config.UPSTASH_REDIS_REST_URL,
  REST_TOKEN: config.UPSTASH_REDIS_REST_TOKEN,
};

// -----------------------------
// Gemini exports
// -----------------------------
export const GEMINI_API_KEY = config.GEMINI_API_KEY || "";
export const GEMINI_API_URL = config.GEMINI_API_URL || "";
export const GEMINI_MODEL_PRIMARY = config.GEMINI_MODEL_PRIMARY || "";
export const GEMINI_MODEL_SECONDARY = config.GEMINI_MODEL_SECONDARY || "";
export const GEMINI_MODEL_LITE = config.GEMINI_MODEL_LITE || "";
export const GEMINI_MODEL_EMBEDDING = config.GEMINI_MODEL_EMBEDDING || "";

// -----------------------------
// Weather APIs
export const OPENWEATHERMAP_API_KEY = config.OPENWEATHERMAP_API_KEY || "";
export const OPENWEATHERMAP_API_URL = config.OPENWEATHERMAP_API_URL || "https://api.openweathermap.org/data/2.5/weather";
export const OPEN_METEO_API_BASE = config.OPEN_METEO_API_BASE || "https://api.open-meteo.com/v1";
export const TOMTOM_API_URL = config.TOMTOM_API_URL || "https://api.tomtom.com";
export const OVERPASS_API_URL = config.OVERPASS_API_URL || "https://overpass-api.de/api";
export const OVERPASS_FALLBACK_URL = config.OVERPASS_FALLBACK_URL || "https://overpass.kumi.systems/api";
export const NOMINATIM_API_URL = config.NOMINATIM_API_URL || "https://nominatim.openstreetmap.org";
export const WAZE_API_BASE = config.WAZE_API_BASE || "https://www.waze.com";
export const TELEGRAM_API_URL = config.TELEGRAM_API_URL || "https://api.telegram.org";

// -----------------------------
// Google Maps
export const GOOGLE_MAPS_API_KEY = config.GOOGLE_MAPS_API_KEY || "";
export const GOOGLE_MAPS_API_URL = config.GOOGLE_MAPS_API_URL || "https://maps.googleapis.com/maps/api";

// -----------------------------
// TomTom
export const TOMTOM_API_KEY = config.TOMTOM_API_KEY || "";

export const OSM_API_KEY = config.OSM_API_KEY || "";

// -----------------------------
// Firebase
export const FIREBASE_API_KEY = config.FIREBASE_API_KEY || "";
export const FIREBASE_TOKEN = config.FIREBASE_TOKEN || "";
export const FIREBASE_BASE_URL = config.FIREBASE_BASE_URL || "";
export const FIREBASE_AUTH_DOMAIN = config.FIREBASE_AUTH_DOMAIN || "";
export const FIREBASE_PROJECT_ID = config.FIREBASE_PROJECT_ID || "";
export const FIREBASE_STORAGE_BUCKET = config.FIREBASE_STORAGE_BUCKET || "";
export const FIREBASE_MESSAGING_SENDER_ID = config.FIREBASE_MESSAGING_SENDER_ID || "";
export const FIREBASE_APP_ID = config.FIREBASE_APP_ID || "";
export const FIREBASE_MEASUREMENT_ID = config.FIREBASE_MEASUREMENT_ID || "";
export const FIREBASE_SERVICE_ACCOUNT = config.FIREBASE_SERVICE_ACCOUNT || "";
export const FIREBASE_BACKEND = config.FIREBASE_BACKEND || "";

// -----------------------------
// Render
export const RENDER_TOKEN = config.RENDER_TOKEN || "";
export const RENDER_BACKEND = config.RENDER_BACKEND || "";
export const RENDER_DEPLOY_HOOK = config.RENDER_DEPLOY_HOOK || "";

// -----------------------------
// Sentry
export const SENTRY_DSN = config.SENTRY_DSN || "";
export const SENTRY_ENVIRONMENT = config.SENTRY_ENVIRONMENT || "";
export const SENTRY_TRACES_SAMPLE_RATE = config.SENTRY_TRACES_SAMPLE_RATE ?? 0.1;
export const SENTRY_PROFILES_SAMPLE_RATE = config.SENTRY_PROFILES_SAMPLE_RATE ?? 0.0;

// -----------------------------
// Telegram
export const TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN || "";
export const TELEGRAM_CHAT_ID = config.TELEGRAM_CHAT_ID || "";

// -----------------------------
// SMTP
export const SMTP_HOST = config.SMTP_HOST || "";
export const SMTP_PORT = config.SMTP_PORT ?? 465;
export const SMTP_SECURE = config.SMTP_SECURE ?? true;
export const SMTP_USER = config.SMTP_USER || "";
export const SMTP_PASS = config.SMTP_PASS || "";
export const SMTP_FROM = config.SMTP_FROM || "";
export const ALERT_EMAIL_TO = config.ALERT_EMAIL_TO || "";

// -----------------------------
// OTP
export const OTP_TTL_MS = config.OTP_TTL_MS ?? 300000;
export const OTP_MAX_ATTEMPTS = config.OTP_MAX_ATTEMPTS ?? 5;

// -----------------------------
// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = config.RATE_LIMIT_WINDOW_MS ?? 60000;
export const RATE_LIMIT_MAX = config.RATE_LIMIT_MAX ?? 5;

// -----------------------------
// WebSocket
export const WS_ENABLED = config.WS_ENABLED ?? true;
export const WS_PORT = config.WS_PORT ?? 8080;

// -----------------------------
// Alerts
export const ALERT_SUMMARY_THRESHOLD = config.ALERT_SUMMARY_THRESHOLD;
export const ALERT_NOTIFICATION_TTL_SEC = config.ALERT_NOTIFICATION_TTL_SEC;
export const PRIORITY_ROADS = (config.PRIORITY_ROADS || "").split(",").map((s: string) => s.trim()).filter(Boolean);

// -----------------------------
// Feature Flags
export const FORCE_FETCH = config.FORCE_FETCH ?? false;
export const DEFAULT_LANGUAGE = config.DEFAULT_LANGUAGE || "en";
export const ENABLE_3D_MODE = config.ENABLE_3D_MODE ?? false;
export const SHOW_DEV_PANEL = config.SHOW_DEV_PANEL ?? false;
export const MASTER_UPDATE_INTERVAL_MS = config.MASTER_UPDATE_INTERVAL_MS ?? 300000;
export const VAPID_PUBLIC_KEY = config.VAPID_PUBLIC_KEY || "";
export const VAPID_PRIVATE_KEY = config.VAPID_PRIVATE_KEY || "";

// -----------------------------
// Mock data
export const USE_MOCK = config.USE_MOCK;

// -----------------------------
export const isProd = config.NODE_ENV === "production";
export const isDev = config.NODE_ENV === "development";
