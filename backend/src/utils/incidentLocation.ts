import type { FeatureCollection } from "../types.js";
import { isValidNepalCoordinate } from "@/services/geoUtils";

/**
 * Calculates the lat/lng for an incident.
 * Priority: incidentCoordinate > chainage calculation > null
 */
export function calculateIncidentLocation(
  highwayGeoJSON: FeatureCollection,
  props: {
    chainage?: string;
    incidentCoordinate?: string;
    incidentPlace?: string;
    road_refno?: string;
  }
): { lat: number; lng: number } | null {
  // 1. If exact coordinates are provided in the source row, use them
  if (props.incidentCoordinate) {
    const parts = props.incidentCoordinate.split(/[\s,]+/).map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && isValidNepalCoordinate(parts[0], parts[1])) {
      // Expected format is "Lat, Lng" in typical user/DOR input
      return { lat: parts[0], lng: parts[1] };
    }
  }

  // 2. Note: Advanced chainage-to-coordinate interpolation would happen here 
  // by traversing the highwayGeoJSON features. For now, we return null to 
  // trigger the mid-point fallback in alertService.
  return null;
}