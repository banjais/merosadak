// backend/src/scripts/mergeData.ts
import * as path from "path";
import fs from "fs/promises";
import axios from "axios";
import { SHEET_HEADERS, ROAD_STATUS } from "../constants/sheets.js";
import { CACHE_DIR, BASE_DATA } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { GAS_URL, SHEET_TAB } from "../config/index.js";

const SHEET_URL = SHEET_TAB ? `${GAS_URL}?tab=${encodeURIComponent(SHEET_TAB)}` : GAS_URL;

const CACHE_FILE = BASE_DATA;

// Ensure cache directory exists
async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

// --- Exported for roadService
export async function fetchSheetData(): Promise<any[]> {
  try {
    const res = await axios.get(SHEET_URL, { timeout: 15000 });
    if (!res.data || !Array.isArray(res.data.data)) {
      throw new Error("Invalid sheet data structure");
    }
    return res.data.data;
  } catch (err: any) {
    logError("[mergeData] Failed to fetch sheet data", err.message);
    return [];
  }
}

// Normalize all known GAS status variations to the 3 standard values
const STATUS_NORMALIZE: Record<string, string> = {
  "Blocked": ROAD_STATUS.BLOCKED,
  "blocked": ROAD_STATUS.BLOCKED,
  "BLOCKED": ROAD_STATUS.BLOCKED,
  "One-Lane": ROAD_STATUS.ONE_LANE,
  "One Lane": ROAD_STATUS.ONE_LANE,
  "One-Lane ": ROAD_STATUS.ONE_LANE,
  "One-Lane  ": ROAD_STATUS.ONE_LANE,
  "One-Lane   ": ROAD_STATUS.ONE_LANE,
  "One Way": ROAD_STATUS.ONE_LANE,
  "One-Way": ROAD_STATUS.ONE_LANE,
  "One way": ROAD_STATUS.ONE_LANE,
  "one-lane": ROAD_STATUS.ONE_LANE,
  "Resumed": ROAD_STATUS.RESUMED,
  "resumed": ROAD_STATUS.RESUMED,
  "RESUMED": ROAD_STATUS.RESUMED,
};

function normalizeRow(row: any, rowIndex: number) {
  const rawStatus = (row[SHEET_HEADERS.STATUS] || "").toString().trim();
  // Normalize status variations to standard values
  let status = STATUS_NORMALIZE[rawStatus] || "";

  // Validate that status is one of the three allowed values
  const validStatuses = [ROAD_STATUS.BLOCKED, ROAD_STATUS.ONE_LANE, ROAD_STATUS.RESUMED];
  if (rawStatus && !status) {
    console.warn(`[mergeData] Invalid status '${rawStatus}' for row ${rowIndex + 1} (${row[SHEET_HEADERS.ROAD_CODE] || "no ref"}), dropping row`);
  }

  const normalized = {
    reportDate: row[SHEET_HEADERS.SUBMISSION_DATE] || "",
    div_name: row[SHEET_HEADERS.DIVISION] || "",
    road_refno: row[SHEET_HEADERS.ROAD_CODE] || "",
    road_name: row[SHEET_HEADERS.ROAD_NAME] || "",
    incidentDistrict: row[SHEET_HEADERS.DISTRICT] || "",
    incidentPlace: row[SHEET_HEADERS.PLACE] || "",
    chainage: row[SHEET_HEADERS.CHAINAGE] || "",
    incidentCoordinate: row[SHEET_HEADERS.COORDINATES] || "",
    incidentStarted: row[SHEET_HEADERS.START_DATE] || "",
    estimatedRestoration: row[SHEET_HEADERS.ESTIMATED_RESTORATION] || "",
    status: status,
    resumedDate: row[SHEET_HEADERS.RESUMED_DATE] || "",
    blockedHours: row[SHEET_HEADERS.BLOCKED_HOURS] || "",
    contactPerson: row[SHEET_HEADERS.CONTACT] || "",
    restorationEfforts: row[SHEET_HEADERS.EFFORTS] || "",
    remarks: row[SHEET_HEADERS.REMARKS] || "",
  };

  const issues: string[] = [];
  if (!normalized.road_refno) issues.push("Missing road_refno");
  if (!normalized.status) issues.push("Missing status");

  if (issues.length)
    console.warn(`[mergeData] Row ${rowIndex + 2} issues: ${issues.join(", ")}`);

  return normalized;
}

// --- Merge & write cache
export async function mergeData() {
  try {
    logInfo("🛣️ Starting road merge from Google Sheet...");

    const rawData = await fetchSheetData();
    if (!rawData.length) {
      logInfo("[mergeData] No data returned from sheet. Writing empty collection.");
      await ensureCacheDir();
      await fs.writeFile(
        CACHE_FILE,
        JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2),
        "utf-8"
      );
      return;
    }

    const rows = rawData.map((r, i) => normalizeRow(r, i));
    const rawCount = rows.length;

    const features = rows
      .filter((r) => r.status)
      .map((r) => {
        let geometry: any = null;
        if (r.incidentCoordinate) {
          const [lat, lng] = r.incidentCoordinate.split(",").map(Number);
          if (!isNaN(lat) && !isNaN(lng))
            geometry = { type: "Point", coordinates: [lng, lat] };
        }
        return { type: "Feature", geometry, properties: { ...r } };
      });

    const dropped = rawCount - features.length;
    if (dropped > 0) {
      logInfo(`⚠️  ${dropped} of ${rawCount} rows dropped (invalid/missing status)`);
    }

    await ensureCacheDir();
    await fs.writeFile(
      CACHE_FILE,
      JSON.stringify({ type: "FeatureCollection", features }, null, 2),
      "utf-8"
    );

    logInfo(`✅ Merge complete. ${features.length} rows written to ${CACHE_FILE}`);
  } catch (err: any) {
    logError("[mergeData] Merge failed", err.message);
  }
}

// Run directly
mergeData().catch(console.error);
