// backend/src/services/routePlanningService.ts
import { logInfo, logError } from "../logs/logs.js";
import { getCachedRoads } from "./roadService.js";
import { calculateETA } from "./etaService.js";

// ────────────────────────────────
// Route Planning Service
// A/B route comparison with risk scoring
// ────────────────────────────────

interface Location {
  lat: number;
  lng: number;
  name?: string;
}

interface RouteOption {
  id: string;
  name: string;
  description: string;
  waypoints: Location[];
  highways: string[];
  estimatedDistance: number;
  estimatedDuration: number;
  riskScore: number; // 0-100 (lower is safer)
  conditionScore: number; // 0-100 (higher is better)
  isRecommended: boolean;
  status: "optimal" | "alternative" | "avoid";
  warnings: string[];
  highlights: string[];
}

interface RoutePlan {
  origin: Location;
  destination: Location;
  routes: RouteOption[];
  recommendedRouteId: string;
  calculatedAt: string;
}

interface RouteRiskFactors {
  blockedIncidents: number;
  oneLaneIncidents: number;
  monsoonRisk: boolean;
  nightTravel: boolean;
  mountainousTerrain: boolean;
  roadQuality: "good" | "fair" | "poor";
}

/**
 * Haversine distance
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
 * Calculate risk score for a route based on incidents
 */
async function calculateRouteRisk(
  waypoints: Location[],
  highways: string[]
): Promise<RouteRiskFactors & { score: number }> {
  const roadData = await getCachedRoads();
  const incidents = roadData.merged.filter((r: any) => r.status !== "Resumed");

  let blockedIncidents = 0;
  let oneLaneIncidents = 0;

  // Count incidents along the route
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];

    for (const incident of incidents) {
      const coord = incident.properties?.coordinate;
      if (!coord) continue;

      const dist = haversineDistance(
        start.lat,
        start.lng,
        coord.lat,
        coord.lng
      );

      if (dist < 20) { // Within 20km of route
        if (incident.status === "Blocked") blockedIncidents++;
        else if (incident.status === "One-Lane") oneLaneIncidents++;
      }
    }
  }

  // Check if monsoon season
  const month = new Date().getMonth();
  const monsoonRisk = month >= 5 && month <= 8; // June-September

  // Check if route passes through mountainous regions
  const mountainousTerrain = waypoints.some((wp) => wp.lat > 28.0);

  // Estimate road quality based on highway codes
  let roadQuality: "good" | "fair" | "poor" = "fair";
  if (highways.every((h) => h.startsWith("NH"))) roadQuality = "good";
  if (highways.some((h) => h.startsWith("DH"))) roadQuality = "poor";

  // Calculate composite risk score (0-100)
  let score = 0;
  score += blockedIncidents * 15;
  score += oneLaneIncidents * 8;
  if (monsoonRisk) score += 15;
  if (mountainousTerrain) score += 10;
  if (roadQuality === "poor") score += 20;
  else if (roadQuality === "fair") score += 10;

  return {
    blockedIncidents,
    oneLaneIncidents,
    monsoonRisk,
    nightTravel: false, // Would need time info
    mountainousTerrain,
    roadQuality,
    score: Math.min(100, Math.max(0, score)),
  };
}

/**
 * Generate alternative routes between two points
 * In production, this would use a proper routing engine
 */
export async function planRoute(
  origin: Location,
  destination: Location,
  options?: {
    avoidBlocked?: boolean;
    prioritizeSafety?: boolean;
    maxDeviationKm?: number;
  }
): Promise<RoutePlan | null> {
  try {
    const {
      avoidBlocked = true,
      prioritizeSafety = false,
      maxDeviationKm = 50,
    } = options || {};

    const directDistance = haversineDistance(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    // Generate route options (simplified - in production use proper routing)
    const routes: RouteOption[] = [];

    // Route 1: Direct route (fastest)
    const directWaypoints = [origin, destination];
    const directRisk = await calculateRouteRisk(directWaypoints, []);
    const directETA = await calculateETA(origin, destination);

    if (directETA) {
      routes.push({
        id: "direct",
        name: "Direct Route",
        description: "Fastest route via main highways",
        waypoints: directWaypoints,
        highways: [],
        estimatedDistance: directETA.totalDistance,
        estimatedDuration: directETA.totalDuration,
        riskScore: directRisk.score,
        conditionScore: Math.max(0, 100 - directRisk.score),
        isRecommended: false,
        status: directRisk.score < 30 ? "optimal" : directRisk.score < 60 ? "alternative" : "avoid",
        warnings: directETA.warnings,
        highlights: ["Shortest distance", "Main highways"],
      });
    }

    // Route 2: Scenic/safer route (via safer highways)
    const scenicWaypoints = [
      origin,
      { lat: (origin.lat + destination.lat) / 2 + 0.5, lng: (origin.lng + destination.lng) / 2, name: "Midpoint" },
      destination,
    ];
    const scenicRisk = await calculateRouteRisk(scenicWaypoints, ["NH01"]);

    if (scenicRisk.score < directRisk.score || prioritizeSafety) {
      const scenicETA = await calculateETA(origin, destination, { prioritizeSafety: true });
      if (scenicETA) {
        routes.push({
          id: "scenic",
          name: "Scenic Route",
          description: "Safer route via better maintained highways",
          waypoints: scenicWaypoints,
          highways: ["NH01"],
          estimatedDistance: scenicETA.totalDistance,
          estimatedDuration: scenicETA.totalDuration,
          riskScore: scenicRisk.score,
          conditionScore: Math.max(0, 100 - scenicRisk.score),
          isRecommended: prioritizeSafety,
          status: scenicRisk.score < 30 ? "optimal" : "alternative",
          warnings: scenicETA.warnings,
          highlights: ["Better road quality", "Less risk", "Scenic views"],
        });
      }
    }

    // Route 3: Alternative via different highways
    const altWaypoints = [
      origin,
      { lat: (origin.lat + destination.lat) / 2 - 0.3, lng: (origin.lng + destination.lng) / 2 + 0.3, name: "Alternative" },
      destination,
    ];
    const altRisk = await calculateRouteRisk(altWaypoints, ["NH02"]);

    if (altRisk.score < 70) {
      const altETA = await calculateETA(origin, destination);
      if (altETA) {
        routes.push({
          id: "alternative",
          name: "Alternative Route",
          description: "Different highway combination",
          waypoints: altWaypoints,
          highways: ["NH02"],
          estimatedDistance: altETA.totalDistance * 1.1,
          estimatedDuration: altETA.totalDuration * 1.15,
          riskScore: altRisk.score,
          conditionScore: Math.max(0, 100 - altRisk.score),
          isRecommended: false,
          status: altRisk.score < 30 ? "optimal" : altRisk.score < 60 ? "alternative" : "avoid",
          warnings: altETA.warnings,
          highlights: ["Less traffic", "Different terrain"],
        });
      }
    }

    // Determine recommended route
    if (routes.length === 0) {
      return null;
    }

    const recommendedRoute = routes.reduce((best, current) => {
      if (prioritizeSafety) {
        return current.riskScore < best.riskScore ? current : best;
      }
      return current.estimatedDuration < best.estimatedDuration ? current : best;
    });

    recommendedRoute.isRecommended = true;

    return {
      origin,
      destination,
      routes,
      recommendedRouteId: recommendedRoute.id,
      calculatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    logError("[RoutePlanning] Failed to plan route", err.message);
    return null;
  }
}

/**
 * Compare two specific routes
 */
export async function compareRoutes(
  origin: Location,
  destination: Location,
  route1Name: string,
  route2Name: string
): Promise<{
  route1: any;
  route2: any;
  comparison: {
    faster: string;
    safer: string;
    shorter: string;
    recommendation: string;
  };
} | null> {
  const plan = await planRoute(origin, destination);
  if (!plan || plan.routes.length < 2) return null;

  const route1 = plan.routes[0];
  const route2 = plan.routes[1];

  const faster = route1.estimatedDuration < route2.estimatedDuration ? route1Name : route2Name;
  const safer = route1.riskScore < route2.riskScore ? route1Name : route2Name;
  const shorter = route1.estimatedDistance < route2.estimatedDistance ? route1Name : route2Name;

  // Overall recommendation
  const recommendation =
    route1.conditionScore > route2.conditionScore && route1.riskScore < 50
      ? route1Name
      : route2Name;

  return {
    route1,
    route2,
    comparison: {
      faster,
      safer,
      shorter,
      recommendation,
    },
  };
}

/**
 * Get route safety details
 */
export async function getRouteSafety(
  origin: Location,
  destination: Location
): Promise<{
  overallRisk: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  safetyTips: string[];
  emergencyContacts: Array<{ name: string; phone: string; type: string }>;
} | null> {
  try {
    const risk = await calculateRouteRisk([origin, destination], []);

    let overallRisk: "low" | "medium" | "high" | "critical";
    if (risk.score < 25) overallRisk = "low";
    else if (risk.score < 50) overallRisk = "medium";
    else if (risk.score < 75) overallRisk = "high";
    else overallRisk = "critical";

    const riskFactors: string[] = [];
    if (risk.blockedIncidents > 0) riskFactors.push(`${risk.blockedIncidents} blocked road(s) on route`);
    if (risk.oneLaneIncidents > 0) riskFactors.push(`${risk.oneLaneIncidents} one-lane section(s)`);
    if (risk.monsoonRisk) riskFactors.push("Monsoon season - increased landslide risk");
    if (risk.mountainousTerrain) riskFactors.push("Mountainous terrain - drive carefully");
    if (risk.roadQuality === "poor") riskFactors.push("Poor road quality expected");

    const safetyTips: string[] = [
      "Check weather forecast before departure",
      "Keep emergency contacts handy",
      "Inform someone about your travel plans",
      "Carry first aid kit and water",
      "Drive during daylight hours if possible",
    ];

    if (risk.monsoonRisk) {
      safetyTips.push("Avoid travel during heavy rainfall");
      safetyTips.push("Watch for landslide warning signs");
    }

    if (risk.mountainousTerrain) {
      safetyTips.push("Use low gear on steep descents");
      safetyTips.push("Watch for falling rocks");
    }

    const emergencyContacts = [
      { name: "Nepal Police", phone: "100", type: "police" },
      { name: "Ambulance", phone: "102", type: "medical" },
      { name: "Fire Brigade", phone: "101", type: "fire" },
      { name: "Traffic Police", phone: "103", type: "traffic" },
      { name: "Tourist Police", phone: "1145", type: "tourist" },
    ];

    return {
      overallRisk,
      riskFactors,
      safetyTips,
      emergencyContacts,
    };
  } catch (err: any) {
    logError("[RoutePlanning] Failed to get route safety", err.message);
    return null;
  }
}
