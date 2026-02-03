import { appendFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const LOG_DIR = path.join(__dirname, "logs");

// Ensure logs directory exists
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

export function logInfo(message: string) {
  const logLine = `[INFO] ${new Date().toISOString()} - ${message}\n`;
  appendFileSync(path.join(LOG_DIR, "info.log"), logLine, "utf-8");
}

export function logError(message: string) {
  const logLine = `[ERROR] ${new Date().toISOString()} - ${message}\n`;
  appendFileSync(path.join(LOG_DIR, "error.log"), logLine, "utf-8");
}