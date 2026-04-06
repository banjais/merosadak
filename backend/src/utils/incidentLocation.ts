// backend/src/utils/incidentLocation.ts
import type { Feature, LineString, Point } from "geojson";

/**
 * Calculate exact coordinates for a road incident
 */
export function calculateIncidentLocation(
  highwayGeojson: any,
  incident: {
    chainage?: string | number;
    incidentCoordinate?: string;
    incidentPlace?: string;
    road_refno?: string;
  }
): { lat: number; lng: number } | null {

  // 1. If coordinates are already provided in incidentCoordinate field
  if (incident.incidentCoordinate) {
    const coords = parseCoordinates(incident.incidentCoordinate);
    if (coords) return coords;
  }

  // 2. If chainage is provided, interpolate along the highway
  if (incident.chainage !== undefined && incident.chainage !== '') {
    const chainageNum = typeof incident.chainage === 'string'
      ? parseFloat(incident.chainage.toString())
      : incident.chainage;

    if (!isNaN(chainageNum)) {
      const coords = interpolateByChainage(highwayGeojson, chainageNum);
      if (coords) return coords;
    }
  }

  // 3. Try to find location by place name (future enhancement)
  // For now, return null if no coordinates found

  return null;
}

/**
 * Parse coordinate string like "27.7172,85.3240" or "85.3240 27.7172"
 */
function parseCoordinates(coordString: string): { lat: number; lng: number } | null {
  // Remove extra whitespace and split by comma or space
  const cleaned = coordString.replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(/[, ]/).filter(p => p.length > 0);

  if (parts.length !== 2) return null;

  const num1 = parseFloat(parts[0]);
  const num2 = parseFloat(parts[1]);

  if (isNaN(num1) || isNaN(num2)) return null;

  // Determine which is lat/lng based on typical ranges
  // Lat: -90 to 90, Lng: -180 to 180
  if (Math.abs(num1) <= 90 && Math.abs(num2) <= 180) {
    return { lat: num1, lng: num2 };
  } else if (Math.abs(num2) <= 90 && Math.abs(num1) <= 180) {
    return { lat: num2, lng: num1 };
  }

  return null;
}

/**
 * Interpolate coordinates along highway based on chainage
 */
function interpolateByChainage(highwayGeojson: any, targetChainage: number): { lat: number; lng: number } | null {
  if (!highwayGeojson?.features) return null;

  // Find all line segments with chainage information
  const segments: Array<{
    startChainage: number;
    endChainage: number;
    coordinates: number[][];
  }> = [];

  for (const feature of highwayGeojson.features) {
    if (feature.geometry?.type === 'LineString' && feature.properties) {
      const props = feature.properties;
      const startChainage = parseFloat(props.link_from?.toString() || '0');
      const endChainage = parseFloat(props.link_to?.toString() || '0');

      if (!isNaN(startChainage) && !isNaN(endChainage) && feature.geometry.coordinates) {
        segments.push({
          startChainage,
          endChainage,
          coordinates: feature.geometry.coordinates as number[][]
        });
      }
    }
  }

  // Sort segments by start chainage
  segments.sort((a, b) => a.startChainage - b.startChainage);

  // Find the segment that contains the target chainage
  for (const segment of segments) {
    if (targetChainage >= segment.startChainage && targetChainage <= segment.endChainage) {
      return interpolateAlongSegment(segment, targetChainage);
    }
  }

  return null;
}

/**
 * Interpolate position along a single segment based on chainage
 */
function interpolateAlongSegment(
  segment: { startChainage: number; endChainage: number; coordinates: number[][] },
  targetChainage: number
): { lat: number; lng: number } | null {

  const { startChainage, endChainage, coordinates } = segment;
  const segmentLength = endChainage - startChainage;

  if (segmentLength === 0 || coordinates.length < 2) return null;

  const relativePosition = (targetChainage - startChainage) / segmentLength;

  // If position is exactly at start or end, return that point
  if (relativePosition <= 0) {
    return { lng: coordinates[0][0], lat: coordinates[0][1] };
  }
  if (relativePosition >= 1) {
    return { lng: coordinates[coordinates.length - 1][0], lat: coordinates[coordinates.length - 1][1] };
  }

  // Calculate total distance along the line
  const totalDistance = calculateLineDistance(coordinates);

  // Find position along the line
  const targetDistance = totalDistance * relativePosition;
  let accumulatedDistance = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [x1, y1] = coordinates[i];
    const [x2, y2] = coordinates[i + 1];
    const segmentDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    if (accumulatedDistance + segmentDistance >= targetDistance) {
      // Interpolate between these two points
      const remainingDistance = targetDistance - accumulatedDistance;
      const ratio = remainingDistance / segmentDistance;

      const lng = x1 + (x2 - x1) * ratio;
      const lat = y1 + (y2 - y1) * ratio;

      return { lng, lat };
    }

    accumulatedDistance += segmentDistance;
  }

  // Fallback to last point
  const lastCoord = coordinates[coordinates.length - 1];
  return { lng: lastCoord[0], lat: lastCoord[1] };
}

/**
 * Calculate total distance of a line in coordinate units
 */
function calculateLineDistance(coordinates: number[][]): number {
  let totalDistance = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [x1, y1] = coordinates[i];
    const [x2, y2] = coordinates[i + 1];
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    totalDistance += distance;
  }

  return totalDistance;
}