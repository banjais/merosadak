import fs from "fs/promises";
import { getHighwayList, getHighwayGeoJSONRaw } from "@/services/highwayService.js";
import * as weatherService from "@/services/weatherService.js";
import { CACHE_DIR, CACHE_MONSOON } from "@/config/paths.js";
import { logInfo, logError } from "@logs/logs.js";
import { resolveLabel } from "@/services/labelUtils.js";
import { isValidNepalCoordinate } from "@/services/geoUtils.js";
import type { RiskLevel, RiskAssessment } from "@/types.js";

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
    const highways = await getHighwayList();
    const BATCH_SIZE = 5;
    logInfo(`[MonsoonService] Calculating risk for ${highways.length} corridors in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < highways.length; i += BATCH_SIZE) {
      const batch = highways.slice(i, i + BATCH_SIZE);

      // 1. Pre-fetch Highway Data for the batch
      const batchHighways = await Promise.all(batch.map(async (h) => ({
        metadata: h,
        geojson: await getHighwayGeoJSONRaw(h.code)
      })));

      // 2. Collect all unique coordinates needing weather data in this batch
      const pointsToFetch: { lat: number; lng: number }[] = [];
      batchHighways.forEach(({ geojson }) => {
        geojson?.features.forEach(feature => {
          const geom = feature.geometry;
          const coords = geom?.type === "Point" ? geom.coordinates :
            geom?.type === "LineString" ? geom.coordinates[0] :
              geom?.type === "MultiLineString" ? geom.coordinates[0]?.[0] : null;
          if (coords && coords.length >= 2) pointsToFetch.push({ lat: coords[1], lng: coords[0] });
        });
      });

      // 3. Unified Batch Weather Fetch (COLLAPSED)
      const weatherMap = await weatherService.getLiveRainfallBatch(pointsToFetch);

      const batchResults = batchHighways.map(({ metadata: h, geojson }) => {
        const highwayAssessments: RiskAssessment[] = [];
        if (!geojson || !geojson.features) return highwayAssessments;

        for (const feature of geojson.features) {
          const props = feature.properties || {};
          const { slope_angle = 0, road_name, road_refno, id } = props;
          let rainIntensity = 0;
          let lat: number | undefined, lon: number | undefined;

          try {
            const geom = feature.geometry;
            if (!geom || !geom.coordinates) continue;

            const coords = geom.type === "Point" ? geom.coordinates :
              geom.type === "LineString" ? geom.coordinates[0] :
                geom.type === "MultiLineString" ? geom.coordinates[0]?.[0] : null;

            if (Array.isArray(coords) && coords.length >= 2) {
              [lon, lat] = coords;
            } else continue;

            // Lookup result from the batch fetch map using the spatial grid key
            const gridKey = `weather:${(lat ?? 0).toFixed(2)}:${(lon ?? 0).toFixed(2)}`;
            const weather = weatherMap.get(gridKey);
            rainIntensity = weather?.intensity || 0;
          } catch (err: any) {
            // Suppress noise
          }

          const { level, reason } = assessRisk(rainIntensity, slope_angle);
          highwayAssessments.push({
            roadId: id || road_refno || resolveLabel(road_name) || h.code,
            roadName: resolveLabel(road_name) || h.name || h.code,
            riskLevel: level as RiskLevel,
            color: getColor(level as RiskLevel),
            reason,
            rainIntensity,
            slopeAngle: slope_angle,
            lat: lat ?? 0,
            lng: lon ?? 0,
          });
        }
        return highwayAssessments;
      });

      batchResults.forEach(res => assessments.push(...res));
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
