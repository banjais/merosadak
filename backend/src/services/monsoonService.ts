import fs from "fs/promises";
import * as roadService from "./roadService.js";
import * as weatherService from "./weatherService.js";
import { CACHE_DIR, CACHE_MONSOON } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface RiskAssessment {
  roadId: string;
  roadName: string;
  riskLevel: RiskLevel;
  color: string;
  reason: string;
  rainIntensity?: number;
  slopeAngle?: number;
  lat: number;
  lng: number;
}

function getColor(level: RiskLevel) {
  switch (level) {
    case "EXTREME": return "#ef4444";
    case "HIGH": return "#f97316";
    case "MEDIUM": return "#eab308";
    default: return "#22c55e";
  }
}

function assessRisk(rainIntensity: number, slopeAngle: number) {
  if (rainIntensity > 12 || (slopeAngle > 45 && rainIntensity > 5)) {
    return { level: "EXTREME", reason: "Extreme rainfall on steep slopes. Immediate landslide risk." };
  } else if (rainIntensity > 6 || slopeAngle > 35) {
    return { level: "HIGH", reason: "Heavy rain or high slope angle. Proceed with caution." };
  } else if (rainIntensity > 2) {
    return { level: "MEDIUM", reason: "Moderate rainfall. Watch for debris or slippery surfaces." };
  }
  return { level: "LOW", reason: "Conditions normal." };
}

export async function calculateCurrentRisk(): Promise<RiskAssessment[]> {
  const assessments: RiskAssessment[] = [];
  try {
    const roadsCache = await roadService.getCachedRoads();
    const roads = roadsCache.merged ?? [];

    for (const road of roads) {
      const { slope_angle = 0, road_name, road_refno, id } = road.properties;
      let rainIntensity = 0;
      let lat: number | undefined, lon: number | undefined;

      try {
        if (!road.geometry || !road.geometry.coordinates) continue;

        const geomType = (road.geometry as any).type;
        if (geomType === "LineString") {
          const coords = road.geometry.coordinates[0];
          if (Array.isArray(coords) && coords.length >= 2) {
            [lon, lat] = coords;
          } else {
            continue;
          }
        } else if (geomType === "MultiLineString") {
          const coords = (road.geometry as any).coordinates[0]?.[0];
          if (Array.isArray(coords) && coords.length >= 2) {
            [lon, lat] = coords;
          } else {
            continue;
          }
        } else {
          continue;
        }

        if (lat !== undefined && lon !== undefined) {
          const weather = await weatherService.getLiveRainfall(lat, lon);
          rainIntensity = weather?.intensity || 0;
        }
      } catch (err: any) {
        logError("[MonsoonService] Weather fetch failed", { road: road_name, error: err.message });
      }

      const { level, reason } = assessRisk(rainIntensity, slope_angle);
      assessments.push({
        roadId: id || road_refno || road_name || '',
        roadName: road_name || '',
        riskLevel: level as RiskLevel,
        color: getColor(level as RiskLevel),
        reason,
        rainIntensity,
        slopeAngle: slope_angle,
        lat: lat ?? 0,
        lng: lon ?? 0,
      });
    }

    await fs.writeFile(CACHE_MONSOON, JSON.stringify(assessments, null, 2), "utf-8");
    logInfo(`[MonsoonService] Cached ${assessments.length} risk assessments`);
    return assessments;

  } catch (err: any) {
    logError("[MonsoonService] Risk calculation failed", { error: err.message });
    return assessments;
  }
}

export async function refreshMonsoonCache(): Promise<RiskAssessment[]> {
  logInfo("[MonsoonService] Refreshing monsoon cache...");
  return calculateCurrentRisk();
}

export async function getCachedMonsoonRisk(): Promise<RiskAssessment[]> {
  try {
    const raw = await fs.readFile(CACHE_MONSOON, "utf-8");
    return JSON.parse(raw);
  } catch {
    logInfo("[MonsoonService] No cached monsoon risk found.");
    return [];
  }
}

export const monsoonService = {
  calculateCurrentRisk,
  refreshMonsoonCache,
  getCachedMonsoonRisk,
};
