// backend/src/scripts/build-summary.ts
import fs from "fs/promises";
import path from "path";
import paths from "../config/paths.js";

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

  let highwayCount = 0;
  let totalSegments = 0;
  let statusCount = { Blocked: 0, "One-Lane": 0, Resumed: 0 };

  // Load highway data
  try {
    const highwayDir = path.join(paths.DATA_DIR, "highway");
    const indexPath = path.join(highwayDir, "index.json");
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const highways = JSON.parse(indexContent);
    highwayCount = highways.length;

    console.log(`🛣️  Highways indexed         → ${highwayCount} highways`);

    // Count segments and statuses from all highways
    for (const h of highways) {
      try {
        const hPath = path.join(highwayDir, h.file);
        const hContent = await fs.readFile(hPath, "utf-8");
        const hData = JSON.parse(hContent);
        if (hData.features) {
          totalSegments += hData.features.length;
          hData.features.forEach((f: any) => {
            const st = f.properties?.status || "Resumed";
            if (st === "Blocked") statusCount.Blocked++;
            else if (st === "One-Lane" || st === "One Lane") statusCount["One-Lane"]++;
            else statusCount.Resumed++;
          });
        }
      } catch { /* skip individual highway errors */ }
    }

    console.log(`📦 Total road segments     → ${totalSegments} segments`);

    console.log(`\n${C.bold}Status Breakdown:${C.reset}`);
    [
      { label: "Blocked", count: statusCount.Blocked },
      { label: "One-Lane", count: statusCount["One-Lane"] },
      { label: "Resumed", count: statusCount.Resumed },
    ].forEach(({ label, count }) => {
      const pct = totalSegments ? ((count / totalSegments) * 100).toFixed(1) : "0.0";
      const color = label === "Blocked" ? C.red : label === "One-Lane" ? C.yellow : C.green;
      console.log(`   ${color}■${C.reset} ${label.padEnd(10)} ${count} segments (${pct}%)`);
    });

  } catch (e: any) {
    console.log(`❌ Failed to load highway data: ${e.message}`);
  }

  // Check boundary files
  try {
    const boundaryTypes = ['districts', 'provinces', 'local'];
    for (const type of boundaryTypes) {
      try {
        const bPath = path.join(paths.DATA_DIR, `${type}.geojson`);
        const bContent = await fs.readFile(bPath, "utf-8");
        const bData = JSON.parse(bContent);
        const features = bData.features?.length || 0;
        console.log(`🗺️  ${type} boundary         → ${features} features`);
      } catch {
        console.log(`❌ ${type} boundary not found`);
      }
    }
  } catch (e: any) {
    console.log(`❌ Failed to check boundaries: ${e.message}`);
  }

  const allResumed = statusCount.Blocked === 0 && statusCount["One-Lane"] === 0;
  const finalStatus = allResumed ? "HEALTHY" : "MONITORING";
  const statusColor = allResumed ? C.green : C.yellow;

  console.log(`\n${statusColor}${C.bold}🏥 System Status: ${finalStatus}${C.reset}`);
  console.log("=".repeat(70) + "\n");
}

buildSummary().catch(console.error);