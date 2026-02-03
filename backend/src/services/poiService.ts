// backend/src/services/poiService.ts
import fs from "fs/promises";
import path from "path";
import axios from "axios";

import { CACHE_DIR, CACHE_POI } from "../config/paths.js";
import { config } from "../config/index.js";
import { logInfo, logError } from "../logs/logs.js";
import { getMarkerIcon } from "../utils/iconMap.js";
import { withCache } from "./cacheService.js";

/**
 * 🧭 POI Result Model
 */
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

/**
 * ⏱ Cache TTL (30 minutes)
 */
const POI_CACHE_TTL = 30 * 60; // seconds

/**
 * 📍 Search POIs (TomTom → Overpass fallback) with hybrid cache
 */
export const searchPOIs = async (
  query: string,
  lat: number,
  lng: number
): Promise<POIResult[]> => {
  const key = `poi:${query}:${lat.toFixed(3)}:${lng.toFixed(3)}`;

  return withCache(key, async () => {
    await ensureCacheDir();

    // 1️⃣ Try Primary: TomTom
    try {
      const tomtomUrl = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`;
      const res = await axios.get(tomtomUrl, {
        timeout: 10_000,
        params: {
          key: config.TOMTOM.API_KEY,
          lat,
          lon: lng,
          radius: 25_000,
          countrySet: "NP",
          limit: 20,
        },
      });

      if (res.data?.results?.length) {
        const results: POIResult[] = res.data.results.map((item: any) => {
          const category = item.poi?.categories?.[0] ?? "General";
          return {
            id: item.id,
            name: item.poi?.name ?? item.address.freeformAddress,
            location: { lat: item.position.lat, lng: item.position.lon },
            category,
            icon: getMarkerIcon(category),
            address: item.address.freeformAddress,
            source: "tomtom",
            isTouristFriendly: checkTouristStatus(category, item.poi?.name),
          };
        });
        return results;
      }
    } catch (err: any) {
      logInfo("⚠️ [POI] TomTom unavailable, falling back to Overpass");
    }

    // 2️⃣ Fallback: Overpass
    return fetchOverpassPOIs(sanitizeQuery(query), lat, lng, 25_000);
  }, POI_CACHE_TTL);
};

/**
 * 🌍 Overpass POI Fetch
 */
async function fetchOverpassPOIs(query: string, lat: number, lng: number, radius: number): Promise<POIResult[]> {
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["name"~"${query}",i](around:${radius},${lat},${lng});
      node["amenity"~"${query}",i](around:${radius},${lat},${lng});
      node["tourism"~"${query}",i](around:${radius},${lat},${lng});
      way["name"~"${query}",i](around:${radius},${lat},${lng});
    );
    out center tags;
  `;

  try {
    const res = await axios.get("https://overpass-api.de/api/interpreter", {
      timeout: 20_000,
      params: { data: overpassQuery },
    });

    return res.data.elements
      .map((e: any): POIResult | null => {
        const latVal = e.lat ?? e.center?.lat;
        const lngVal = e.lon ?? e.center?.lon;
        if (latVal == null || lngVal == null) return null;

        const category = e.tags?.amenity || e.tags?.tourism || e.tags?.leisure || e.tags?.shop || "Place";

        return {
          id: `op-${e.id}`,
          name: e.tags?.name ?? query,
          location: { lat: latVal, lng: lngVal },
          category,
          icon: getMarkerIcon(category),
          address: e.tags?.["addr:full"] ?? e.tags?.["addr:city"] ?? "Nepal",
          source: "overpass",
          isTouristFriendly: checkTouristStatus(category, e.tags?.name),
        };
      })
      .filter(Boolean) as POIResult[];
  } catch (err: any) {
    logError("❌ [POI] Overpass fetch failed", err.message);
    return [];
  }
}

/**
 * 🛠️ Ensure cache folder exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err: any) {
    logError("[POI] Failed to create cache directory", { error: err.message });
  }
}

/**
 * 🔹 Utilities
 */
function sanitizeQuery(q: string) {
  return q.replace(/["';]/g, "").trim();
}

function checkTouristStatus(category: string, name = ""): boolean {
  const keywords = ["tourist", "resort", "heritage", "museum", "airport", "hotel", "temple"];
  const c = category.toLowerCase();
  const n = name.toLowerCase();
  return keywords.some((k) => c.includes(k) || n.includes(k));
}
