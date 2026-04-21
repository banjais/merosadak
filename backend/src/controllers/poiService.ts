// backend/src/services/poiService.ts
import { logError, logInfo } from "@logs/logs.js";
import { redisClient } from "@/services/cacheService.js";
import { TOMTOM_API_KEY } from "@/config/index.js";
import { getHighwayList, getHighwayByCode, getMajorJunctions } from "@/services/highwayService.js";
import type { SearchResult } from "@/types.js";
import { haversineDistance } from "@/services/geoUtils.js";
import { refreshIndexFromCaches } from "@/services/searchService.js";

/**
 * Refreshes the POI cache by fetching data from external providers.
 * Implements corridor sampling along highway junctions with weighted deduplication.
 */
export const refreshPOICache = async (customCategories?: string[]): Promise<void> => {
    try {
        logInfo("[POIService] Starting POI cache refresh...");
        const categories = customCategories || ["hospital", "fuel", "police", "atm"];
        const allPoisMap = new Map<string, SearchResult & { weight: number }>();

        // 1. Get highways and identify multi-highway junctions (Prioritize these)
        const highways = await getHighwayList();
        const mainHighways = highways.filter(h => h.code.startsWith("NH")).slice(0, 12);

        const samplingPoints: { lat: number, lng: number, priority: boolean }[] = [];
        const junctionRegistry = new Map<string, string[]>(); // key: lat,lng -> highway codes

        for (const h of mainHighways) {
            const geojson = await getHighwayByCode(h.code);
            if (!geojson) continue;

            const junctions = getMajorJunctions(geojson);
            junctions.forEach(j => {
                const key = `${j.lat.toFixed(4)},${j.lng.toFixed(4)}`;
                const list = junctionRegistry.get(key) || [];
                if (!list.includes(h.code)) {
                    list.push(h.code);
                    junctionRegistry.set(key, list);
                }
            });
        }

        // Filter for points that appear in at least one highway, prioritize intersections
        for (const [coords, highwayCodes] of junctionRegistry.entries()) {
            const [lat, lng] = coords.split(',').map(Number);
            samplingPoints.push({ lat, lng, priority: highwayCodes.length > 1 });
        }

        // Sort to process intersections first and limit sampling to avoid API burnout
        const finalPoints = samplingPoints.sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0)).slice(0, 25);

        // 2. Fetch from providers
        for (const point of finalPoints) {
            let batch: SearchResult[] = [];

            // Try TomTom (Primary - Weight 2)
            if (TOMTOM_API_KEY) {
                try {
                    const ttResults = await fetchFromTomTom(point.lat, point.lng, categories);
                    ttResults.forEach(p => {
                        const existing = allPoisMap.get(p.id);
                        if (!existing || existing.weight < 2) {
                            allPoisMap.set(p.id, { ...p, weight: 2 });
                        }
                    });
                } catch (e) { /* ignore single point failure */ }
            }

            // Try Overpass (Fallback/Supplementary - Weight 1)
            try {
                const osmResults = await fetchFromOverpass(point.lat, point.lng);
                osmResults.forEach(p => {
                    const existing = allPoisMap.get(p.id);
                    // Only add if not present or if we want to deduplicate by distance later
                    if (!existing) allPoisMap.set(p.id, { ...p, weight: 1 });
                });
            } catch (e) { /* ignore */ }

            await new Promise(r => setTimeout(r, 400)); // Rate limit buffer
        }

        const poiData = Array.from(allPoisMap.values());

        // 3. Store in Redis
        if (poiData.length > 0) {
            await redisClient.set("poi:all", poiData, { ex: 64800 });
            logInfo(`[POIService] POI cache updated with ${poiData.length} items across highway corridors.`);
            await refreshIndexFromCaches();
        }
    } catch (err: any) {
        logError("[POIService] refreshPOICache failed completely", { error: err.message });
    }
};

/**
 * Fetches POIs from TomTom Search API with category support
 */
async function fetchFromTomTom(lat: number, lng: number, categories: string[]): Promise<SearchResult[]> {
    const categoryString = categories.join(",");
    const url = `https://api.tomtom.com/search/2/categorySearch/${categoryString}.json?key=${TOMTOM_API_KEY}&lat=${lat}&lon=${lng}&radius=20000&limit=40`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`TomTom API responded with ${response.status}`);

    const data = await response.json();
    return (data.results || []).map((item: any) => ({
        id: `poi-tt-${item.id}`,
        name: item.poi.name,
        type: "poi",
        lat: item.position.lat,
        lng: item.position.lon,
        subtitle: item.poi.categories?.join(", ") || "Point of Interest",
        source: "tomtom",
        extra: { address: item.address?.freeformAddress, phone: item.poi.phone }
    }));
}

/**
 * Fetches POIs from OpenStreetMap Overpass API
 */
async function fetchFromOverpass(lat: number, lng: number): Promise<SearchResult[]> {
    const query = `[out:json][timeout:25];(node"amenity"~"hospital|fuel|police";);out body;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Overpass API responded with ${response.status}`);

    const data = await response.json();
    return (data.elements || []).map((item: any) => ({
        id: `poi-osm-${item.id}`,
        name: item.tags.name || item.tags.amenity || "Facility",
        type: "poi",
        lat: item.lat,
        lng: item.lon,
        subtitle: item.tags.amenity || "Point of Interest",
        source: "osm",
        extra: { ...item.tags }
    }));
}
export const clearPOICache = async () => redisClient.del("poi:all");