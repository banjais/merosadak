import { getCachedRoads } from "./roadService.js";
import { ROAD_STATUS } from "../constants/sheets.js";
import { haversineDistance, calculateBearing } from "@/services/geoUtils";

export { calculateBearing, haversineDistance };

/**
 * Calculates total distance for a path of coordinates.
 */
export function calculatePathDistance(points: { lat: number; lng: number }[]): number {
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversineDistance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return Math.round(distance * 100) / 100;
}

/**
 * Estimates duration in hours, factoring in road status and vehicle type.
 */
export async function calculateIncidentAwarePathDuration(
  points: { lat: number; lng: number }[],
  vehicleType: string = "car",
  landslideSeverity: number = 1.0
) {
  const distance = calculatePathDistance(points);
  const roads = await getCachedRoads();
  const incidents = roads.merged.filter(r => r.status !== ROAD_STATUS.RESUMED);

  // Base speeds for Nepal terrain (km/h)
  const baseSpeeds = { car: 40, bus: 30, bike: 45 };
  const baseSpeed = baseSpeeds[vehicleType] || 40;

  // Dynamic search radius based on vehicle maneuverability
  const radii: Record<string, number> = { car: 1.0, suv: 1.2, bus: 1.5, truck: 1.5, bike: 0.5, motorcycle: 0.5 };
  const searchRadius = radii[vehicleType] || 1.0;

  let delayHours = 0;
  const uniqueIncidentIds = new Set<string>();
  const hazards: any[] = [];

  // 🏔️ Curvature Analysis: Detect sharp turns using intensity (degrees deflection per 100m)
  // This uses the same logic as highwayService.ts to identify dangerous mountain bends along the route.
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[i + 1];

    const b1 = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
    const b2 = calculateBearing(p2.lat, p2.lng, p3.lat, p3.lng);

    let diff = Math.abs(b1 - b2);
    if (diff > 180) diff = 360 - diff;

    const turnLength = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng) + haversineDistance(p2.lat, p2.lng, p3.lat, p3.lng);
    const intensity = turnLength > 0 ? (diff / (turnLength * 10)) : 0;

    // Intensity > 25 indicates a sharp turn (e.g. 25 deg over 100m)
    if (intensity > 25 || diff > 45) {
      hazards.push({ lat: p2.lat, lng: p2.lng, type: 'SHARP_TURN', intensity: Math.round(intensity), angle: Math.round(diff) });
    }

    // 🏔️ Grade Analysis: Detect steep segments (> 10% grade)
    // This requires points to have elevation data (provided by elevationService in analytics call)
    const p1Any = p1 as any;
    const p2Any = p2 as any;
    if (p1Any.elevation !== undefined && p2Any.elevation !== undefined) {
      const distMeters = haversineDistance(p1Any.lat, p1Any.lng, p2Any.lat, p2Any.lng) * 1000;
      const riseMeters = p2Any.elevation - p1Any.elevation;
      const grade = distMeters > 0 ? (riseMeters / distMeters) * 100 : 0;

      if (Math.abs(grade) > 10) {
        hazards.push({
          lat: p2Any.lat,
          lng: p2Any.lng,
          type: 'STEEP_GRADE',
          grade: Math.round(grade),
          isDescent: grade < 0
        });
      }
    }
  }

  // Check if any point on the path is near an active incident
  points.forEach(p => {
    const nearbyIncident = incidents.find(inc => {
      const coords = inc.geometry?.coordinates;
      if (!coords) return false;
      const incLat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];
      const incLng = Array.isArray(coords[0]) ? coords[0][0] : coords[1];
      return haversineDistance(p.lat, p.lng, incLat, incLng) < searchRadius;
    });

    if (nearbyIncident) {
      const incidentId = nearbyIncident.id || `${nearbyIncident.geometry?.coordinates[0]}-${nearbyIncident.geometry?.coordinates[1]}`;

      if (!uniqueIncidentIds.has(incidentId)) {
        uniqueIncidentIds.add(incidentId);
        hazards.push({ lat: p.lat, lng: p.lng, type: nearbyIncident.status });

        if (nearbyIncident.status === ROAD_STATUS.BLOCKED) {
          delayHours += 2 * landslideSeverity;
        } else if (nearbyIncident.status === ROAD_STATUS.ONE_LANE) {
          delayHours += 0.5;
        }
      }
    }
  });

  const baseDuration = distance / baseSpeed;
  const totalDuration = baseDuration + delayHours;

  return {
    duration: Math.round(totalDuration * 10) / 10,
    delay: Math.round(delayHours * 10) / 10,
    activeLandslides: uniqueIncidentIds.size,
    distance,
    hazards
  };
}

export async function calculateETA(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  options?: { prioritizeSafety?: boolean }
) {
  const distance = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  const baseSpeed = options?.prioritizeSafety ? 30 : 50;
  const duration = distance / baseSpeed;
  return { distance, duration: Math.round(duration * 10) / 10 };
}

export async function getQuickETA(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
) {
  const distance = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  const baseSpeed = 50;
  const duration = distance / baseSpeed;
  return { distance, duration: Math.round(duration * 10) / 10 };
}