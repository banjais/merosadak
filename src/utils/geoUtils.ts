// Geographic utility functions for spatial calculations and route corridor filtering

/**
 * Calculates the Haversine distance in kilometers between two lat/lng coordinates.
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determines whether a geographical point lies near a user's chosen route path
 * or its origin / destination endpoints within a specified distance buffer (default: 30 km).
 */
export function isPointNearRoute(
  pointLat: number,
  pointLng: number,
  pathCoordinates?: [number, number][],
  origin?: { lat: number; lng: number } | null,
  destination?: { lat: number; lng: number } | null,
  maxDistanceKm: number = 30
): boolean {
  if (origin && getDistanceKm(pointLat, pointLng, origin.lat, origin.lng) <= maxDistanceKm) {
    return true;
  }
  if (destination && getDistanceKm(pointLat, pointLng, destination.lat, destination.lng) <= maxDistanceKm) {
    return true;
  }
  if (!pathCoordinates || pathCoordinates.length === 0) {
    return false;
  }

  // Sample points along path to optimize performance
  const step = Math.max(1, Math.floor(pathCoordinates.length / 60));
  for (let i = 0; i < pathCoordinates.length; i += step) {
    const [pLat, pLng] = pathCoordinates[i];
    if (getDistanceKm(pointLat, pointLng, pLat, pLng) <= maxDistanceKm) {
      return true;
    }
  }

  // Always check the very last coordinate
  if (pathCoordinates.length > 0) {
    const last = pathCoordinates[pathCoordinates.length - 1];
    if (getDistanceKm(pointLat, pointLng, last[0], last[1]) <= maxDistanceKm) {
      return true;
    }
  }

  return false;
}
