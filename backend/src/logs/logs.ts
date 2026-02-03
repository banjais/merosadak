import fs from "fs";
import path from "path";
import { LOG_DIR, BASE_DATA, POI_DATA, BOUNDARY_DATA } from "../config/paths.js";
import { broadcastLiveLog } from "../services/websocketService.js";

// ---------------- Ensure log directory exists ----------------
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ---------------- Core Types ----------------
type LogLevel = "info" | "error" | "warn";
type Meta = Record<string, any> | null | undefined;

/**
 * Generates a daily log filename: baseName-YYYY-MM-DD.ext
 */
function getDailyLogFile(baseName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const ext = path.extname(baseName);
  const name = path.basename(baseName, ext);
  return `${name}-${date}${ext}`;
}

/**
 * Writes a JSON log entry to a file AND broadcasts via WebSocket
 */
function write(file: string, level: LogLevel, msg: string, meta?: Meta) {
  const logPath = path.join(LOG_DIR, getDailyLogFile(file));
  const timestamp = new Date().toISOString();
  
  const entry = { 
    timestamp, 
    level, 
    message: msg, 
    meta: meta ?? null 
  };
  
  try {
    // 1. Write to specific log file
    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf-8");

    // 2. Mirror errors/warnings to the Superadmin audit log (for PDF reporting)
    if (file !== "superadmin.log" && level !== "info") {
       const adminLogPath = path.join(LOG_DIR, getDailyLogFile("superadmin.log"));
       fs.appendFileSync(adminLogPath, JSON.stringify(entry) + "\n", "utf-8");
    }

    // 3. 🚀 LIVE BROADCAST: Send log to WebSocket clients in real-time
    // We map file names to WebSocket 'type' categories
    const wsTypeMap: Record<string, any> = {
        "app.log": "app",
        "error.log": "error",
        "auth.log": "auth",
        "sheet.log": "worker",
        "admin.log": "system"
    };

    broadcastLiveLog({
        type: wsTypeMap[file] || "system",
        message: msg,
        level: level,
        meta: meta,
        timestamp: timestamp
    });

  } catch (err) {
    // Silent fail to prevent app crash if disk is full or permission denied
  }
}

// ---------------- Generic & Security ----------------
export const logInfo = (msg: string, meta?: Meta) => write("app.log", "info", msg, meta);
export const logError = (msg: string, meta?: Meta) => write("error.log", "error", msg, meta);
export const logAuth = (userKey: string, role: string, action: string, meta?: Meta) => 
  write("auth.log", "info", `${role} ${userKey}: ${action}`, meta);

// ---------------- Admin Actions ----------------
export const logAdminAction = (adminEmail: string, action: string, meta?: Meta) => 
  write("admin.log", "info", `${adminEmail}: ${action}`, meta);

// ---------------- Google Sheets Sync ----------------
export const logSheet = (sheetName: string, action: string, success: boolean, meta?: Meta) => 
  write("sheet.log", success ? "info" : "error", `${sheetName}: ${action}`, meta);

// ---------------- Hybrid Cache (L1/L2/L3) ----------------
export function logCacheHit(level: 'L1' | 'L2', key: string) {
  write("cache.log", "info", `Cache HIT [${level}]: ${key}`);
}

export function logCacheMiss(key: string) {
  write("cache.log", "warn", `Cache MISS: ${key} -> Fetching from Source`);
}

export function logCacheUpdate(key: string) {
  write("cache.log", "info", `Cache UPDATED (RAM & Upstash): ${key}`);
}

// ---------------- GeoJSON Data ----------------
const logRead = (fileName: string) => write("geojson.log", "info", `Read file: ${path.basename(fileName)}`);
const logUpdated = (fileName: string) => write("geojson.log", "info", `Updated file: ${path.basename(fileName)}`);

export const logBaseDataRead = () => logRead(BASE_DATA);
export const logBaseDataUpdated = () => logUpdated(BASE_DATA);
export const logPOIDataRead = () => logRead(POI_DATA);
export const logPOIDataUpdated = () => logUpdated(POI_DATA);
export const logBoundaryDataRead = () => logRead(BOUNDARY_DATA);
export const logBoundaryDataUpdated = () => logUpdated(BOUNDARY_DATA);

// ---------------- Weather & Traffic ----------------
export const logWeatherFetched = (source: string) => write("weather.log", "info", `Fetched weather: ${source}`);
export const logTrafficFetched = (source: string) => write("traffic.log", "info", `Fetched traffic: ${source}`);

// ---------------- Mock ----------------
export const logMockUsed = (service: string, file: string) => {
  write("mock.log", "info", `MOCK ACTIVE: ${service} using ${file}`);
}