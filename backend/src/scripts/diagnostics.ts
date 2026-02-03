import fs from "fs/promises";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Configuration & Headers
const SHEET_HEADERS = {
  ROAD_CODE: "road_refno",
  DISTRICT: "incidentDistrict",
  STATUS: "status"
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, "../../"); 
// Updated to production file
const envPath = path.join(rootPath, ".env.production");

async function runFullAudit() {
  console.log("\n" + "=".repeat(85));
  console.log("🚀 SADAK-SATHI: GLOBAL PRODUCTION DIAGNOSTIC & SECRET AUDIT (2026)");
  console.log("=".repeat(85));

  // --- 1. GLOBAL SECRET AUDIT ---
  console.log("\n🔐 [1/7] Global Secret Audit:");
  try {
    const envContent = await fs.readFile(envPath, "utf-8");
    const envConfig = dotenv.parse(envContent);
    // Load into process.env for subsequent steps
    for (const k in envConfig) { process.env[k] = envConfig[k]; }

    const sections: Record<string, string[]> = {
      "REDIS/CACHE": ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD"],
      "SERVER": ["PORT", "API_PREFIX", "NODE_ENV", "JWT_SECRET"],
      "MAP/GOOGLE": ["GAS_URL", "SHEET_ID", "GOOGLE_MAPS_API_KEY", "TOMTOM_API_KEY", "WAZE_JSON"],
      "AI/WEATHER": ["OPENWEATHERMAP_API_KEY", "GEMINI_API_KEY", "GEMINI_MODEL_PRIMARY"],
      "FIREBASE": ["FIREBASE_API_KEY", "FIREBASE_PROJECT_ID", "FIREBASE_APP_ID", "FIREBASE_BACKEND"],
      "INFRA": ["RENDER_TOKEN", "SENTRY_DSN", "TELEGRAM_BOT_TOKEN", "SMTP_PASS"]
    };

    for (const [section, keys] of Object.entries(sections)) {
      console.log(`\n--- ${section} ---`);
      const table = keys.map(k => ({
        Secret: k,
        Status: process.env[k] ? "✅ OK" : "❌ MISSING",
        Preview: process.env[k] ? String(process.env[k]).substring(0, 10) + "..." : "EMPTY"
      }));
      console.table(table);
    }
  } catch (err) {
    console.error("❌ CRITICAL: .env.production file not found!");
    process.exit(1);
  }

  // --- 2. RESOURCE AUDIT ---
  console.log("\n🧠 [2/7] System Resources:");
  const mem = process.memoryUsage();
  console.log(`- RAM Usage: ${Math.round(mem.rss / 1024 / 1024)} MB | Node: ${process.version}`);

  // --- 3. LOCAL DATA AUDIT ---
  console.log("\n🗺️  [3/7] GeoJSON Data Audit:");
  const filesToCheck = [
    { name: "Boundary", path: process.env.BOUNDARY_DATA || "data/boundary.geojson" },
    { name: "Master Roads", path: process.env.BASE_DATA || "data/master.geojson" }
  ];

  for (const file of filesToCheck) {
    try {
      const filePath = path.join(rootPath, file.path);
      const raw = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(raw);
      console.log(`✅ ${file.name}: Found (${json.features?.length || 0} features)`);
    } catch (e) {
      console.log(`❌ ${file.name}: MISSING or INVALID at ${file.path}`);
    }
  }

  // --- 4. DATA INTEGRITY (Sheet Sync) ---
  console.log("\n📂 [4/7] Road Data Integrity (Sheet Sync):");
  try {
    const GAS_URL = process.env.GAS_URL;
    if (GAS_URL) {
      console.log("📡 Fetching Live Incidents...");
      const response = await axios.get(GAS_URL, { timeout: 15000 });
      let sheetRows = response.data.status === "Success" ? response.data.data : [];
      console.log(sheetRows.length > 0 ? `✅ Success: ${sheetRows.length} incidents found.` : "⚠️  No active incidents found.");
    }
  } catch (err: any) {
    console.error("❌ Road Data Audit Failed:", err.message);
  }

  // --- 5. INTERNAL ENDPOINT AVAILABILITY ---
  console.log("\n🌐 [5/7] Internal API Accessibility:");
  const PORT = process.env.PORT || 4000;
  const internalEndpoints = [
    { name: "Roads API", path: "/api/v1/roads" },
    { name: "Health Check", path: "/health" }
  ];
  
  for (const endpoint of internalEndpoints) {
    try {
      await axios.get(`http://localhost:${PORT}${endpoint.path}`, { timeout: 2000 });
      console.log(`✅ ${endpoint.name}: REACHABLE`);
    } catch (err) {
      console.log(`ℹ️  ${endpoint.name}: OFFLINE (Port ${PORT})`);
    }
  }

  // --- 6. CACHE AUDIT ---
  console.log("\n⚡ [6/7] Cache Service Audit (Redis):");
  console.log(`- Redis REST URL: ${process.env.UPSTASH_REDIS_REST_URL ? "🔗 DEFINED" : "❌ MISSING"}`);

  // --- 7. EXTERNAL DEPENDENCY MAPPING ---
  console.log("\n🔗 [7/7] External Connectivity Check:");
  const depMapping = [
    { Feature: "Road Status", Provider: "Google Sheets", URL: process.env.GAS_URL },
    { Feature: "Monsoon", Provider: "OpenWeather", URL: "https://api.openweathermap.org/data/2.5/weather" },
    { Feature: "AI", Provider: "Gemini", URL: "https://generativelanguage.googleapis.com" }
  ];

  const depResults = [];
  for (const row of depMapping) {
    let status = "❌ NO CONFIG";
    if (row.URL) {
      try {
        await axios.get(row.URL, { timeout: 4000 });
        status = "✅ ONLINE";
      } catch (err: any) {
        status = err.response ? "✅ REACHABLE" : "⚠️  TIMED OUT";
      }
    }
    depResults.push({ ...row, Status: status });
  }
  console.table(depResults);

  console.log("\n" + "=".repeat(85));
  console.log("🏁 FULL DIAGNOSTIC COMPLETE");
  console.log("=".repeat(85) + "\n");
}

runFullAudit();