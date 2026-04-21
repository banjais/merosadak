import { config } from "../config/index.js";
import { logError } from "../logs/logs.js";

/**
 * Fetches POIs from OpenStreetMap via Overpass API.
 */
export async function fetchPOIsFromOverpass(lat: number, lng: number, category: string, radius: number = 5000) {
  const apiUrls = [config.OVERPASS_API_URL, config.OVERPASS_FALLBACK_URL];

  // Map common categories to OSM tags
  const tagMap: Record<string, string> = {
    hospital: 'amenity=hospital',
    fuel: 'amenity=fuel',
    police: 'amenity=police',
    restaurant: 'amenity=restaurant',
    hotel: 'tourism=hotel'
  };

  const tag = tagMap[category.toLowerCase()] || `amenity=${category}`;
  const query = `[out:json][timeout:25];nwr(${lat - 0.05},${lng - 0.05},${lat + 0.05},${lng + 0.05})[${tag}];out center;`;

  for (const url of apiUrls) {
    try {
      const response = await fetch(`${url}/interpreter`, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (!response.ok) continue;

      const data = await response.json() as any;
      return (data.elements || []).map((el: any) => ({
        id: el.id,
        name: el.tags?.name || category,
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon,
        category,
        source: 'osm',
        address: el.tags?.['addr:street'] || el.tags?.['addr:city'] || ''
      }));
    } catch (err: any) {
      logError(`[OverpassService] Attempt failed for ${url}`, err.message);
    }
  }

  logError("[OverpassService] All Overpass providers failed");
  return [];
}