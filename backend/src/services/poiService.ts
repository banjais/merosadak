import { getCache } from "./cacheService.js";
import { config } from "../config/index.js";
import { fetchPOIsFromOverpass } from "./overpassService.js";
import { getMarkerIcon } from "../utils/iconMap.js";
import { haversineDistance } from "./etaService.js";

/**
 * Gets nearby POIs using a tiered provider approach.
 */
export async function getNearbyPOIs(lat: number, lng: number, category: string = "hospital") {
  const cacheKey = `pois:${category}:${lat.toFixed(3)}:${lng.toFixed(3)}`;

  return getCache(cacheKey, async () => {
    let results: any[] = [];

    // 1. Try TomTom (Primary)
    if (config.TOMTOM_API_KEY) {
      try {
        const url = `${config.TOMTOM_API_URL}/search/2/poiSearch/${category}.json?key=${config.TOMTOM_API_KEY}&lat=${lat}&lon=${lng}&radius=10000`;
        const res = await fetch(url);
        const data = await res.json() as any;
        results = (data.results || []).map((r: any) => ({
          id: r.id,
          name: r.poi.name,
          lat: r.position.lat,
          lng: r.position.lon,
          category,
          source: 'tomtom',
          address: r.address.freeformAddress
        }));
      } catch { /* Fallback to Overpass */ }
    }

    // 2. Fallback to Overpass if TomTom failed or returned nothing
    if (results.length === 0) {
      results = await fetchPOIsFromOverpass(lat, lng, category);
    }

    return results.map(poi => ({
      ...poi,
      icon: getMarkerIcon(category),
      distance: Math.round(haversineDistance(lat, lng, poi.lat, poi.lng) * 10) / 10
    })).sort((a, b) => a.distance - b.distance);

  }, 86400); // 24-hour cache
}

export const refreshPOICache = async () => {
  const categories = ["hospital", "pharmacy", "fuel", "restaurant", "hotel"];
  for (const category of categories) {
    await getNearbyPOIs(27.7172, 85.3240, category);
  }
};