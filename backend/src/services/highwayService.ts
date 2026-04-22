// backend/src/services/highwayService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "@/config/paths.js";
import { logError, logInfo } from "@logs/logs.js";
import { DISTRICT_MAPPING } from "@/config/paths.js";
import type { FeatureCollection } from "@/types.js";
import { getCache, clearCache } from "@/services/cacheService.js";
import { ROAD_STATUS } from "@/constants/sheets.js";
import { resolveLabel } from "@/services/labelUtils.js";
import { haversineDistance, calculateBearing, calculateLineStringLength } from "@/services/geoUtils.js";
import { broadcastProgress, broadcastLiveLog } from "./websocketService.js";

const HIGHWAY_DIR = path.join(DATA_DIR, "highway");
const HIGHWAY_INDEX = path.join(HIGHWAY_DIR, "index.json");
const MASTER_HIGHWAY_FILE = path.join(HIGHWAY_DIR, "highways_master.geojson");

let isIndexUpdating = false;
let districtMappingCache: Record<string, string> | null = null;

/**
 * Loads the district-to-province mapping from disk.
 * Returns empty object if file is not found (optional data).
 */
export async function getDistrictMapping(): Promise<Record<string, string>> {
  if (districtMappingCache !== null) return districtMappingCache;
  try {
    const data = await fs.readFile(DISTRICT_MAPPING, "utf-8");
    districtMappingCache = JSON.parse(data);
    return districtMappingCache!;
  } catch {
    districtMappingCache = {};
    return districtMappingCache;
  }
}

// Also check if input matches key (case-insensitive)
export async function getProvincesByDistricts(districts: string[]): Promise<string[]> {
  const provinces = new Set<string>();
  const mapping = await getDistrictMapping();

  for (const d of districts) {
    // Try exact match first, then case-insensitive
    let province = mapping[d];
    if (!province) {
      // Try case-insensitive search
      for (const [dist, prov] of Object.entries(mapping)) {
        if (dist.toLowerCase() === d.toLowerCase()) {
          province = prov;
          break;
        }
      }
    }
    if (province) provinces.add(province);
  }
  return Array.from(provinces).sort();
}

/**
 * Get linked data from multiple sources for a highway - FAST (no incidents)
 */
export async function getHighwayLinkedData(code: string): Promise<any> {
  const normalizedCode = code.toUpperCase();
  try {
    const geojson = await getHighwayByCode(normalizedCode);
    if (!geojson || !geojson.features) return null;

    // Collect unique districts and divisions from highway segments
    const districts = new Set<string>();
    const divisions = new Set<string>();
    const paveTypes = new Set<string>();
    const years: number[] = [];
    const segmentLengths: number[] = [];

    for (const f of geojson.features) {
      const props: any = f.properties || {};
      if (props.dist_name) districts.add(String(props.dist_name));
      if (props.div_name) divisions.add(String(props.div_name));
      if (props.pave_type) paveTypes.add(String(props.pave_type));
      if (props.dyear) {
        const yr = parseInt(String(props.dyear));
        if (!isNaN(yr)) years.push(yr);
      }
      if (props.link_len) {
        const len = parseFloat(String(props.link_len));
        if (!isNaN(len)) segmentLengths.push(len);
      }
    }

    const districtArray = Array.from(districts).sort();
    const provinceArray = await getProvincesByDistricts(districtArray);

    return {
      highway: { code, name: resolveLabel(geojson.features[0]?.properties?.road_name) || code },
      route: {
        districts: districtArray,
        provinces: provinceArray,
        divisions: Array.from(divisions).sort(),
      },
      segments: {
        total: geojson.features.length,
        totalLengthKm: Math.round(segmentLengths.reduce((a, b) => a + b, 0) * 10) / 10,
        avgConstructionYear: years.length > 0 ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : null,
        pavementTypes: Array.from(paveTypes).sort(),
      },
      linkedSources: {
        nepal: "/api/v1/boundary",
        districts: "/api/v1/boundaries/districts",
        provinces: "/api/v1/boundaries/provinces",
        local: "/api/v1/boundaries/local",
        incidents: `/api/v1/highways/${normalizedCode}/incidents`,
      }
    };
  } catch (err: any) {
    logError("[HighwayService] Failed to get linked data", err.message);
    return null;
  }
}

/**
 * Get incidents for a specific highway - fast endpoint
 */
export async function getHighwayIncidents(code: string, lang: string = "en"): Promise<any> {
  const normalizedCode = code.toUpperCase();
  try {
    // Get highway to know which districts it passes through
    const indexData = await getHighwayList();
    const metadata = indexData.find(h => h.code === normalizedCode);
    if (!metadata) return null;

    const geojson = await getHighwayByCode(normalizedCode);
    if (!geojson) return null;

    // Get road data - only filter by this highway
    const { getCachedRoads } = await import("@/services/roadService.js");
    const roadData = await getCachedRoads();
    const highwayRoads = roadData.merged.filter((r: any) =>
      r.properties?.road_refno === normalizedCode
    );

    // Count by district (from highway segment dist_name)
    const byDistrict: Record<string, any> = {};
    for (const road of highwayRoads) {
      if (road.source === "highway" && road.status !== ROAD_STATUS.RESUMED) {
        const dist = road.properties?.dist_name || "Unknown";
        if (!byDistrict[dist]) byDistrict[dist] = { blocked: 0, oneLane: 0 };
        if (road.status === ROAD_STATUS.BLOCKED) byDistrict[dist].blocked++;
        else if (road.status === ROAD_STATUS.ONE_LANE) byDistrict[dist].oneLane++;
      }
    }

    // Get sheet incidents (any sheet incident for this highway)
    const sheetIncidents = highwayRoads.filter((r: any) => r.source === "sheet" && r.status !== ROAD_STATUS.RESUMED);
    const byDistrictFromSheet: Record<string, any> = {};
    for (const inc of sheetIncidents) {
      const dist = resolveLabel(inc.properties?.incidentDistrict, lang) || "Unknown";
      if (!byDistrictFromSheet[dist]) byDistrictFromSheet[dist] = { blocked: 0, oneLane: 0, places: [] };
      if (inc.status === ROAD_STATUS.BLOCKED) byDistrictFromSheet[dist].blocked++;
      else if (inc.status === ROAD_STATUS.ONE_LANE) byDistrictFromSheet[dist].oneLane++;
      const place = inc.properties?.incidentPlace || inc.properties?.place || "";
      if (place) byDistrictFromSheet[dist].places.push(place);
    }

    const totalBlocked = Object.values(byDistrict).reduce((s: number, d: any) => s + d.blocked, 0);
    const totalOneLane = Object.values(byDistrict).reduce((s: number, d: any) => s + d.oneLane, 0);

    return {
      code: normalizedCode,
      totalActive: totalBlocked + totalOneLane,
      blocked: totalBlocked,
      oneLane: totalOneLane,
      fromSegments: byDistrict,
      fromSheet: byDistrictFromSheet,
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    logError("[HighwayService] Failed to get incidents", err.message);
    return null;
  }
}

/**
 * Get list of available highways with metadata
 */
export async function getHighwayList(): Promise<Array<{ code: string, file: string, name?: string, districts?: string[], route?: string, provinces?: string[], lengthKm?: number }>> {
  const highways = await getCache("highways:index", async () => {
    try {
      const indexData = JSON.parse(await fs.readFile(HIGHWAY_INDEX, "utf-8"));
      return indexData;
    } catch (err: any) {
      logError("[HighwayService] Failed to load highway index", err.message);
      return [];
    }
  }, 86400);

  // Check for missing lengths and trigger background update if needed
  if (highways.length > 0 && highways.some(h => h.lengthKm === undefined || h.lengthKm === null)) {
    if (!isIndexUpdating) {
      logInfo("[HighwayService] Missing highway lengths detected. Performing synchronous index update...");
      await updateHighwayIndexLengths();
      // Return the fresh data from disk/cache after update
      return getHighwayList();
    } else {
      // If an update is already in progress, we return current data to avoid deadlocks,
      // but the next request will see the completed lengths.
      return highways;
    }
  }

  return highways;
}

/**
 * Get the Master GeoJSON containing all highways in a single file
 * Optimized for the main map overview
 */
export async function getHighwayMasterGeoJSON(): Promise<FeatureCollection | null> {
  return getCache("highways:master_geojson", async () => {
    try {
      const data = await fs.readFile(MASTER_HIGHWAY_FILE, "utf-8");
      return JSON.parse(data);
    } catch (err: any) {
      logError("[HighwayService] Master GeoJSON not found or invalid", err.message);
      // Fallback: We could theoretically aggregate all 79 files here, but that's expensive
      return null;
    }
  }, 86400);
}

/**
 * Reads a highway GeoJSON file directly from disk without using the L1/Redis cache.
 * Use this for bulk processing or background tasks to avoid heap exhaustion.
 */
export async function getHighwayGeoJSONRaw(code: string): Promise<FeatureCollection | null> {
  const normalizedCode = code.toUpperCase();
  try {
    const indexData = await getHighwayList();
    const highwayEntry = indexData.find(h => h.code === normalizedCode);

    if (!highwayEntry) return null;

    const filePath = path.join(HIGHWAY_DIR, highwayEntry.file);
    const geojsonData = JSON.parse(await fs.readFile(filePath, "utf-8")) as FeatureCollection;
    return geojsonData;
  } catch (err: any) {
    logError("[HighwayService] Raw load failed", {
      code: normalizedCode,
      error: err.message
    });
    return null;
  }
}

/**
 * Get specific highway geojson by code
 */
export async function getHighwayByCode(code: string): Promise<FeatureCollection | null> {
  const normalizedCode = code.toUpperCase();

  return getCache(`highways:geojson:${normalizedCode}`, async () => {
    try {
      // Load index to find the file
      const indexData = await getHighwayList();
      const highwayEntry = indexData.find(h => h.code === normalizedCode);

      if (!highwayEntry) {
        logInfo(`[HighwayService] Highway ${normalizedCode} not found in index`);
        return null;
      }

      const filePath = path.join(HIGHWAY_DIR, highwayEntry.file);

      // Load the geojson file
      const geojsonData = JSON.parse(await fs.readFile(filePath, "utf-8")) as FeatureCollection;

      // Add code to properties for consistency
      if (geojsonData.features) {
        geojsonData.features.forEach(feature => {
          if (feature.properties) {
            feature.properties.highway_code = normalizedCode;
            feature.properties.road_refno = normalizedCode;
          }
        });
      }

      logInfo(`[HighwayService] Loaded highway ${normalizedCode} from ${highwayEntry.file}`);
      return geojsonData;
    } catch (err: any) {
      logError("[HighwayService] Failed to load highway by code", {
        code: normalizedCode,
        error: err.message
      });
      return null;
    }
  }, 86400);
}

/**
 * Get highway metadata for a given code
 */
export async function getHighwayMetadata(code: string): Promise<{ code: string, file: string, name?: string, districts?: string[], route?: string, provinces?: string[], lengthKm?: number } | null> {
  const highways = await getHighwayList();
  return highways.find(h => h.code === code.toUpperCase()) || null;
}

/**
 * Calculate highway length from GeoJSON coordinates (in km)
 */
function calculateHighwayLength(geojson: FeatureCollection): number {
  let totalLength = 0;

  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    if (geom.type === 'LineString') {
      totalLength += calculateLineStringLength(geom.coordinates);
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        totalLength += calculateLineStringLength(line);
      }
    }
  }

  return Math.round(totalLength * 100) / 100; // Round to 2 decimal places
}

/**
 * Get comprehensive highway statistics and report
 */
export async function getHighwayReport(code: string, lang: string = "en"): Promise<any> {
  const normalizedCode = code.toUpperCase();
  // Separate infrastructure data (cached) from incident data (live)
  const infraData = await getCache(`highways:infra:${normalizedCode}`, async () => {
    const metadata = await getHighwayMetadata(normalizedCode);
    if (!metadata) return null;

    const geojson = await getHighwayByCode(normalizedCode);
    if (!geojson || !geojson.features) return null;

    const lengthKm = calculateHighwayLength(geojson);
    let pavementStats = { blacktopped: 0, gravel: 0, earthen: 0, unknown: 0, byType: {} as Record<string, number> };
    let conditionStats = { good: 0, fair: 0, poor: 0, unknown: 0 };
    let widthStats = { single_lane: 0, two_lane: 0, four_lane: 0, unknown: 0 };
    let totalSegments = 0;

    const uniqueDivisions = new Set<string>();
    const paveTypes = new Set<string>();
    const years: number[] = [];
    const segmentLengths: number[] = [];

    const baseLimit = metadata.code.startsWith('NH') ? 80 : 60;

    for (const feature of (geojson.features as any[])) {
      const props: any = feature.properties || {};
      totalSegments++;

      // Analyze curvature for THIS specific segment
      const segmentSpeed = calculateSegmentCurvatureSpeed(feature, baseLimit);
      props.suggested_speed = segmentSpeed;
      props.danger_zone = segmentSpeed <= 20;

      if (props.div_name) uniqueDivisions.add(String(props.div_name));
      if (props.pave_type) paveTypes.add(String(props.pave_type));
      if (props.dyear) {
        const yr = parseInt(String(props.dyear));
        if (!isNaN(yr)) years.push(yr);
      }
      if (props.link_len) {
        const len = parseFloat(String(props.link_len));
        if (!isNaN(len)) segmentLengths.push(len);
      }

      const paveType = String(props.pave_type || props.surface || 'Unknown');
      pavementStats.byType[paveType] = (pavementStats.byType[paveType] || 0) + 1;

      if (paveType.toLowerCase().match(/asphalt|bitumen|blacktop/)) pavementStats.blacktopped++;
      else if (paveType.toLowerCase().match(/gravel|wbm/)) pavementStats.gravel++;
      else if (paveType.toLowerCase().match(/earth|unpaved/)) pavementStats.earthen++;

      const lanes = props.no_lanes || props.lanes || 0;
      if (lanes == 1) widthStats.single_lane++;
      else if (lanes == 2) widthStats.two_lane++;
      else if (lanes >= 4) widthStats.four_lane++;

      if (paveType.toLowerCase().match(/asphalt|bitumen|blacktop/)) conditionStats.good++;
      else if (paveType.toLowerCase().match(/gravel|wbm/)) conditionStats.fair++;
      else conditionStats.poor++;
    }

    const qualityScore = totalSegments > 0 ? Math.round(
      (pavementStats.blacktopped / totalSegments) * 40 +
      (conditionStats.good / totalSegments) * 40 +
      (widthStats.two_lane / totalSegments) * 20
    ) : 0;

    // Get the global suggested speed (10th percentile to avoid outlier fluctuations)
    const allSpeeds = geojson.features.map((f: any) => f.properties?.suggested_speed || baseLimit).sort((a, b) => a - b);
    const globalSuggestedSpeed = allSpeeds[Math.floor(allSpeeds.length * 0.1)] || baseLimit;

    return {
      metadata,
      lengthKm,
      totalSegments,
      avgYear: years.length > 0 ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : null,
      totalSegmentLength: segmentLengths.reduce((a, b) => a + b, 0),
      pavementStats,
      conditionStats,
      widthStats,
      uniqueDivisions: Array.from(uniqueDivisions),
      paveTypes: Array.from(paveTypes),
      qualityScore,
      speedLimit: globalSuggestedSpeed
    };
  }, 86400); // Cache infra for 24h

  if (!infraData) return { error: 'Highway not found' };

  // Fetch REAL-TIME incident data (Never cached in this scope)
  try {
    const { getCachedRoads } = await import("@/services/roadService.js");
    const roadData = await getCachedRoads();
    const highwayNameBase = resolveLabel(infraData.metadata.name, "en").toLowerCase();

    const incidents = roadData.merged.filter((f: any) => {
      const props = f.properties || {};
      return props.road_refno === normalizedCode ||
        (highwayNameBase && resolveLabel(props.road_name, "en").toLowerCase().includes(highwayNameBase));
    });

    const incidentStats = {
      blocked: incidents.filter((f: any) => f.properties?.status === ROAD_STATUS.BLOCKED).length,
      one_lane: incidents.filter((f: any) => f.properties?.status === ROAD_STATUS.ONE_LANE).length,
      resumed: incidents.filter((f: any) => f.properties?.status === ROAD_STATUS.RESUMED).length,
      hasBlockedSections: incidents.some((f: any) => f.properties?.status === ROAD_STATUS.BLOCKED)
    };

    const speedLimit = infraData.speedLimit;

    const { monsoonService } = await import("@/services/monsoonService.js");
    const monsoonRisks = await monsoonService.getCachedMonsoonRisk();
    const highwayMonsoonRisks = monsoonRisks.filter((r: any) => {
      const highwayName = infraData.metadata.name?.toLowerCase();
      return r.roadId === normalizedCode || (highwayName && r.roadName?.toLowerCase().includes(highwayName));
    });

    return {
      code: normalizedCode,
      name: resolveLabel(infraData.metadata.name, lang),
      route: resolveLabel(infraData.metadata.route, lang),
      provinces: infraData.metadata.provinces || await getProvincesByDistricts(infraData.metadata.districts || []),
      districts: infraData.metadata.districts,
      lengthKm: Math.round(infraData.lengthKm * 10) / 10,
      totalSegments: infraData.totalSegments,
      avgConstructionYear: infraData.avgYear,
      pavementStats: {
        ...infraData.pavementStats,
        types: Object.fromEntries(infraData.paveTypes.map(t => [t, infraData.pavementStats.byType[t] || 0])),
      },
      conditionStats: infraData.conditionStats,
      incidentStats,
      speedLimit,
      alternatives: incidentStats.hasBlockedSections ? await suggestAlternativeRoutes(infraData.metadata.districts?.[0] || '', infraData.metadata.districts?.slice(-1)[0] || '', lang) : [],
      monsoonRisks: highwayMonsoonRisks.length,
      qualityScore: infraData.qualityScore,
      qualityGrade: infraData.qualityScore >= 80 ? 'A' : infraData.qualityScore >= 60 ? 'B' : infraData.qualityScore >= 40 ? 'C' : 'F',
      lastUpdated: new Date().toISOString()
    };
  } catch (err: any) {
    logError("[HighwayService] Real-time merge failed", err.message);
    return { ...infraData, error: 'Real-time data currently unavailable' };
  }
}

/**
 * Analyze a single segment's geometry to suggest a safe speed
 */
function calculateSegmentCurvatureSpeed(feature: any, baseLimit: number): number {
  let minSuggested = baseLimit;

  if (feature.geometry?.type !== 'LineString') return baseLimit;
  const coords = feature.geometry.coordinates;
  if (coords.length < 3) return baseLimit;

  for (let i = 1; i < coords.length - 1; i++) {
    const p1 = coords[i - 1];
    const p2 = coords[i];
    const p3 = coords[i + 1];

    // Calculate bearing between consecutive points
    const b1 = calculateBearing(p1[1], p1[0], p2[1], p2[0]);
    const b2 = calculateBearing(p2[1], p2[0], p3[1], p3[0]);

    let diff = Math.abs(b1 - b2);
    if (diff > 180) diff = 360 - diff;

    // Calculate the distance over which this turn occurs (in km)
    const turnLength = haversineDistance(p1[1], p1[0], p2[1], p2[0]) + haversineDistance(p2[1], p2[0], p3[1], p3[0]);

    // Calculate Curvature Intensity (Degrees of deflection per 100 meters)
    // This ensures that a 20-degree bend over 500m isn't treated as dangerous, 
    // but a 20-degree bend over 50m (a tight hairpin) triggers a major slowdown.
    const intensity = turnLength > 0 ? (diff / (turnLength * 10)) : 0;

    // Adjust speed based on intensity (deflection magnitude / distance)
    if (intensity > 50 || diff > 45) minSuggested = Math.min(minSuggested, 20); // Hairpin/Switchback
    else if (intensity > 25 || diff > 30) minSuggested = Math.min(minSuggested, 40); // Sharp turn
    else if (intensity > 10 || diff > 15) minSuggested = Math.min(minSuggested, 60); // Moderate curve
  }

  return minSuggested;
}

/**
 * Get all highways with basic statistics (for comparison)
 */
export async function getAllHighwaysSummary(lang: string = "en"): Promise<any[]> {
  try {
    const highways = await getHighwayList();
    const summaries = [];

    for (const highway of highways.slice(0, 20)) { // Limit to first 20 for performance
      try {
        const report = await getHighwayReport(highway.code, lang);
        if (!report.error) {
          summaries.push(report);
        }
      } catch (err: any) {
        logError(`[HighwayService] Failed to get report for ${highway.code}`, err.message);
        // Skip if individual highway fails
      }
    }

    return summaries.sort((a, b) => b.qualityScore - a.qualityScore);

  } catch (err: any) {
    logError("[HighwayService] Failed to get highways summary", err.message);
    return [];
  }
}

/**
 * Suggest alternative routes based on road quality and current conditions
 */
export async function suggestAlternativeRoutes(fromDistrict: string, toDistrict: string, lang: string = "en"): Promise<any[]> {
  try {
    const highways = await getHighwayList();
    const alternatives = [];

    // Find highways that pass through both districts
    for (const highway of highways) {
      const districts = highway.districts || [];
      if (districts.includes(fromDistrict) && districts.includes(toDistrict)) {
        try {
          const report = await getHighwayReport(highway.code, lang);
          if (!report.error) {
            alternatives.push({
              code: highway.code,
              name: resolveLabel(highway.name, lang),
              route: resolveLabel(highway.route, lang),
              qualityScore: report.qualityScore,
              qualityGrade: report.qualityGrade,
              lengthKm: report.lengthKm,
              incidents: report.incidentStats.blocked + report.incidentStats.one_lane,
              estimatedDuration: report.lengthKm / 40,
              recommendation: report.qualityScore >= 70 ? 'Recommended' : report.qualityScore >= 40 ? 'Alternative' : 'Avoid if possible'
            });
          }
        } catch (err: any) {
          logError(`[HighwayService] Failed to evaluate ${highway.code} for alternative route`, err.message);
          // Skip if fails
        }
      }
    }

    // Sort by quality score (best first)
    return alternatives.sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 3);

  } catch (err: any) {
    logError("[HighwayService] Failed to suggest alternatives", err.message);
    return [];
  }
}

/**
 * Maintenance function to calculate and save highway lengths back to index.json.
 * This enables efficient client-side sorting without loading full GeoJSON.
 */
export async function updateHighwayIndexLengths(onProgress?: (pct: number) => void): Promise<void> {
  if (isIndexUpdating) return;
  isIndexUpdating = true;

  try {
    logInfo("[HighwayService] Starting highway index length calculation...");
    const indexData = JSON.parse(await fs.readFile(HIGHWAY_INDEX, "utf-8"));
    const total = indexData.length;

    const updatedIndex = [];
    for (let i = 0; i < total; i++) {
      const entry = indexData[i];
      try {
        const geojson = await getHighwayGeoJSONRaw(entry.code);
        if (geojson) {
          entry.lengthKm = calculateHighwayLength(geojson);
        } else {
          entry.lengthKm = 0; // Mark as processed even if file is missing to stop the loop
        }
      } catch (e) {
        logError(`[HighwayService] Length calc failed for ${entry.code}`, (e as any).message);
      }
      updatedIndex.push(entry);

      // Calculate and trigger progress
      const pct = Math.round(((i + 1) / total) * 100);
      if (onProgress) onProgress(pct);

      // Broadcast to WebSocket every 5 segments to avoid flooding
      if (i % 5 === 0 || i === total - 1) {
        broadcastProgress(`Calculating highway lengths: ${entry.code}`, pct);
      }
    }

    await fs.writeFile(HIGHWAY_INDEX, JSON.stringify(updatedIndex, null, 2), "utf-8");

    // Invalidate the cache so getHighwayList picks up the new data with lengths
    await clearCache("highways:index");

    logInfo("[HighwayService] Successfully updated highway index with calculated lengths");
  } catch (err: any) {
    logError("[HighwayService] Failed to update highway index lengths", err.message);
  } finally {
    isIndexUpdating = false;
  }
}

/**
 * Pre-warm the cache for major highways on startup.
 * Focuses on National Highways (NH) to ensure fast initial reporting for key infrastructure.
 */
export async function prewarmHighwayCache(): Promise<void> {
  logInfo("[HighwayService] Initializing cache warming for major highways...");
  try {
    // Optionally update index lengths if they are missing
    const highways = await getHighwayList();
    // Filter for National Highways which are the highest priority for regional analytics
    const majorHighways = highways.filter(h => h.code.toUpperCase().startsWith('NH'));

    logInfo(`[HighwayService] Pre-calculating reports for ${majorHighways.length} National Highways`);

    // Sequential processing to avoid massive concurrent disk/API load on startup
    for (const highway of majorHighways) {
      try {
        await getHighwayReport(highway.code);
      } catch (err: any) {
        logError(`[HighwayService] Warming failed for ${highway.code}`, err.message);
      }
    }
    logInfo("[HighwayService] Cache warming sequence completed successfully");
  } catch (err: any) {
    logError("[HighwayService] Critical failure during cache warming", err.message);
  }
}

/**
 * Extracts major junctions (start/end nodes of segments) from highway GeoJSON.
 * These points are ideal for POI sampling as they represent intersections or key nodes.
 */
export function getMajorJunctions(geojson: FeatureCollection): { lat: number, lng: number }[] {
  const seen = new Set<string>();
  const junctions: { lat: number, lng: number }[] = [];

  geojson.features.forEach(feature => {
    const geom = feature.geometry;
    if (geom?.type === "LineString") {
      const coords = geom.coordinates;
      // Take the start and end of each segment
      [coords[0], coords[coords.length - 1]].forEach(p => {
        const key = `${p[1].toFixed(5)},${p[0].toFixed(5)}`;
        if (!seen.has(key)) {
          seen.add(key);
          junctions.push({ lat: p[1], lng: p[0] });
        }
      });
    }
  });
  return junctions;
}
