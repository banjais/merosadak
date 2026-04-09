// backend/src/services/superadminService.ts
import path from "path";
import fs from "fs/promises";
import PDFDocument from "pdfkit";
import {
  LOG_DIR,
  CACHE_DIR,
  CACHE_ROAD,
  CACHE_TRAFFIC,
  CACHE_POI,
  CACHE_WEATHER,
  CACHE_MONSOON,
  CACHE_WAZE
} from "../config/paths.js";
import { logError } from "../logs/logs.js";
import { ROAD_STATUS } from "../constants/sheets.js";

// ✅ Import functions correctly
import * as cacheService from "./cacheService.js";
import { getCachedMonsoonRisk } from "./monsoonService.js";
import { getCachedRoads } from "./roadService.js";

const ANALYTICS_FILE = path.join(CACHE_DIR, "analytics.json");

/**
 * 📑 Master PDF Generation
 */
export async function generateMasterReport(): Promise<Buffer> {
  try {
    const logs = await getHistoricalLogs(500);
    const upstashStats = await cacheService.getUpstashUsage();

    // ✅ Use getCacheHealth via cacheService alias
    const cacheHealth = cacheService.getCacheHealth();

    const risks = await getCachedMonsoonRisk();
    const roadsGeo = await getCachedRoads();

    const extremeCount = risks.filter(r => r.riskLevel === "EXTREME").length;
    const highCount = risks.filter(r => r.riskLevel === "HIGH").length;
    const mediumCount = risks.filter(r => r.riskLevel === "MEDIUM").length;

    const analyticsRaw = await fs.readFile(ANALYTICS_FILE, "utf-8").catch(() => "{}");
    const analyticsData = JSON.parse(analyticsRaw);

    const activeIncidents = roadsGeo.merged.filter(f => f.properties && f.properties.status !== ROAD_STATUS.RESUMED).length;

    const doc = new PDFDocument({ margin: 40, info: { Title: 'MeroSadak Admin Report', Author: 'MeroSadak System' } });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => { });
    doc.on("error", (err: Error) => { throw err; });

    doc.fontSize(22).fillColor('#2c3e50').text("MeroSadak Management Report", { align: "center" });
    doc.fontSize(10).fillColor('#7f8c8d').text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(2);

    // --- Infrastructure & Cache Health ---
    doc.fontSize(16).fillColor('#e67e22').text("Infrastructure & Cache Health");
    doc.rect(40, doc.y, 515, 2).fill('#e67e22');
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#000');
    doc.text(`System Cache Status: ${cacheHealth.status}`);
    doc.text(`Local RAM Cache Items: ${cacheHealth.l1_items}`);
    // upstashStats is always null since admin API is not configured

    const cacheFiles = [CACHE_ROAD, CACHE_TRAFFIC, CACHE_POI, CACHE_WEATHER, CACHE_MONSOON, CACHE_WAZE];
    for (const file of cacheFiles) {
      try {
        const stat = await fs.stat(file);
        doc.text(`${path.basename(file)}: ${(stat.size / 1024).toFixed(2)} KB`);
      } catch { }
    }
    doc.moveDown(1);

    // --- Monsoon Risk ---
    doc.fontSize(16).fillColor('#c0392b').text("Monsoon Risk Summary");
    doc.rect(40, doc.y, 515, 2).fill('#c0392b');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000')
      .text(`Extreme: ${extremeCount}`)
      .text(`High: ${highCount}`)
      .text(`Medium: ${mediumCount}`)
      .text(`Total Roads Assessed: ${risks.length}`);
    doc.moveDown(1);

    // --- Analytics ---
    doc.fontSize(16).fillColor('#16a085').text("Analytics Summary");
    doc.rect(40, doc.y, 515, 2).fill('#16a085');
    doc.moveDown(0.5);
    Object.entries(analyticsData).forEach(([key, value]) => {
      if (key.startsWith("last_")) return;
      const last = analyticsData[`last_${key}`] || 'N/A';
      doc.fontSize(10).fillColor('#000').text(`${key}: ${value} (Last: ${last})`);
    });
    doc.moveDown(1);

    // --- Active Road Incidents ---
    doc.fontSize(16).fillColor('#2980b9').text("Active Road Incidents Summary");
    doc.rect(40, doc.y, 515, 2).fill('#2980b9');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000')
      .text(`Total Road Segments: ${roadsGeo.merged.length}`)
      .text(`Active Incidents (Not Resumed): ${activeIncidents}`);
    doc.moveDown(1);

    // --- Recent Audit Logs ---
    doc.fontSize(16).fillColor('#34495e').text("Recent Audit Logs (Last 500)");
    doc.rect(40, doc.y, 515, 2).fill('#34495e');
    doc.moveDown(0.5);
    if (logs.length === 0) {
      doc.fontSize(10).text("No logs found for this period.");
    } else {
      logs.forEach(line => {
        doc.fontSize(8).fillColor('#333').text(line, { width: 515 });
        doc.moveDown(0.2);
      });
    }

    doc.end();

    // Wait for the PDF to be fully generated and return it
    return new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (err: Error) => {
        reject(err);
      });
    });
  } catch (err: any) {
    logError("[superadminService] PDF generation failed", { error: err.message });
    throw err;
  }
}

/* ---------------- Analytics & Logs ---------------- */
export async function recordAnalytics(event: string, meta?: any) {
  try {
    const raw = await fs.readFile(ANALYTICS_FILE, "utf-8").catch(() => "{}");
    const data = JSON.parse(raw);
    data[event] = (data[event] || 0) + 1;
    data[`last_${event}`] = new Date().toISOString();
    await fs.writeFile(ANALYTICS_FILE, JSON.stringify(data, null, 2));
  } catch (err: any) {
    logError("[superadminService] recordAnalytics failed", { error: err.message });
  }
}

export async function getHistoricalLogs(limit: number = 100): Promise<string[]> {
  try {
    const files = await fs.readdir(LOG_DIR);
    const dateStr = new Date().toISOString().slice(0, 10);
    const relevantFiles = files.filter(f => f.includes(dateStr) && (f.startsWith("admin") || f.startsWith("superadmin")));

    let logs: string[] = [];
    for (const file of relevantFiles) {
      const content = await fs.readFile(path.join(LOG_DIR, file), "utf-8");
      logs = logs.concat(content.trim().split("\n").filter(l => l.length > 0));
    }

    return logs.reverse().slice(0, limit);
  } catch (err: any) {
    logError("[superadminService] Failed to read historical logs", { error: err.message });
    return [];
  }
}
