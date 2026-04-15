// backend/src/services/highwayService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import { logError, logInfo } from "../logs/logs.js";
import type { FeatureCollection } from "../types.js";
import { getCachedRoads } from "./roadService.js";
import { getCachedMonsoonRisk } from "./monsoonService.js";
import { ROAD_STATUS } from "../constants/sheets.js";

const HIGHWAY_DIR = path.join(DATA_DIR, "highway");
const HIGHWAY_INDEX = path.join(HIGHWAY_DIR, "index.json");

// District to Province mapping (from Nepal government data)
const DISTRICT_TO_PROVINCE: Record<string, string> = {
  // Province 1
  "Jhapa": "Province 1", "Morang": "Province 1", "Sunsari": "Province 1", "Dhankuta": "Province 1",
  "Terhathum": "Province 1", "Sankhuwasabha": "Province 1", "Bhojpur": "Province 1", "Khotang": "Province 1",
  "Okhaldhunga": "Province 1", "Solukhumbu": "Province 1", "Ilam": "Province 1", "Panchthar": "Province 1",
  "Taplejung": "Province 1", "Udayapur": "Province 1",
  // Province 2
  "Saptari": "Province 2", "Siraha": "Province 2", "Dhanusha": "Province 2", "Mahottari": "Province 2",
  "Sarlahi": "Province 2", "Bara": "Province 2", "Parsa": "Province 2", "Rautahat": "Province 2",
  // Province 3 (Bagmati)
  "Chitwan": "Province 3", "Makwanpur": "Province 3", "Dhading": "Province 3", "Nuwakot": "Province 3",
  "Rasuwa": "Province 3", "Kathmandu": "Province 3", "Lalitpur": "Province 3", "Bhaktapur": "Province 3",
  "Sindhuli": "Province 3", "Ramechhap": "Province 3", "Dolakha": "Province 3", "Kavrepalanchok": "Province 3",
  "Sindhupalchok": "Province 3",
  // Province 4 (Gandaki)
  "Gorkha": "Province 4", "Manang": "Province 4", "Mustang": "Province 4", "Myagdi": "Province 4",
  "Kaski": "Province 4", "Lamjung": "Province 4", "Tanahu": "Province 4", "Nawalpur": "Province 4",
  "Parbat": "Province 4", "Baglung": "Province 4", "Syangja": "Province 4",
  // Province 5 (Lumbini)
  "Pyuthan": "Province 5", "Rolpa": "Province 5", "Rukum East": "Province 5",
  "Dang": "Province 5", "Banke": "Province 5", "Bardiya": "Province 5", "Kapilvastu": "Province 5",
  "Rupandehi": "Province 5", "Palpa": "Province 5", "Gulmi": "Province 5", "Arghakhanchi": "Province 5",
  "Parasi": "Province 5",
  // Province 6 (Karnali)
  "Dolpa": "Province 6", "Mugu": "Province 6", "Jumla": "Province 6", "Kalikot": "Province 6",
  "Dailekh": "Province 6", "Jajarkot": "Province 6", "Surkhet": "Province 6", "Salyan": "Province 6",
  "Humla": "Province 6", "Rukum West": "Province 6",
  // Province 7 (Sudurpashchim)
  "Bajura": "Province 7", "Bajhang": "Province 7", "Darchula": "Province 7", "Kanchanpur": "Province 7",
  "Kailali": "Province 7", "Doti": "Province 7", "Achham": "Province 7", "Dadeldhura": "Province 7",
  "Baitadi": "Province 7",
};

// Also check if input matches key (case-insensitive)
function getProvincesByDistricts(districts: string[]): string[] {
  const provinces = new Set<string>();
  for (const d of districts) {
    // Try exact match first, then case-insensitive
    let province = DISTRICT_TO_PROVINCE[d];
    if (!province) {
      // Try case-insensitive search
      for (const [dist, prov] of Object.entries(DISTRICT_TO_PROVINCE)) {
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
    const provinceArray = getProvincesByDistricts(districtArray);

    return {
      highway: { code, name: geojson.features[0]?.properties?.road_name || code },
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
export async function getHighwayIncidents(code: string): Promise<any> {
  const normalizedCode = code.toUpperCase();
  try {
    // Get highway to know which districts it passes through
    const indexData = await getHighwayList();
    const metadata = indexData.find(h => h.code === normalizedCode);
    if (!metadata) return null;

    const highwayFile = path.join(HIGHWAY_DIR, metadata.file);
    const geojson: FeatureCollection = JSON.parse(await fs.readFile(highwayFile, "utf-8"));

    // Get road data - only filter by this highway
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
      const dist = inc.properties?.incidentDistrict || "Unknown";
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
export async function getHighwayList(): Promise<Array<{ code: string, file: string, name?: string, districts?: string[], route?: string, provinces?: string[] }>> {
  try {
    const indexData = JSON.parse(await fs.readFile(HIGHWAY_INDEX, "utf-8"));
    return indexData;
  } catch (err: any) {
    logError("[HighwayService] Failed to load highway index", err.message);
    return [];
  }
}

/**
 * Get specific highway geojson by code
 */
export async function getHighwayByCode(code: string): Promise<FeatureCollection | null> {
  const normalizedCode = code.toUpperCase();
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
}

/**
 * Get highway metadata for a given code
 */
export async function getHighwayMetadata(code: string): Promise<{ code: string, file: string, name?: string, districts?: string[], route?: string, provinces?: string[] } | null> {
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
 * Calculate length of a LineString in kilometers using Haversine formula
 */
function calculateLineStringLength(coordinates: number[][]): number {
  let length = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    length += haversineDistance(lat1, lng1, lat2, lng2);
  }

  return length;
}

/**
 * Haversine distance between two points in kilometers
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get comprehensive highway statistics and report
 */
export async function getHighwayReport(code: string): Promise<any> {
  const normalizedCode = code.toUpperCase();
  try {
    const metadata = await getHighwayMetadata(normalizedCode);
    if (!metadata) {
      return { error: 'Highway not found' };
    }

    const geojson = await getHighwayByCode(normalizedCode);
    if (!geojson || !geojson.features) {
      return { error: 'Highway data not available' };
    }

    // Calculate length
    const lengthKm = calculateHighwayLength(geojson);

    // Count districts
    const districts = metadata.districts || [];
    const districtCount = districts.length;

    // Analyze road conditions from features
    let pavementStats = { blacktopped: 0, gravel: 0, earthen: 0, unknown: 0, byType: {} as Record<string, number> };
    let conditionStats = { good: 0, fair: 0, poor: 0, unknown: 0 };
    let widthStats = { single_lane: 0, two_lane: 0, four_lane: 0, unknown: 0 };
    let totalSegments = 0;

    // Collect unique values
    const uniqueDivisions = new Set<string>();
    const uniqueDistricts = new Set<string>();
    const paveTypes = new Set<string>();
    const years: number[] = [];
    const segmentLengths: number[] = [];

    for (const feature of geojson.features) {
      const props: any = feature.properties || {};
      totalSegments++;

      // Collect unique values
      if (props.div_name) uniqueDivisions.add(String(props.div_name));
      if (props.dist_name) uniqueDistricts.add(String(props.dist_name));
      if (props.pave_type) paveTypes.add(String(props.pave_type));
      if (props.dyear) {
        const yr = parseInt(String(props.dyear));
        if (!isNaN(yr)) years.push(yr);
      }
      if (props.link_len) {
        const len = parseFloat(String(props.link_len));
        if (!isNaN(len)) segmentLengths.push(len);
      }

      // Pavement type
      const paveType = String(props.pave_type || props.surface || props.pavement || 'Unknown');
      pavementStats.byType[paveType] = (pavementStats.byType[paveType] || 0) + 1;

      if (paveType.toLowerCase().includes('asphalt') || paveType.toLowerCase().includes('bitumen') || paveType.toLowerCase().includes('blacktop')) {
        pavementStats.blacktopped++;
      } else if (paveType.toLowerCase().includes('gravel') || paveType.toLowerCase().includes('wbm')) {
        pavementStats.gravel++;
      } else if (paveType.toLowerCase().includes('earth') || paveType.toLowerCase().includes('unpaved')) {
        pavementStats.earthen++;
      } else if (paveType !== 'Unknown') {
        pavementStats.unknown++;
      }

      // Width/Lanes
      const lanes = props.no_lanes || props.lanes || props.for_width || '';
      const lanesNum = typeof lanes === 'string' ? parseFloat(lanes) : lanes;
      if (lanesNum == 1 || (typeof lanes === 'string' && lanes.includes('single'))) {
        widthStats.single_lane++;
      } else if (lanesNum == 2 || lanesNum == 4 || (typeof lanes === 'string' && (lanes.includes('two') || lanes.includes('four')))) {
        widthStats.two_lane++;
      } else if (typeof lanesNum === 'number' && lanesNum >= 4) {
        widthStats.four_lane++;
      } else {
        widthStats.unknown++;
      }

      // Road condition (based on pavement type as proxy)
      if (paveType.toLowerCase().includes('asphalt') || paveType.toLowerCase().includes('bitumen') || paveType.toLowerCase().includes('blacktop')) {
        conditionStats.good++;
      } else if (paveType.toLowerCase().includes('gravel') || paveType.toLowerCase().includes('wbm')) {
        conditionStats.fair++;
      } else if (paveType.toLowerCase().includes('earth') || paveType.toLowerCase().includes('unpaved')) {
        conditionStats.poor++;
      } else {
        conditionStats.unknown++;
      }
    }

    const avgYear = years.length > 0 ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : null;
    const totalSegmentLength = segmentLengths.reduce((a, b) => a + b, 0);

    // Get real-time incidents for this highway
    const roadData = await getCachedRoads();
    const incidents = roadData.merged.filter((f: any) => {
      const props = f.properties || {};
      const highwayName = metadata.name?.toLowerCase();
      return props.road_refno === normalizedCode ||
        (highwayName && props.road_name && props.road_name.toLowerCase().includes(highwayName));
    });

    const incidentStats = {
      blocked: incidents.filter((f: any) => f.properties?.status === ROAD_STATUS.BLOCKED).length,
      one_lane: incidents.filter((f: any) => f.properties?.status === ROAD_STATUS.ONE_LANE).length,
      resumed: incidents.filter((f: any) => f.properties?.status === ROAD_STATUS.RESUMED).length,
    };

    // Get monsoon risk for this highway
    const monsoonRisks = await getCachedMonsoonRisk();
    const highwayMonsoonRisks = monsoonRisks.filter((r: any) => {
      const highwayName = metadata.name?.toLowerCase();
      return r.roadId === normalizedCode || (highwayName && r.roadName?.toLowerCase().includes(highwayName));
    });

    // Calculate quality score (0-100) - guard against division by zero
    const qualityScore = totalSegments > 0 ? Math.round(
      (pavementStats.blacktopped / totalSegments) * 40 +
      (conditionStats.good / totalSegments) * 40 +
      (widthStats.two_lane / totalSegments) * 20
    ) : 0;

    return {
      code: normalizedCode,
      name: metadata.name,
      route: metadata.route,
      startToEnd: metadata.route, // start to end location
      provinces: metadata.provinces || getProvincesByDistricts(districts),
      districts: districts,
      districtCount: districtCount,
      divisions: Array.from(uniqueDivisions),
      lengthKm: Math.round(lengthKm * 10) / 10,
      segmentLengthKm: Math.round(totalSegmentLength * 10) / 10,
      totalSegments: totalSegments,
      avgConstructionYear: avgYear,
      pavementStats: {
        ...pavementStats,
        types: Object.fromEntries(Array.from(paveTypes).map(t => [t, pavementStats.byType[t] || 0])),
      },
      conditionStats,
      widthStats,
      incidentStats,
      monsoonRisks: highwayMonsoonRisks.length,
      qualityScore: Math.min(100, Math.max(0, qualityScore)),
      qualityGrade: qualityScore >= 80 ? 'A' : qualityScore >= 60 ? 'B' : qualityScore >= 40 ? 'C' : qualityScore >= 20 ? 'D' : 'F',
      lastUpdated: new Date().toISOString()
    };

  } catch (err: any) {
    logError("[HighwayService] Failed to generate highway report", err.message);
    return { error: 'Failed to generate report' };
  }
}

/**
 * Get all highways with basic statistics (for comparison)
 */
export async function getAllHighwaysSummary(): Promise<any[]> {
  try {
    const highways = await getHighwayList();
    const summaries = [];

    for (const highway of highways.slice(0, 20)) { // Limit to first 20 for performance
      try {
        const report = await getHighwayReport(highway.code);
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
export async function suggestAlternativeRoutes(fromDistrict: string, toDistrict: string): Promise<any[]> {
  try {
    const highways = await getHighwayList();
    const alternatives = [];

    // Find highways that pass through both districts
    for (const highway of highways) {
      const districts = highway.districts || [];
      if (districts.includes(fromDistrict) && districts.includes(toDistrict)) {
        try {
          const report = await getHighwayReport(highway.code);
          if (!report.error) {
            alternatives.push({
              code: highway.code,
              name: highway.name,
              route: highway.route,
              qualityScore: report.qualityScore,
              qualityGrade: report.qualityGrade,
              lengthKm: report.lengthKm,
              incidents: report.incidentStats.blocked + report.incidentStats.one_lane,
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
