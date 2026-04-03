// backend/src/scripts/build-summary.ts
import fs from "fs/promises";
import axios from "axios";
import paths from "../config/paths.js";
import { ROAD_STATUS } from "../constants/sheets.js";
import { GAS_URL, SHEET_TAB } from "../config/index.js";

const C = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

async function buildSummary() {
  console.log(`\n${C.cyan}${C.bold}🏗️  MeroSadak Backend Build Summary${C.reset}`);
  console.log("=".repeat(70));

  let gasRows = 0;
  let gasStatuses: Record<string, number> = {};
  let mergedRows = 0;
  let mergedStatuses = { Blocked: 0, "One-Lane": 0, Resumed: 0 };

  // 1. GAS Data
  try {
    const url = GAS_URL + (SHEET_TAB ? `?tab=${encodeURIComponent(SHEET_TAB)}` : "");
    const res = await axios.get(url, { timeout: 15000 });
    const data = res.data?.data || [];

    gasRows = data.length;

    data.forEach((row: any) => {
      const status = (row.status || "").toString().trim();
      gasStatuses[status] = (gasStatuses[status] || 0) + 1;
    });

    console.log(`📡 GAS (Google Sheet)      → ${gasRows} rows`);
    console.log(`   Raw statuses : ${Object.entries(gasStatuses).map(([k,v]) => `${k||"(empty)"}=${v}`).join(", ") || "none"}`);

  } catch (e: any) {
    console.log(`❌ GAS fetch failed: ${e.message}`);
  }

  // 2. Merged Data
  try {
    const masterPath = paths.BASE_DATA;
    const content = await fs.readFile(masterPath, "utf-8");
    const geo = JSON.parse(content);
    const features = geo.features || [];

    mergedRows = features.length;

    features.forEach((f: any) => {
      const st = f.properties?.status || "";
      if (st === ROAD_STATUS.BLOCKED) mergedStatuses.Blocked++;
      else if (st === ROAD_STATUS.ONE_LANE) mergedStatuses["One-Lane"]++;
      else if (st === ROAD_STATUS.RESUMED) mergedStatuses.Resumed++;
    });

    console.log(`\n📦 Merged master.geojson   → ${mergedRows} rows`);

    const dropped = gasRows - mergedRows;
    if (dropped > 0) {
      console.log(`⚠️  ${dropped} rows were dropped (no valid status after normalization)`);
    } else if (gasRows > 0) {
      console.log(`✅ All ${gasRows} rows successfully merged`);
    }

    console.log(`\n${C.bold}Status Breakdown (Merged):${C.reset}`);
    [
      { label: "Blocked", count: mergedStatuses.Blocked },
      { label: "One-Lane", count: mergedStatuses["One-Lane"] },
      { label: "Resumed", count: mergedStatuses.Resumed },
    ].forEach(({ label, count }) => {
      const pct = mergedRows ? ((count / mergedRows) * 100).toFixed(1) : "0.0";
      const color = label === "Blocked" ? C.red : label === "One-Lane" ? C.yellow : C.green;
      console.log(`   ${color}■${C.reset} ${label.padEnd(10)} ${count} rows (${pct}%)`);
    });

  } catch (e: any) {
    console.log(`❌ Failed to read master.geojson: ${e.message}`);
  }

  const finalStatus = (mergedRows === gasRows && gasRows > 0) ? "HEALTHY" : "DEGRADED";
  const statusColor = (mergedRows === gasRows && gasRows > 0) ? C.green : C.yellow;

  console.log(`\n${statusColor}${C.bold}🏥 System Status: ${finalStatus}${C.reset}`);
  console.log(`   Merged Rows : ${mergedRows} | GAS Rows : ${gasRows}`);
  console.log("=".repeat(70) + "\n");
}

buildSummary().catch(console.error);