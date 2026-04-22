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
  CACHE_WAZE,
  DATA_DIR
} from "@/config/paths.js";
import { logError, logInfo } from "@logs/logs.js";
import { ROAD_STATUS } from "@/constants/sheets.js";
import { REDIS_NOTIFIED_PREFIX } from "@/services/alertService.js";

// ✅ Import functions correctly
import * as cacheService from "@/services/cacheService.js";
import { getCachedMonsoonRisk } from "@/services/monsoonService.js";
import { getCachedRoads } from "@/services/roadService.js";
import { getAnalyticsData } from "@/services/analyticsService.js";
import { getHighwayList } from "@/services/highwayService.js";

/**
 * 📑 Master PDF Generation
 */
export async function generateMasterReport(): Promise<Buffer> {
  try {
    const logs = await getHistoricalLogs(500);
    const upstashStats = await cacheService.getUpstashUsage();

    // Fixed: Await the async health check
    const cacheHealth = await cacheService.getCacheHealth();

    const risks = (await getCachedMonsoonRisk()) || [];
    const roadsGeo = (await getCachedRoads()) || { merged: [] };

    const extremeCount = risks.filter(r => r.riskLevel === "EXTREME").length;
    const highCount = risks.filter(r => r.riskLevel === "HIGH").length;
    const mediumCount = risks.filter(r => r.riskLevel === "MEDIUM").length;

    const analyticsData = await getAnalyticsData();

    const activeIncidents = roadsGeo.merged.filter(f => f.properties && f.properties.status !== ROAD_STATUS.RESUMED).length;

    const doc = new PDFDocument({
      margin: 40,
      info: { Title: 'MeroSadak Admin Report', Author: 'MeroSadak System' },
      bufferPages: true
    });

    const chunks: Buffer[] = [];
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));
    });

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

    if (upstashStats && upstashStats.status) {
      doc.text(`Cloud Cache (Upstash): ${upstashStats.status || 'Active'}`);
      doc.text(`Cloud Usage: ${upstashStats.usage_pct || 0}% of daily quota`);
    }

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
    return pdfPromise;
  } catch (err: any) {
    logError("[superadminService] PDF generation failed", { error: err.message });
    throw err;
  }
}

/**
 * Identifies and removes GeoJSON files in the highway directory that are not 
 * present in the highway index.
 */
export async function cleanupOrphanHighways(): Promise<{ deleted: string[]; errors: string[] }> {
  const highwayDir = path.join(DATA_DIR, "highway");
  const results = { deleted: [] as string[], errors: [] as string[] };

  try {
    const highways = await getHighwayList();
    const indexedFiles = new Set(highways.map(h => h.file));

    // Protect core index files
    indexedFiles.add("index.json");
    indexedFiles.add("highways_master.geojson");

    const files = await fs.readdir(highwayDir);
    for (const file of files) {
      if (!indexedFiles.has(file)) {
        try {
          await fs.unlink(path.join(highwayDir, file));
          results.deleted.push(file);
        } catch (err: any) {
          results.errors.push(`${file}: ${err.message}`);
        }
      }
    }
    logInfo(`[superadminService] Orphan cleanup complete. Deleted ${results.deleted.length} files.`);
  } catch (err: any) {
    logError("[superadminService] Failed to cleanup orphan highways", err.message);
  }
  return results;
}

export async function getHistoricalLogs(limit: number = 100): Promise<string[]> {
  try {
    const files = await fs.readdir(LOG_DIR);

    // Include error and app logs to ensure logError output is captured in reports
    const allowedPrefixes = ["admin", "superadmin", "error", "app"];
    const relevantFiles = files
      .filter(f => allowedPrefixes.some(p => f.startsWith(p)))
      .sort() // Sort alphabetically to maintain approximate chronological order
      .reverse(); // Newest files first

    let logs: string[] = [];
    for (const file of relevantFiles) {
      const content = await fs.readFile(path.join(LOG_DIR, file), "utf-8");
      const lines = content.trim().split("\n").filter(l => l.length > 0).reverse();
      logs = logs.concat(lines);
      if (logs.length >= limit) break;
    }

    return logs.slice(0, limit);
  } catch (err: any) {
    logError("[superadminService] Failed to read historical logs", { error: err.message });
    return [];
  }
}

/**
 * Cleans up old search history/logs to manage storage growth.
 */
export async function cleanupSearchLogs(retentionDays: number): Promise<number> {
  try {
    const SEARCH_LOG_FILE = path.join(DATA_DIR, "search_history.json");
    let logs: any[] = [];

    try {
      const raw = await fs.readFile(SEARCH_LOG_FILE, "utf-8");
      logs = JSON.parse(raw);
    } catch {
      return 0; // No logs to clean
    }

    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const initialCount = logs.length;

    const filteredLogs = logs.filter(entry => new Date(entry.timestamp).getTime() > cutoff);
    const deletedCount = initialCount - filteredLogs.length;

    if (deletedCount > 0) {
      await fs.writeFile(SEARCH_LOG_FILE, JSON.stringify(filteredLogs, null, 2));
    }

    return deletedCount;
  } catch (err: any) {
    logError("[superadminService] Search cleanup failed", err.message);
    return 0;
  }
}

/**
 * Manually clears all notification tracking keys from the cache.
 */
export async function clearNotifiedBlockageCache(): Promise<void> {
  try {
    await cacheService.clearCacheByPattern(`${REDIS_NOTIFIED_PREFIX}*`);
  } catch (err: any) {
    logError("[superadminService] Failed to clear notified blockage cache", err.message);
    throw err;
  }
}
