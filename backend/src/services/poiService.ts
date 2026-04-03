// backend/src/services/poiService.ts
import fs from "fs/promises";
import axios from "axios";
import { CACHE_DIR, CACHE_POI } from "../config/paths.js";
import { logInfo, logError } from "../logs/logs.js";
import { config, TOMTOM_API_URL, TOMTOM_API_KEY } from "../config/index.js";
import { getMarkerIcon } from "../utils/iconMap.js";
import { withCache } from "./cacheService.js";
import { fetchOverpassPOIs } from "./overpassService.js"; // <- new import

export interface POIResult {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  category: string;
  icon: string;
  address: string;
  source: "tomtom" | "overpass";
  isTouristFriendly: boolean;
}

const POI_CACHE_TTL = 30 * 60; // 30 mins

export const searchPOIs = async (
  query: string,
  lat?: number,
  lng?: number
): Promise<POIResult[]> => {
  const key = `poi:${query}:${lat?.toFixed(3) ?? '0'}:${lng?.toFixed(3) ?? '0'}`;
  return withCache(
    key,
    async () => {
      // 1️⃣ Try TomTom first
      try {
        const res = await axios.get(
          `${TOMTOM_API_URL}/search/2/search/${encodeURIComponent(query)}.json`,
          {
            params: {
              key: TOMTOM_API_KEY,
              lat,
              lon: lng,
              radius: 25_000,
              countrySet: "NP",
              limit: 20,
            },
            timeout: 10_000,
          }
        );

        if (res.data?.results?.length) {
          return res.data.results.map((item: any) => ({
            id: item.id,
            name: item.poi?.name ?? item.address.freeformAddress,
            location: { lat: item.position.lat, lng: item.position.lon },
            category: item.poi?.categories?.[0] ?? "General",
            icon: getMarkerIcon(item.poi?.categories?.[0] ?? "General"),
            address: item.address.freeformAddress,
            source: "tomtom",
            isTouristFriendly: checkTouristStatus(
              item.poi?.categories?.[0],
              item.poi?.name
            ),
          }));
        }
      } catch {
        logInfo("⚠️ [POI] TomTom failed, fallback to Overpass");
      }

      // 2️⃣ Fallback: Overpass OSM
      return fetchOverpassPOIs(sanitizeQuery(query), lat ?? 0, lng ?? 0, 25_000);
    },
    POI_CACHE_TTL
  );
};

export async function refreshPOICache() {
  logInfo("[POIService] Pre-warming POI cache...");

  const defaultQueries = [
    "hospital",
    "fuel",
    "hotel",
    "restaurant",
    "police",
    "bus",
    "airport",
  ];

  const lat = 27.7172;
  const lng = 85.3240;

  const results: Record<string, POIResult[]> = {};

  for (const q of defaultQueries) {
    try {
      const pois = await searchPOIs(q, lat, lng);
      results[q] = pois;
      logInfo(`[POIService] Cached ${pois.length} POIs for "${q}"`);
    } catch (err: any) {
      logError("[POIService] Refresh failed", {
        query: q,
        error: err.message,
      });
    }
  }

  await fs.writeFile(CACHE_POI, JSON.stringify(results, null, 2), "utf-8");

  return results;
}

function sanitizeQuery(q: string) {
  return q.replace(/["';]/g, "").trim();
}

function checkTouristStatus(category: string, name?: string) {
  const keywords = [
    "tourist",
    "resort",
    "heritage",
    "museum",
    "airport",
    "hotel",
    "temple",
  ];
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();
  return keywords.some(k => c.includes(k) || n.includes(k));
}

export const handleGetPOI = searchPOIs;
