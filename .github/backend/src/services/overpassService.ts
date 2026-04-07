// backend/src/services/overpassService.ts
import axios from "axios";
import { logError } from "../logs/logs.js";
import { getMarkerIcon } from "../utils/iconMap.js";
import { OVERPASS_API_URL } from "../config/index.js";
import { POIResult } from "./poiService.js";

export async function fetchOverpassPOIs(
  query: string,
  lat: number,
  lng: number,
  radius: number
): Promise<POIResult[]> {
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
    const res = await axios.get(`${OVERPASS_API_URL}/interpreter`, {
      params: { data: overpassQuery },
      timeout: 20_000,
    });

    return res.data.elements
      .map((e: any) => {
        const latVal = e.lat ?? e.center?.lat;
        const lngVal = e.lon ?? e.center?.lon;
        if (!latVal || !lngVal) return null;

        const category =
          e.tags?.amenity ||
          e.tags?.tourism ||
          e.tags?.leisure ||
          e.tags?.shop ||
          "Place";

        return {
          id: `op-${e.id}`,
          name: e.tags?.name ?? query,
          location: { lat: latVal, lng: lngVal },
          category,
          icon: getMarkerIcon(category),
          address:
            e.tags?.["addr:full"] ??
            e.tags?.["addr:city"] ??
            "Nepal",
          source: "overpass",
          isTouristFriendly: checkTouristStatus(category, e.tags?.name),
        };
      })
      .filter(Boolean) as POIResult[];
  } catch (err: any) {
    logError("[Overpass] Fetch failed", err.message);
    return [];
  }
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
