import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatMessage(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

function writeLog(level: string, message: string, meta?: any) {
  const logLine = formatMessage(level, message, meta);
  fs.appendFileSync(LOG_FILE, logLine);
  if (level === "ERROR") {
    console.error(message, meta || "");
  } else {
    console.log(message, meta || "");
  }
}

export function logInfo(message: string, meta?: any) {
  writeLog("INFO", message, meta);
}

export function logError(message: string, meta?: any) {
  writeLog("ERROR", message, meta);
}

export function logAuth(message: string, meta?: any) {
  writeLog("AUTH", message, meta);
}

export function logCacheHit(message: string, meta?: any) {
  writeLog("CACHE_HIT", message, meta);
}

export function logCacheMiss(message: string, meta?: any) {
  writeLog("CACHE_MISS", message, meta);
}

export function logCacheUpdate(message: string, meta?: any) {
  writeLog("CACHE_UPDATE", message, meta);
}