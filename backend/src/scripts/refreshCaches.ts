// backend/src/scripts/refreshCaches.ts
// Script to refresh all caches - run with: npm run refresh-caches

import "../config/bootstrapEnv.js";
import fs from "fs/promises";
import path from "path";
import { CACHE_DIR } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { withCache, clearCache } from "../services/cacheService.js";
import { refreshPOICache } from "../services/poiService.ts";
import { refreshWazeCache } from "../services/wazeService.ts";
import { getWeather } from "../services/weatherService.ts";
import { refreshRoadCache } from "../services/roadService.ts";
import { refreshTrafficCache } from "../services/trafficService.ts";
import { refreshAlertCache } from "../services/alertService.ts";
import { refreshMonsoonCache } from "../services/monsoonService.ts";

// ANSI colors
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

async function refreshAllCaches() {
  console.log(`\n${C.cyan}${C.bold}🔄 Refreshing all caches...${C.reset}\n`);

  const results = {
    success: [] as string[],
    failed: [] as { name: string; error: string }[],
  };

  // 1. Weather cache
  try {
    console.log(`  ${C.yellow}🌦️  Weather...${C.reset}`);
    const weather = await getWeather();
    await fs.writeFile(
      path.join(CACHE_DIR, "weather.json"),
      JSON.stringify({ value: weather, timestamp: new Date().toISOString() }, null, 2),
      "utf-8"
    );
    results.success.push("Weather");
    console.log(`  ${C.green}✓ Weather cached${C.reset}`);
  } catch (err: any) {
    results.failed.push({ name: "Weather", error: err.message });
    console.log(`  ${C.red}✗ Weather failed: ${err.message}${C.reset}`);
  }

  // 2. POI cache
  try {
    console.log(`  ${C.yellow}📍 POI...${C.reset}`);
    await refreshPOICache();
    results.success.push("POI");
    console.log(`  ${C.green}✓ POI cached${C.reset}`);
  } catch (err: any) {
    results.failed.push({ name: "POI", error: err.message });
    console.log(`  ${C.red}✗ POI failed: ${err.message}${C.reset}`);
  }

  // 3. Waze cache
  try {
    console.log(`  ${C.yellow}🚗 Waze...${C.reset}`);
    await refreshWazeCache();
    results.success.push("Waze");
    console.log(`  ${C.green}✓ Waze cached${C.reset}`);
  } catch (err: any) {
    results.failed.push({ name: "Waze", error: err.message });
    console.log(`  ${C.red}✗ Waze failed: ${err.message}${C.reset}`);
  }

  // 4. Road cache
  try {
    console.log(`  ${C.yellow}🛣️  Roads...${C.reset}`);
    await refreshRoadCache();
    results.success.push("Roads");
    console.log(`  ${C.green}✓ Roads cached${C.reset}`);
  } catch (err: any) {
    results.failed.push({ name: "Roads", error: err.message });
    console.log(`  ${C.red}✗ Roads failed: ${err.message}${C.reset}`);
  }

  // 5. Traffic cache
  try {
    console.log(`  ${C.yellow}🚦 Traffic...${C.reset}`);
    await refreshTrafficCache();
    results.success.push("Traffic");
    console.log(`  ${C.green}✓ Traffic cached${C.reset}`);
  } catch (err: any) {
    results.failed.push({ name: "Traffic", error: err.message });
    console.log(`  ${C.red}✗ Traffic failed: ${err.message}${C.reset}`);
  }

  // 6. Alerts cache
  try {
    console.log(`  ${C.yellow}🚨 Alerts...${C.reset}`);
    await refreshAlertCache();
    results.success.push("Alerts");
    console.log(`  ${C.green}✓ Alerts cached${C.reset}`);
  } catch (err: any) {
    results.failed.push({ name: "Alerts", error: err.message });
    console.log(`  ${C.red}✗ Alerts failed: ${err.message}${C.reset}`);
  }

  // 7. Monsoon cache
  try {
    console.log(`  ${C.yellow}🌧️  Monsoon...${C.reset}`);
    await refreshMonsoonCache();
    results.success.push("Monsoon");
    console.log(`  ${C.green}✓ Monsoon cached${C.reset}`);
  } catch (err: any) {
    results.failed.push({ name: "Monsoon", error: err.message });
    console.log(`  ${C.red}✗ Monsoon failed: ${err.message}${C.reset}`);
  }

  // Summary
  console.log(`\n${C.cyan}${C.bold}── Summary ──${C.reset}`);
  console.log(`  ${C.green}Success: ${results.success.length}${C.reset}`);
  console.log(`  ${C.red}Failed: ${results.failed.length}${C.reset}`);

  if (results.failed.length > 0) {
    console.log(`\n${C.red}Failed caches:${C.reset}`);
    results.failed.forEach(f => {
      console.log(`  - ${f.name}: ${f.error}`);
    });
  }

  console.log("");
}

refreshAllCaches().catch((err) => {
  console.error(`${C.red}Cache refresh failed:${C.reset}`, err);
  process.exit(1);
});