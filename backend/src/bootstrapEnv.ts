// backend/bootstrapEnv.ts
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// 1. Determine Environment
const isProd = process.env.NODE_ENV === "production";
let envFile = isProd ? ".env.production" : ".env.development";

// 2. Resolve Path (Checks both current folder and root folder)
let fullEnvPath = path.resolve(process.cwd(), envFile);

// FALLBACK LOGIC: If the preferred file doesn't exist, try the other one
if (!fs.existsSync(fullEnvPath)) {
  const fallbackFile = isProd ? ".env.development" : ".env.production";
  const fallbackPath = path.resolve(process.cwd(), fallbackFile);
  
  if (fs.existsSync(fallbackPath)) {
    console.warn(`⚠️  ${envFile} not found. Falling back to ${fallbackFile}`);
    envFile = fallbackFile;
    fullEnvPath = fallbackPath;
  }
}

// 3. Load Environment Variables
dotenv.config({ path: fullEnvPath, override: true });
console.log("🔹 Active Env File:", envFile);
console.log("🔹 Working Directory:", process.cwd());

// 4. Critical Exit only if NO env file is found in Development
if (!fs.existsSync(fullEnvPath)) {
  const msg = `CRITICAL: No environment file found at ${fullEnvPath}`;
  if (isProd) {
    console.warn(`⚠️  ${msg}. Assuming variables are injected via Cloud Provider.`);
  } else {
    console.error(`❌ ${msg}. System cannot start in development mode.`);
    process.exit(1);
  }
}

// 5. Masking and Logging for Audit
const mask = (s?: string) => {
  if (!s || s.trim() === "") return "❌ MISSING";
  return `${s.substring(0, 4)}***[HIDDEN]`;
};

const allVars = [
  "NODE_ENV", "PORT", "JWT_SECRET", "GAS_URL", "SHEET_ID",
  "TOMTOM_API_KEY", "WAZE_JSON", "GOOGLE_MAPS_API_KEY",
  "OPENWEATHERMAP_API_KEY", "GEMINI_API_KEY", "FIREBASE_API_KEY",
  "RENDER_TOKEN", "RENDER_BACKEND", "FIREBASE_BACKEND"
];

console.log("\n🔐 Environment Audit:");
allVars.forEach((v) => {
  console.log(`- ${v.padEnd(25)}: ${mask(process.env[v])}`);
});

console.log("\n✅ Bootstrap check complete.\n");

export const ENV = process.env;