// backend/src/services/tripPlannerService.ts
import { getCachedRoads } from "./roadService.js";
import { getCachedMonsoonRisk } from "./monsoonService.js";
import { getWeather } from "./weatherService.js";
import { getDistrictMapping } from "./highwayService.js";
import { logInfo, logError } from "@logs/logs.js";

interface TripSegment {
  roadRefNo: string;
  roadName: string;
  status: "clear" | "blocked" | "one-way" | "unknown";
  district: string;
  province: string;
  division: string;
  lengthKm: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  weather?: string;
}

interface TripPlan {
  destination: string;
  destinationCoords?: { lat: number; lng: number };
  totalDistanceKm: number;
  estimatedHours: number;
  roadSegments: TripSegment[];
  warnings: string[];
  monsoonRiskAreas: string[];
  divisionContacts: { division: string; phone?: string }[];
  weatherAtDestination: any;
  hasBlockedSections: boolean;
}

const DIVISION_CONTACTS: Record<string, string> = {
  "Kathmandu": "01-4337845",
  "Hetauda": "055-520234",
  "Bharatpur": "056-520234",
  "Lahan": "023-520234",
  "Nepalgunj": "083-520234",
  "Surkhet": "083-520234",
  "Dhangadhi": "091-520234",
};

/**
 * Smart trip planner - one input destination
 * Returns full trip information for traveling to a destination
 */
export async function planTrip(destination: string, userLocation?: { lat: number; lng: number }): Promise<TripPlan | null> {
  logInfo(`[TripPlanner] Planning trip to: ${destination}`);
  
  try {
    // 1. Get all cached road data
    const roadData = await getCachedRoads();
    const monsoonRisks = await getCachedMonsoonRisk();
    const districtMapping = await getDistrictMapping();
    
    if (!roadData?.merged) {
      throw new Error("Road data not available");
    }
    
    // 2. Find destination in our data
    const destFeature = findDestination(destination, roadData.merged);
    
    // 3. Build trip segments along route
    const segments: TripSegment[] = [];
    const warnings: string[] = [];
    const monsoonRiskAreas: string[] = [];
    const divisions = new Set<string>();
    
    // Get segments near the route (simplified - in production would use routing API)
    roadData.merged.forEach((f: any) => {
      const props = f.properties;
      if (!props?.road_refno) return;
      
      // Check monsoon risk
      const risk = monsoonRisks.find(r => 
        r.roadId === props.id || r.roadId === props.road_refno
      );
      if (risk) {
        if (["HIGH", "EXTREME"].includes(risk.riskLevel)) {
          monsoonRiskAreas.push(`${props.road_refno} in ${props.dist_name}`);
          warnings.push(`⚠️ High monsoon risk on ${props.road_refno} near ${props.dist_name}`);
        }
      }
      
      // Check road status
      const status = props.status;
      if (status === "Blocked" || status === "blocked") {
        warnings.push(`🚧 Road ${props.road_refno} is BLOCKED near ${props.dist_name}`);
      } else if (status === "One-Lane") {
        warnings.push(`⚠️ One-lane section on ${props.road_refno} near ${props.dist_name}`);
      }
      
      // Get province
      const province = districtMapping[props.dist_name] || props.province || "";
      
      segments.push({
        roadRefNo: props.road_refno,
        roadName: props.road_name || props.road_refno,
        status: mapStatus(status),
        district: props.dist_name || "",
        province: province,
        division: props.div_name || "",
        lengthKm: props.link_len || 0,
        riskLevel: risk?.riskLevel,
      });
      
      if (props.div_name) divisions.add(props.div_name);
    });
    
    // 4. Get weather at destination
    let weatherAtDestination = null;
    if (destFeature?.geometry?.coordinates) {
      const coords = destFeature.geometry.type === "Point" 
        ? destFeature.geometry.coordinates
        : destFeature.geometry.coordinates[0]?.[0] || destFeature.geometry.coordinates[0]?.[0];
      if (coords) {
        try {
          weatherAtDestination = await getWeather(coords[1], coords[0]);
        } catch { /* Weather unavailable */ }
      }
    }
    
    // 5. Calculate totals
    const totalDistanceKm = segments.reduce((sum, s) => sum + s.lengthKm, 0);
    const hasBlocked = warnings.some(w => w.includes("BLOCKED"));
    
    // Speed based on road conditions (km/h)
    const baseSpeed = hasBlocked ? 30 : 40; // Lower if blocked sections
    const estimatedHours = totalDistanceKm / baseSpeed;
    
    return {
      destination,
      destinationCoords: destFeature ? getCoords(destFeature) : undefined,
      totalDistanceKm: Math.round(totalDistanceKm),
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      roadSegments: segments.slice(0, 50), // Limit
      warnings,
      monsoonRiskAreas,
      divisionContacts: Array.from(divisions).map(d => ({
        division: d,
        phone: DIVISION_CONTACTS[d] || ""
      })),
      weatherAtDestination,
      hasBlockedSections: hasBlocked,
    };
    
  } catch (err: any) {
    logError("[TripPlanner] Failed to plan trip", err.message);
    return null;
  }
}

/**
 * Quick road status check for a destination
 */
export async function checkRoadStatus(destination: string): Promise<{
  destination: string;
  status: "clear" | "has_issues" | "blocked";
  issues: string[];
  monsoonRisk: "low" | "medium" | "high" | "extreme";
  weather: any;
}> {
  const trip = await planTrip(destination);
  
  if (!trip) {
    return {
      destination,
      status: "has_issues",
      issues: ["Unable to fetch road status"],
      monsoonRisk: "low",
      weather: null
    };
  }
  
  const riskLevel = trip.monsoonRiskAreas.length > 2 ? "high" 
    : trip.monsoonRiskAreas.length > 0 ? "medium" 
    : "low";
  
  return {
    destination,
    status: trip.hasBlockedSections ? "blocked" 
      : trip.warnings.length > 0 ? "has_issues" 
      : "clear",
    issues: trip.warnings,
    monsoonRisk: riskLevel as any,
    weather: trip.weatherAtDestination,
  };
}

function findDestination(dest: string, features: any[]): any | null {
  const normDest = dest.toLowerCase();
  
  // 1. Exact match local body
  const localMatch = features.find(f => {
    const props = f.properties;
    return props?.FIRST_GaPa?.toLowerCase() === normDest ||
           props?.GNP?.toLowerCase() === normDest ||
           props?.dist_name?.toLowerCase() === normDest;
  });
  if (localMatch) return localMatch;
  
  // 2. Highway route match
  const hwMatch = features.find(f => {
    const props = f.properties;
    return props?.road_name?.toLowerCase().includes(normDest) ||
           props?.road_refno?.toLowerCase().includes(normDest);
  });
  if (hwMatch) return hwMatch;
  
  // 3. Fuzzy match
  return features.find(f => {
    const props = f.properties;
    return props?.dist_name?.toLowerCase().includes(normDest);
  }) || null;
}

function mapStatus(status: string): "clear" | "blocked" | "one-way" | "unknown" {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s.includes("block")) return "blocked";
  if (s.includes("one")) return "one-way";
  if (s.includes("clear")) return "clear";
  return "unknown";
}

function getCoords(feature: any): { lat: number; lng: number } | null {
  if (!feature?.geometry?.coordinates) return null;
  
  let coords: any;
  if (feature.geometry.type === "Point") {
    coords = feature.geometry.coordinates;
  } else if (feature.geometry.type === "LineString") {
    coords = feature.geometry.coordinates[0];
  } else if (feature.geometry.type === "MultiLineString") {
    coords = feature.geometry.coordinates[0]?.[0];
  }
  
  if (!coords || coords.length < 2) return null;
  return { lat: coords[1], lng: coords[0] };
}