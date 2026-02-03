import fs from "fs/promises";
import path from "path";
import * as roadService from "./roadService.js";
import * as weatherService from "./weatherService.js";
import { CACHE_DIR, CACHE_MONSOON } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";

export interface RiskAssessment {
  roadId: string;
  roadName: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  color: string; // frontend mapping
  reason: string;
}

/**
 * 🔄 Calculate current monsoon risk and cache results
 */
export const calculateCurrentRisk = async (): Promise<RiskAssessment[]> => {
  const assessments: RiskAssessment[] = [];

  try {
    // 1️⃣ Fetch cached roads
    const roads = await roadService.getCachedRoads();
    if (!roads?.features) return [];

    for (const road of roads.features) {
      const { slope_angle, road_name, road_refno } = road.properties;
      const [lon, lat] = road.geometry.coordinates[0];

      // 2️⃣ Fetch live rainfall
      const weather = await weatherService.getLiveRainfall(lat, lon);
      const rainIntensity = weather?.intensity || 0;

      // 3️⃣ Determine risk level
      let riskLevel: RiskAssessment["riskLevel"] = "LOW";
      let color = "#22c55e";
      let reason = "Conditions normal.";

      if (rainIntensity > 12 || (slope_angle > 45 && rainIntensity > 5)) {
        riskLevel = "EXTREME";
        color = "#ef4444";
        reason = "Extreme rainfall on steep slopes. Immediate landslide risk.";
      } else if (rainIntensity > 6 || slope_angle > 35) {
        riskLevel = "HIGH";
        color = "#f97316";
        reason = "Heavy rain or high slope angle. Proceed with extreme caution.";
      } else if (rainIntensity > 2) {
        riskLevel = "MEDIUM";
        color = "#eab308";
        reason = "Moderate rainfall. Watch for minor debris or slippery surfaces.";
      }

      assessments.push({
        roadId: road.properties.id || road_refno || road_name,
        roadName: road_name,
        riskLevel,
        color,
        reason,
      });
    }

    // 4️⃣ Ensure cache folder exists
    await fs.mkdir(CACHE_DIR, { recursive: true });

    // 5️⃣ Write to cache
    await fs.writeFile(CACHE_MONSOON, JSON.stringify(assessments, null, 2), "utf-8");

    logInfo(`[MonsoonService] Cached ${assessments.length} risk assessments`);

    return assessments;
  } catch (err: any) {
    logError("[MonsoonService] Risk calculation failed", { error: err.message });
    return assessments; // partial results
  }
};

/**
 * 📂 Read cached risk assessments
 */
export const getCachedMonsoonRisk = async (): Promise<RiskAssessment[]> => {
  try {
    const raw = await fs.readFile(CACHE_MONSOON, "utf-8");
    return JSON.parse(raw);
  } catch {
    logInfo("[MonsoonService] No cached monsoon risk found.");
    return [];
  }
};

/**
 * ✅ Alias for system-wide consistency
 */
export const getMonsoonRisk = calculateCurrentRisk;
