import Fuse from "fuse.js";
import { logInfo, logError } from "../logs/logs.js";
import { redisClient } from "./cacheService.js";
import { getCachedRoads } from "./roadService.js";
import { ROAD_STATUS } from "../constants/sheets.js";
import { CACHE_ALERTS } from "../config/paths.js";
import fs from "fs/promises";
import { getCachedMonsoonRisk } from "./monsoonService.js";
import { NOMINATIM_API_URL } from "../config/index.js";

export interface SearchResult {
  id: string;
  name: string;
  type: "road" | "traffic" | "poi" | "location" | "weather";
  lat: number;
  lng: number;
  subtitle?: string;
  source: "local" | "tomtom" | "osm" | "weather";
  score?: number;
  extra?: any;
}

let fuseIndex: Fuse<SearchResult> | null = null;

function calculateHaversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const refreshIndexFromCaches = async () => {
  try {
    const roadData = await getCachedRoads();
    const monsoonRisks = (await getCachedMonsoonRisk()) || [];
    const items: SearchResult[] = [];

    roadData.merged.forEach((f: any) => {
      const props = f.properties;
      if (!props || !f.geometry?.coordinates) return;

      let coords: any;
      if (f.geometry.type === "LineString") {
        coords = f.geometry.coordinates[0];
      } else if (f.geometry.type === "MultiLineString") {
        coords = f.geometry.coordinates[0]?.[0];
      } else if (f.geometry.type === "Point") {
        coords = f.geometry.coordinates;
      }
      if (!coords || coords.length < 2) return;

      const risk = monsoonRisks.find(r => r.roadId === props.id || r.roadId === props.road_refno || r.roadId === props.road_name);

      items.push({
        id: `road-${props.id || props.road_refno}`,
        name: props.road_name || props.road_refno,
        type: "road",
        lat: coords[1],
        lng: coords[0],
        subtitle: `${props.status}${risk && ["HIGH", "EXTREME"].includes(risk.riskLevel) ? ` | ⛈️ Monsoon Risk` : ""}`,
        source: "local",
        extra: { ...props, riskLevel: risk?.riskLevel },
      });
    });

    try {
      const alertsRaw = await fs.readFile(CACHE_ALERTS, "utf-8");
      const alerts = JSON.parse(alertsRaw);
      alerts.forEach((a: any) => {
        items.push({
          id: `alert-${Date.now()}-${Math.random()}`,
          name: a.type,
          type: "traffic",
          lat: a.lat,
          lng: a.lng,
          subtitle: a.message,
          source: a.message.includes("[Waze]") ? "osm" : "tomtom",
          extra: a,
        });
      });
    } catch {
      logInfo("No cached alerts to index.");
    }

    fuseIndex = new Fuse(items, {
      keys: ["name", "subtitle", "extra.road_refno", "extra.district", "extra.province", "extra.place"],
      threshold: 0.3,
      includeScore: true,
    });

    logInfo(`Search index refreshed: ${items.length} items`);
  } catch (err: any) {
    logError("Failed to refresh index", err.message);
  }
};

export const searchEntities = async (query: string, limit: number = 10): Promise<SearchResult[]> => {
  if (!query) return [];
  const results: SearchResult[] = [];

  if (fuseIndex) {
    const fuseResults = fuseIndex.search(query, { limit: 50 });
    results.push(...fuseResults.map(r => ({ ...r.item, score: r.score })));
  }

  const highwayMatches = await searchHighways(query);
  results.push(...highwayMatches);

  if (results.length < 3) {
    const externalResults = await searchExternalWithCache(query);
    results.push(...externalResults);
  }

  return injectIncidentContext(results).then(res => res.slice(0, limit));
};

async function searchHighways(query: string): Promise<SearchResult[]> {
  const normQuery = query.toUpperCase().replace(/\s+/g, "");
  const data = await getCachedRoads();
  const monsoonRisks = await getCachedMonsoonRisk();
  if (!data?.merged) return [];

  const highwayMap = new Map<string, any>();

  data.merged.forEach((f: any) => {
    const props = f.properties;
    if (!props) return;
    const ref = (props.road_refno || "").toUpperCase();
    const name = (props.road_refno || props.road_name || "").toUpperCase();

    if (ref.includes(normQuery) || name.includes(normQuery) || props.dist_name?.toUpperCase().includes(normQuery)) {
      const key = ref || name;
      if (!highwayMap.has(key)) {
        const geomCoords = f.geometry?.type === "LineString" ? f.geometry.coordinates[0]
          : f.geometry?.type === "MultiLineString" ? f.geometry.coordinates[0]?.[0]
          : f.geometry?.type === "Point" ? f.geometry.coordinates
          : null;

        if (!geomCoords || geomCoords.length < 2) return;

        highwayMap.set(key, {
          id: `hw-${key}`,
          name: props.road_name || props.road_refno,
          type: "road",
          lat: geomCoords[1],
          lng: geomCoords[0],
          blocked: 0,
          oneWay: 0,
          highRiskMonsoon: 0,
          ref: props.road_refno,
          source: "local",
        });
      }

      const stats = highwayMap.get(key);
      if (props.status === ROAD_STATUS.BLOCKED) stats.blocked++;
      if (props.status === ROAD_STATUS.ONE_LANE) stats.oneWay++;

      const risk = monsoonRisks.find(r => r.roadId === props.id || r.roadId === props.road_refno || r.roadId === props.road_name);
      if (risk && ["HIGH", "EXTREME"].includes(risk.riskLevel)) stats.highRiskMonsoon++;
    }
  });

  return Array.from(highwayMap.values()).map(h => ({
    ...h,
    subtitle: `${h.ref ? "[" + h.ref + "] " : ""}${h.blocked > 0 ? "❌ " + h.blocked + " Blocks" : "✅ Clear"}${h.oneWay > 0 ? " | ⚠️ " + h.oneWay + " One-Lane" : ""
      }${h.highRiskMonsoon > 0 ? " | ⛈️ " + h.highRiskMonsoon + " Monsoon Risks" : ""}`,
    extra: { ...h },
  }));
}

async function injectIncidentContext(results: SearchResult[]): Promise<SearchResult[]> {
  const roads = await getCachedRoads();
  const incidents = roads.merged.filter((f: any) => f.properties && f.properties.status !== ROAD_STATUS.RESUMED);

  return results.map(res => {
    if (res.type !== "location") return res;

    const nearby = incidents.find((inc: any) => {
      if (!inc.geometry?.coordinates) return false;
      let coords: any;
      if (inc.geometry.type === "LineString") coords = inc.geometry.coordinates[0];
      else if (inc.geometry.type === "MultiLineString") coords = inc.geometry.coordinates[0]?.[0];
      else if (inc.geometry.type === "Point") coords = inc.geometry.coordinates;
      if (!coords || coords.length < 2) return false;
      return calculateHaversine(res.lat, res.lng, coords[1], coords[0]) < 2;
    });

    if (nearby) {
      return { ...res, subtitle: `⚠️ Near active ${nearby.properties?.status}: ${nearby.properties?.road_name}`, extra: { ...res.extra, incident: nearby.properties } };
    }
    return res;
  });
}

async function searchExternalWithCache(query: string): Promise<SearchResult[]> {
  try {
    const cacheKey = `search:ext:${query.toLowerCase().replace(/\s+/g, "_")}`;
    const cached = await redisClient.get<SearchResult[]>(cacheKey);
    if (cached) return cached;

    const results = await fetchExternalAPIs(query);
    if (results.length > 0) await redisClient.set(cacheKey, results, { ex: 86400 });
    return results;
  } catch (err: any) {
    logError("External search failed", err.message);
    return [];
  }
}

async function fetchExternalAPIs(query: string): Promise<SearchResult[]> {
  try {
    const locations = await searchLocation(query);
    return locations.map((item: any) => ({
      id: `osm-${item.lat}-${item.lon}`,
      name: item.name,
      type: "location",
      lat: item.lat,
      lng: item.lon,
      subtitle: item.type,
      source: "osm",
    }));
  } catch (err: any) {
    logError("fetchExternalAPIs failed", err.message);
    return [];
  }
}

export async function searchLocation(query: string) {
  try {
    if (!query) return [];
    const url = `${NOMINATIM_API_URL}/search?format=json&q=${encodeURIComponent(query)}&viewbox=80,26,89,31&bounded=1&limit=5`;
    const response = await fetch(url, { headers: { "User-Agent": "MeroSadak-App/1.1.0", "Accept-Language": "en" } });
    if (!response.ok) throw new Error(`Geocoding error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.map((item: any) => {
      const parts = item.display_name.split(",");
      return { name: parts[0], lat: parseFloat(item.lat), lon: parseFloat(item.lon), type: item.type, subtitle: parts.slice(1, 4).join(",").trim() };
    });
  } catch (err: any) {
    logError("searchLocation failed", err.message);
    return [];
  }
}
