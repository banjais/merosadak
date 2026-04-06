// backend/src/services/highwayService.ts
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config/paths.js";
import { logError, logInfo } from "../logs/logs.js";
import type { FeatureCollection } from "../types.js";
import { getCachedRoads } from "./roadService.js";
import { getCachedMonsoonRisk } from "./monsoonService.js";

const HIGHWAY_DIR = path.join(DATA_DIR, "highway");
const HIGHWAY_INDEX = path.join(HIGHWAY_DIR, "index.json");

/**
 * Get list of available highways with metadata
 */
export async function getHighwayList(): Promise<Array<{code: string, file: string, name?: string}>> {
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
  try {
    // Load index to find the file
    const indexData = await getHighwayList();
    const highwayEntry = indexData.find(h => h.code === code);

    if (!highwayEntry) {
      logInfo(`[HighwayService] Highway ${code} not found in index`);
      return null;
    }

    const filePath = path.join(HIGHWAY_DIR, highwayEntry.file);

    // Load the geojson file
    const geojsonData = JSON.parse(await fs.readFile(filePath, "utf-8")) as FeatureCollection;

    // Add code to properties for consistency
    if (geojsonData.features) {
      geojsonData.features.forEach(feature => {
        if (feature.properties) {
          feature.properties.highway_code = code;
        }
      });
    }

    logInfo(`[HighwayService] Loaded highway ${code} from ${highwayEntry.file}`);
    return geojsonData;

  } catch (err: any) {
    logError("[HighwayService] Failed to load highway by code", {
      code,
      error: err.message
    });
    return null;
  }
}

/**
 * Get highway metadata for a given code
 */
export async function getHighwayMetadata(code: string): Promise<{code: string, file: string, name?: string} | null> {
  const highways = await getHighwayList();
  return highways.find(h => h.code === code) || null;
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
  try {
    const metadata = await getHighwayMetadata(code);
    if (!metadata) {
      return { error: 'Highway not found' };
    }
    
    const geojson = await getHighwayByCode(code);
    if (!geojson || !geojson.features) {
      return { error: 'Highway data not available' };
    }
    
    // Calculate length
    const lengthKm = calculateHighwayLength(geojson);
    
    // Count districts
    const districts = metadata.districts || [];
    const districtCount = districts.length;
    
    // Analyze road conditions from features
    let pavementStats = { blacktopped: 0, gravel: 0, earthen: 0, unknown: 0 };
    let conditionStats = { good: 0, fair: 0, poor: 0, unknown: 0 };
    let widthStats = { single_lane: 0, two_lane: 0, four_lane: 0, unknown: 0 };
    let totalSegments = 0;
    
    for (const feature of geojson.features) {
      const props = feature.properties || {};
      totalSegments++;
      
      // Pavement type
      const surface = (props.surface || props.pavement || '').toLowerCase();
      if (surface.includes('asphalt') || surface.includes('blacktopped') || surface.includes('paved')) {
        pavementStats.blacktopped++;
      } else if (surface.includes('gravel') || surface.includes('unpaved')) {
        pavementStats.gravel++;
      } else if (surface.includes('earth') || surface.includes('dirt')) {
        pavementStats.earthen++;
      } else {
        pavementStats.unknown++;
      }
      
      // Condition
      const condition = (props.condition || props.road_condition || '').toLowerCase();
      if (condition.includes('good') || condition.includes('excellent')) {
        conditionStats.good++;
      } else if (condition.includes('fair') || condition.includes('average')) {
        conditionStats.fair++;
      } else if (condition.includes('poor') || condition.includes('bad')) {
        conditionStats.poor++;
      } else {
        conditionStats.unknown++;
      }
      
      // Width/Lanes
      const lanes = props.lanes || props.width || '';
      if (lanes === 1 || (typeof lanes === 'string' && lanes.includes('single'))) {
        widthStats.single_lane++;
      } else if (lanes === 2 || (typeof lanes === 'string' && lanes.includes('two'))) {
        widthStats.two_lane++;
      } else if (lanes >= 4 || (typeof lanes === 'string' && lanes.includes('four'))) {
        widthStats.four_lane++;
      } else {
        widthStats.unknown++;
      }
    }
    
    // Get real-time incidents for this highway
    const roadData = await getCachedRoads();
    const incidents = roadData.merged.filter((f: any) => {
      const props = f.properties || {};
      return props.road_refno === code || 
             (props.road_name && props.road_name.toLowerCase().includes(metadata.name?.toLowerCase() || ''));
    });
    
    const incidentStats = {
      blocked: incidents.filter((f: any) => f.properties?.status === 'Blocked').length,
      one_lane: incidents.filter((f: any) => f.properties?.status === 'One-Lane').length,
      resumed: incidents.filter((f: any) => f.properties?.status === 'Resumed').length,
    };
    
    // Get monsoon risk for this highway
    const monsoonRisks = await getCachedMonsoonRisk();
    const highwayMonsoonRisks = monsoonRisks.filter((r: any) => 
      r.roadId === code || r.roadName?.toLowerCase().includes(metadata.name?.toLowerCase() || '')
    );
    
    // Calculate quality score (0-100)
    const qualityScore = Math.round(
      (pavementStats.blacktopped / totalSegments) * 40 +
      (conditionStats.good / totalSegments) * 40 +
      (widthStats.two_lane / totalSegments) * 20
    );
    
    return {
      code: metadata.code,
      name: metadata.name,
      route: metadata.route,
      districts: districts,
      districtCount: districtCount,
      lengthKm: lengthKm,
      totalSegments: totalSegments,
      pavementStats,
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
      } catch {
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
        } catch {
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
