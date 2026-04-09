// backend/src/services/etaService.ts
import { logInfo, logError } from "../logs/logs.js";
import { getCachedRoads } from "./roadService.js";

// ────────────────────────────────
// ETA (Estimated Time of Arrival) Calculation Service
// Calculates realistic ETAs based on road conditions
// ────────────────────────────────

interface Location {
  lat: number;
  lng: number;
  name?: string;
}

interface ETASegment {
  distance: number; // km
  duration: number; // minutes
  roadName: string;
  roadCode: string;
  status: "blocked" | "one-lane" | "clear" | "unknown";
  speed: number; // km/h (adjusted for conditions)
  baseSpeed: number; // km/h (normal speed)
  delayMinutes: number;
}

interface ETAResult {
  origin: Location;
  destination: Location;
  totalDistance: number; // km
  totalDuration: number; // minutes
  segments: ETASegment[];
  conditionAdjusted: boolean;
  reliability: "high" | "medium" | "low";
  alternativeAvailable: boolean;
  warnings: string[];
  calculatedAt: string;
}

/**
 * Haversine distance between two points in km
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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
 * Get speed adjustment factor based on road status
 */
function getStatusSpeedFactor(status: string): number {
  switch (status.toLowerCase()) {
    case "blocked":
      return 0; // Impassable
    case "one-lane":
      return 0.3; // 70% slower
    case "caution":
      return 0.7; // 30% slower
    case "clear":
      return 1.0; // Normal speed
    default:
      return 0.85; // Slight caution
  }
}

/**
 * Get base speed for road type (km/h)
 */
function getBaseSpeedForRoadType(roadCode?: string): number {
  if (!roadCode) return 40; // Default rural road

  // National highways are faster
  if (roadCode.startsWith("NH")) return 60;
  if (roadCode.startsWith("MH")) return 50;
  if (roadCode.startsWith("DH")) return 40;

  return 40;
}

/**
 * Calculate ETA between two points considering road conditions
 */
export async function calculateETA(
  origin: Location,
  destination: Location,
  options?: {
    avoidBlocked?: boolean;
    prioritizeSafety?: boolean;
    vehicleType?: "car" | "motorcycle" | "truck" | "bus";
  }
): Promise<ETAResult | null> {
  try {
    const {
      avoidBlocked = true,
      prioritizeSafety = false,
      vehicleType = "car",
    } = options || {};

    // Calculate direct distance
    const directDistance = haversineDistance(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    // Road distance is typically 1.3-1.8x direct distance in Nepal
    const roadDistanceFactor = 1.5;
    const estimatedRoadDistance = directDistance * roadDistanceFactor;

    // Get current road conditions
    const roadData = await getCachedRoads();
    const incidents = roadData.merged.filter(
      (r: any) => r.source !== "highway" || r.status !== "Resumed"
    );

    // Find incidents near the route
    const routeIncidents = incidents.filter((r: any) => {
      const props = r.properties || {};
      if (!props.coordinate) return false;

      const dist = haversineDistance(
        origin.lat,
        origin.lng,
        props.coordinate.lat,
        props.coordinate.lng
      );

      return dist < 50; // Within 50km of route
    });

    // Build segments (simplified - in production, use proper routing)
    const segments: ETASegment[] = [];

    // Estimate number of segments based on distance
    const segmentCount = Math.max(1, Math.floor(estimatedRoadDistance / 20));
    const segmentDistance = estimatedRoadDistance / segmentCount;

    let totalDelay = 0;
    let hasBlockedRoads = false;
    const warnings: string[] = [];

    for (let i = 0; i < segmentCount; i++) {
      // Find incidents affecting this segment
      const segmentLat = origin.lat + (destination.lat - origin.lat) * ((i + 0.5) / segmentCount);
      const segmentLng = origin.lng + (destination.lng - origin.lng) * ((i + 0.5) / segmentCount);

      const nearbyIncidents = routeIncidents.filter((r: any) => {
        const dist = haversineDistance(
          segmentLat,
          segmentLng,
          r.properties?.coordinate?.lat || 0,
          r.properties?.coordinate?.lng || 0
        );
        return dist < 15; // Within 15km
      });

      // Determine worst status in this segment
      const worstStatus = nearbyIncidents.reduce(
        (worst: string, inc: any) => {
          const status = inc.status || "unknown";
          if (status === "Blocked") return "blocked";
          if (status === "One-Lane" && worst !== "blocked") return "one-lane";
          return worst;
        },
        "clear"
      );

      if (worstStatus === "blocked") {
        hasBlockedRoads = true;
        if (avoidBlocked) {
          warnings.push(`Segment ${i + 1} has blocked roads - rerouting may be needed`);
        }
      }

      const baseSpeed = getBaseSpeedForRoadType();
      const speedFactor = getStatusSpeedFactor(worstStatus);
      const adjustedSpeed = baseSpeed * speedFactor;

      // Vehicle type adjustment
      let vehicleFactor = 1.0;
      if (vehicleType === "truck") vehicleFactor = 0.7;
      else if (vehicleType === "bus") vehicleFactor = 0.8;
      else if (vehicleType === "motorcycle") vehicleFactor = 1.1;

      const finalSpeed = adjustedSpeed * vehicleFactor;
      const duration = segmentDistance / finalSpeed * 60; // minutes
      const delay = duration - (segmentDistance / baseSpeed * 60);

      totalDelay += Math.max(0, delay);

      segments.push({
        distance: Math.round(segmentDistance * 100) / 100,
        duration: Math.round(duration * 10) / 10,
        roadName: `Segment ${i + 1}`,
        roadCode: "UNKNOWN",
        status: worstStatus as any,
        speed: Math.round(finalSpeed * 10) / 10,
        baseSpeed,
        delayMinutes: Math.round(Math.max(0, delay) * 10) / 10,
      });
    }

    // If safety prioritized, add extra buffer time
    const safetyBuffer = prioritizeSafety ? totalDelay * 0.2 : 0;
    const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0) + safetyBuffer;

    // Determine reliability
    let reliability: "high" | "medium" | "low" = "high";
    if (routeIncidents.length > 5) reliability = "medium";
    if (routeIncidents.length > 10) reliability = "low";

    if (hasBlockedRoads && avoidBlocked) {
      warnings.push("Route contains blocked roads. Consider alternative routes.");
    }

    // Add weather-related warnings (if monsoon season)
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 5 && currentMonth <= 8) { // June-September
      warnings.push("Monsoon season - expect additional delays due to weather");
    }

    return {
      origin,
      destination,
      totalDistance: Math.round(estimatedRoadDistance * 10) / 10,
      totalDuration: Math.round(totalDuration * 10) / 10,
      segments,
      conditionAdjusted: totalDelay > 0,
      reliability,
      alternativeAvailable: !hasBlockingRoads || !avoidBlocked,
      warnings,
      calculatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    logError("[ETA] Failed to calculate ETA", err.message);
    return null;
  }
}

/**
 * Get quick ETA (simplified, for real-time updates)
 */
export async function getQuickETA(
  origin: Location,
  destination: Location
): Promise<{
  distance: number;
  duration: number;
  delayFromConditions: number;
} | null> {
  try {
    const directDistance = haversineDistance(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    const roadDistance = directDistance * 1.5;
    const baseDuration = roadDistance / 50 * 60; // 50 km/h average

    // Get incident count near route
    const roadData = await getCachedRoads();
    const incidentCount = roadData.merged.filter((r: any) => {
      if (r.status === "Resumed") return false;
      const props = r.properties || {};
      if (!props.coordinate) return false;

      const midLat = (origin.lat + destination.lat) / 2;
      const midLng = (origin.lng + destination.lng) / 2;
      const dist = haversineDistance(
        midLat,
        midLng,
        props.coordinate.lat,
        props.coordinate.lng
      );

      return dist < roadDistance / 2;
    }).length;

    // Each incident adds ~15 minutes delay
    const delayFromConditions = incidentCount * 15;

    return {
      distance: Math.round(roadDistance * 10) / 10,
      duration: Math.round((baseDuration + delayFromConditions) * 10) / 10,
      delayFromConditions: Math.round(delayFromConditions * 10) / 10,
    };
  } catch (err: any) {
    logError("[ETA] Failed to calculate quick ETA", err.message);
    return null;
  }
}

/**
 * Compare ETAs for multiple routes
 */
export async function compareETAs(
  origin: Location,
  destination: Location,
  routes: Array<{
    name: string;
    waypoints: Location[];
  }>
): Promise<Array<{
  name: string;
  distance: number;
  duration: number;
  delay: number;
  reliability: "high" | "medium" | "low";
}>> {
  const results = [];

  for (const route of routes) {
    const eta = await calculateETA(origin, destination);
    if (eta) {
      results.push({
        name: route.name,
        distance: eta.totalDistance,
        duration: eta.totalDuration,
        delay: eta.segments.reduce((sum, seg) => sum + seg.delayMinutes, 0),
        reliability: eta.reliability,
      });
    }
  }

  return results.sort((a, b) => a.duration - b.duration);
}
