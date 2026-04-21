import Fuse from "fuse.js";
import crypto from "crypto";
import { logInfo, logError } from "@logs/logs.js";
import { redisClient } from "@/services/cacheService.js";
import { getCachedRoads, roadCacheTimestamp } from "@/services/roadService.js";
import { ROAD_STATUS } from "@/constants/sheets.js";
import { CACHE_ALERTS, LOCAL_DATA, HIGHWAY_DATA } from "@/config/paths.js";
import { getDistrictMapping } from "@/services/highwayService.js";
import fs from "fs/promises";
import { getCachedMonsoonRisk, monsoonCacheTimestamp } from "@/services/monsoonService.js";
import { poiCacheTimestamp } from "@/controllers/poiService.js";
import { NOMINATIM_API_URL } from "@/config/index.js";
import { resolveLabel } from "@/services/labelUtils.js";
import { haversineDistance } from "@/services/geoUtils.js";
import type { SearchResult } from "@/types.js";
import { checkGeofence } from "@/services/geofenceService.js";
import { recordAnalytics, getFrequentQueries } from "@/services/analyticsService.js";

let fuseIndex: Fuse<SearchResult> | null = null;
let lastIndexBuiltTime = 0;
let isRefreshingIndex = false;

/**
 * Internal helper for localizing search-specific UI strings
 */
function getLocalizedText(key: string, lang: string): string {
  const dict: Record<string, Record<string, string>> = {
    ne: {
      "Blocked": "अवरोध",
      "One-Lane": "एकतर्फी",
      "Resumed": "सुचारु",
      "Blocks": "अवरोधहरू",
      "Clear": "खुल्ला",
      "Monsoon Risks": "मनसुन जोखिमहरू",
      "Near active": "नजिकै सक्रिय",
    }
  };
  return dict[lang]?.[key] || key;
}

export const refreshIndexFromCaches = async () => {
  if (isRefreshingIndex) {
    logInfo("[SearchService] Index refresh already in progress. Ignoring request.");
    return;
  }

  try {
    isRefreshingIndex = true;
    const latestDataTime = Math.max(roadCacheTimestamp, monsoonCacheTimestamp, poiCacheTimestamp);

    if (fuseIndex && lastIndexBuiltTime >= latestDataTime) {
      logInfo("[SearchService] Search index is current with Roads, Monsoon, and POI data. Skipping rebuild.");
      return;
    }

    const roadData = await getCachedRoads();
    const monsoonRisks = (await getCachedMonsoonRisk()) || [];
    const districtMapping = await getDistrictMapping();
    const items: SearchResult[] = [];

    // Helper to get province from district
    const getProvince = (distName: string): string => {
      if (!distName) return "";
      return districtMapping[distName] || districtMapping[distName.replace(/\s+/g, "")] || "";
    };

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
        name: resolveLabel(props.road_name, "en") || props.road_refno,
        type: "road",
        lat: coords[1],
        lng: coords[0],
        subtitle: `${getProvince(props.dist_name)}${props.dist_name ? ` • ` : ''}${props.div_name ? `${props.div_name} Div` : ''}${props.pave_type ? ` • ${props.pave_type}` : ''}${risk && ["HIGH", "EXTREME"].includes(risk.riskLevel) ? ` • ⛈️ Risk` : ''}`,
        source: "local",
extra: {
           ...props,
           province: getProvince(props.dist_name),
           riskLevel: risk?.riskLevel,
           road_name: resolveLabel(props.road_name, "en"),
           road_name_ne: resolveLabel(props.road_name, "ne"),
           remarks: resolveLabel(props.remarks, "en"),
           remarks_ne: resolveLabel(props.remarks, "ne"),
           incidentDistrict: resolveLabel(props.incidentDistrict, "en"),
           incidentDistrict_ne: resolveLabel(props.incidentDistrict, "ne"),
           incidentPlace: resolveLabel(props.incidentPlace, "en"),
           incidentPlace_ne: resolveLabel(props.incidentPlace, "ne")
         },
      });
    });

    try {
      const alertsRaw = await fs.readFile(CACHE_ALERTS, "utf-8");
      const alerts = JSON.parse(alertsRaw);
      alerts.forEach((a: any) => {
        items.push({
          id: `alert-${crypto.randomUUID().substring(0, 8)}`,
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

    // Fetch POIs from Redis to include in search index
    try {
      const poiData = await redisClient?.get<SearchResult[]>("poi:all");
      if (poiData && Array.isArray(poiData)) {
        poiData.forEach(p => {
          items.push({
            ...p,
            id: `poi-${p.id}`,
            source: "local-poi",
          });
        });
      }
    } catch (err: any) {
      logInfo("No cached POIs to index.");
    }

    // Fetch Local Bodies (municipalities) to include in search index
    try {
      const localDataRaw = await fs.readFile(LOCAL_DATA, "utf-8");
      const localData = JSON.parse(localDataRaw);
      if (localData.features && Array.isArray(localData.features)) {
        localData.features.forEach((f: any) => {
          const props = f.properties;
          if (!props) return;
          
          // Get centroid for search result
          let lat = 0, lng = 0;
          if (f.geometry?.type === "Polygon" && f.geometry?.coordinates?.[0]) {
            const coords = f.geometry.coordinates[0];
            lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
            lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
          } else if (f.geometry?.type === "MultiPolygon" && f.geometry?.coordinates?.[0]?.[0]) {
            const coords = f.geometry.coordinates[0][0];
            lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
            lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
          }

          items.push({
            id: `local-${props.gnid || props.FIRST_GN_C}`,
            name: props.FIRST_GaPa || props.GNP || "Unknown",
            type: "location",
            lat,
            lng,
            subtitle: `${props.District || ""} • ${props.FIRST_Type || "Local Body"}`,
            source: "local-body",
            extra: {
              localBodyName: props.FIRST_GaPa,
              localBodyNameNe: props.GNP,
              district: props.District,
              districtCode: props.FIRST_DCOD,
              type: props.FIRST_Type,
              level: props.Level,
            },
          });
        });
      }
    } catch {
      logInfo("No local bodies data to index.");
    }

    // Fetch Highway metadata (codes, names, lengths, districts)
    try {
      const highwayIndexRaw = await fs.readFile(HIGHWAY_DATA, "utf-8");
      const highwayIndex = JSON.parse(highwayIndexRaw);
      if (Array.isArray(highwayIndex)) {
        highwayIndex.forEach((hw: any) => {
          if (!hw.code || !hw.name) return;
          
          items.push({
            id: `highway-${hw.code}`,
            name: hw.name,
            type: "highway",
            lat: 0, lng: 0, // No centroid - highways span many coords
            subtitle: `${hw.code} • ${hw.lengthKm ? hw.lengthKm.toFixed(0) + ' km' : ''} • ${hw.districts?.slice(0, 3).join(', ')}${hw.districts?.length > 3 ? '...' : ''}`,
            source: "highway",
            extra: {
              highwayCode: hw.code,
              highwayName: hw.name,
              route: hw.route,
              lengthKm: hw.lengthKm,
              districts: hw.districts,
            },
          });
        });
      }
    } catch {
      logInfo("No highway index data to index.");
    }

    // Fetch frequent searches and inject into index
    try {
      const frequent = await getFrequentQueries(8);
      frequent.forEach(q => {
        items.push({
          id: `freq-${crypto.createHash('md5').update(q).digest('hex').substring(0, 6)}`,
          name: q,
          type: "location", // Using location type so it appears in standard results
          subtitle: "Frequent Search",
          source: "local",
          lat: 0, lng: 0, // Non-spatial suggestion
          extra: {}
        });
      });
    } catch { /* Analytics might be empty */ }

    fuseIndex = new Fuse(items, {
      keys: [
        "name",
        "subtitle",
        "extra.road_refno",
        "extra.road_name",
        "extra.road_name_ne",
        "extra.remarks",
        "extra.remarks_ne",
        "extra.incidentDistrict",
        "extra.incidentDistrict_ne",
        "extra.incidentPlace",
        "extra.incidentPlace_ne",
        "extra.dist_name",
        "extra.province",
        "extra.localBodyName",
        "extra.localBodyNameNe",
        "extra.district",
        "extra.type",
        "extra.highwayCode",
        "extra.highwayName",
        "extra.route",
        "extra.lengthKm",
        "extra.districts",
        // Road segment details
        "extra.dist_name",
        "extra.div_name",
        "extra.link_name",
        "extra.link_len",
        "extra.pave_type",
        "extra.no_lanes",
        "extra.iri_value",
        "extra.aadt_value"
      ],
      threshold: 0.3,
      includeScore: true,
    });

    lastIndexBuiltTime = Date.now();
    logInfo(`Search index refreshed: ${items.length} items`);
  } catch (err: any) {
    logError("Failed to refresh index", err.message);
  } finally {
    isRefreshingIndex = false;
  }
};

// Intent detection keywords
const INTENT_KEYWORDS = {
  weather: ["weather", "mausam", "weather"],
  traffic: ["traffic", "block", "blocked", "congestion", "road status"],
  highway: ["highway", "nh", "road", "prithvi", "mid hill"],
  monsoon: ["monsoon", "rain", "flood", "landslide", "j品类"],
  poisson: ["hotel", "restaurant", "petrol", "hospital", "bank", "atm"],
};

type SearchIntent = "location" | "weather" | "highway" | "traffic" | "monsoon" | "poi" | "general";

function detectIntent(query: string): SearchIntent {
  const q = query.toLowerCase();
  
  // Check explicit intent keywords
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(k => q.includes(k))) {
      return intent as SearchIntent;
    }
  }
  
  // Check highway code pattern (NH01, NH-01, hwy01)
  if (/^nh[\d-]+$/i.test(q) || /^highway\s*[\d-]*$/i.test(q)) {
    return "highway";
  }
  
  // Check if matches local body name or district
  if (fuseIndex) {
    const results = fuseIndex.search(q, { limit: 3 });
    const sources = new Set(results.map(r => r.item.source));
    if (sources.has("local-body")) return "location";
    if (sources.has("highway")) return "highway";
  }
  
  return "general";
}

// Get intent-based suggestions
export const getSearchSuggestions = async (query: string): Promise<{ type: SearchIntent; results: SearchResult[] }[]> => {
  if (!query || query.length < 2) return [];
  
  const intent = detectIntent(query);
  const suggestions: { type: SearchIntent; results: SearchResult[] }[] = [];
  
  // Always include location-based results
  if (fuseIndex) {
    const locationResults = fuseIndex.search(query, { limit: 5 });
    suggestions.push({
      type: "location",
      results: locationResults.map(r => ({
        ...r.item,
        type: r.item.source === "local-body" ? "location" : r.item.type,
      })),
    });
  }
  
  return suggestions;
};

export const searchEntities = async (query: string, location?: { lat: number; lng: number }, limit: number = 10, lang: string = "en"): Promise<SearchResult[]> => {
  if (!query) return [];
  const results: SearchResult[] = [];
  
  // Detect intent and adjust search behavior
  const intent = detectIntent(query);
  const normQuery = query.toUpperCase().replace(/\s+/g, "");
  
  // Highway code normalization (NH01 -> Mahendra Highway)
  const highwayCodeMatch = normQuery.match(/^NH(\d+)$/i);
  if (highwayCodeMatch) {
    const hwNum = highwayCodeMatch[1];
    const highwaySearchResults = fuseIndex.search(`NH${hwNum}`, { limit: 3, threshold: 0.4 });
    if (highwaySearchResults.length > 0) {
      results.push(...highwaySearchResults.map(r => ({ ...r.item, score: r.score, intent: "highway" as const })));
    }
  }

  if (fuseIndex) {
    // Adjust threshold based on intent (more strict for specific intents)
    const threshold = intent === "highway" ? 0.2 : intent === "weather" ? 0.4 : 0.35;
    const fuseResults = fuseIndex.search(query, { limit: 50, threshold });
    results.push(...fuseResults.map(r => {
      const item = { ...r.item, score: r.score };

      // Apply real-time localization for road segments
      if (lang === "ne" && item.type === "road" && item.extra) {
        item.name = item.extra.road_name_ne || item.name;
        const localizedStatus = getLocalizedText(item.extra.status, "ne");
        const localizedRisk = item.subtitle?.includes("Monsoon Risk")
          ? ` | ⛈️ ${getLocalizedText("Monsoon Risks", "ne")}`
          : "";
        item.subtitle = `${localizedStatus}${localizedRisk}`;
      }

      // Apply Nepali localization for local bodies
      if (lang === "ne" && item.source === "local-body" && item.extra) {
        item.name = item.extra.localBodyNameNe || item.name;
      }

      return item;
    }));
  }

  const highwayMatches = await searchHighways(query, lang);
  results.push(...highwayMatches);

  if (results.length < 3) {
    const externalResults = await searchExternalWithCache(query);
    results.push(...externalResults);
  }

  let processedResults = await injectIncidentContext(results, lang);

  // Proximity-based filtering and sorting if a location is provided
  if (location) {
    const SEARCH_RADIUS_KM = 500; // Limit relevance to a 500km radius (covers Nepal regions)
    processedResults = processedResults.filter(result => {
      if (result.lat && result.lng) {
        const dist = haversineDistance(location.lat, location.lng, result.lat, result.lng);
        result.distance = dist;
        return dist <= SEARCH_RADIUS_KM;
      }
      return true; // Keep results without coordinates (like general highways or local data)
    });

    processedResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
  }

  // Secondary sort by safety score (descending) and then Fuse score (ascending)
  return processedResults.sort((a, b) => {
    const safetyDiff = (b.safety_score ?? 100) - (a.safety_score ?? 100);
    if (safetyDiff !== 0) return safetyDiff;
    return (a.score || 0) - (b.score || 0);
  }).slice(0, limit);
};

async function searchHighways(query: string, lang: string = "en"): Promise<SearchResult[]> {
  const normQuery = query.toUpperCase().replace(/\s+/g, "");
  const data = await getCachedRoads();
  const monsoonRisks = await getCachedMonsoonRisk();
  if (!data?.merged) return [];

  const highwayMap = new Map<string, any>();

  data.merged.forEach((f: any) => {
    const props = f.properties;
    if (!props) return;
    const ref = (props.road_refno || "").toUpperCase();
    const name = (props.road_refno || resolveLabel(props.road_name, "en") || "").toUpperCase();
    const nameNe = resolveLabel(props.road_name, "ne");

    // Resolve district name from either Label object (incidents) or string (highway segments)
    const district = resolveLabel(props.incidentDistrict, "en") || props.dist_name || "";
    const districtNe = resolveLabel(props.incidentDistrict, "ne") || "";

    if (
      ref.includes(normQuery) ||
      name.includes(normQuery) ||
      nameNe.toLowerCase().includes(query.toLowerCase()) ||
      district.toUpperCase().includes(normQuery) ||
      districtNe.toLowerCase().includes(query.toLowerCase())
    ) {
      const key = ref || name;
      if (!highwayMap.has(key)) {
        const geomCoords = f.geometry?.type === "LineString" ? f.geometry.coordinates[0]
          : f.geometry?.type === "MultiLineString" ? f.geometry.coordinates[0]?.[0]
            : f.geometry?.type === "Point" ? f.geometry.coordinates
              : null;

        if (!geomCoords || geomCoords.length < 2) return;

        highwayMap.set(key, {
          id: `hw-${key}`,
          name: resolveLabel(props.road_name, lang) || props.road_refno,
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

  return Array.from(highwayMap.values()).map(h => {
    const subtitle = `${h.ref ? "[" + h.ref + "] " : ""}${h.blocked > 0 ? "❌ " + h.blocked + " " + getLocalizedText("Blocks", lang) : "✅ " + getLocalizedText("Clear", lang)}${h.oneWay > 0 ? " | ⚠️ " + h.oneWay + " " + getLocalizedText("One-Lane", lang) : ""
      }${h.highRiskMonsoon > 0 ? " | ⛈️ " + h.highRiskMonsoon + " " + getLocalizedText("Monsoon Risks", lang) : ""}`;

    return {
      ...h,
      subtitle,
      extra: { ...h },
    };
  });
}

async function injectIncidentContext(results: SearchResult[], lang: string = "en"): Promise<SearchResult[]> {
  const roads = await getCachedRoads();
  const incidents = roads.merged.filter((f: any) => f.properties && f.properties.status !== ROAD_STATUS.RESUMED);

  return results.map(res => {
    // 1. Geofencing check for danger zones
    const geofences = checkGeofence({ lat: res.lat, lng: res.lng });
    const activeDangerZone = geofences.find(g => g.inside && g.zone.riskLevel !== 'low');

    let safetyScore = 100;

    if (activeDangerZone) {
      const level = activeDangerZone.zone.riskLevel;
      if (level === 'critical') safetyScore = 10;
      else if (level === 'high') safetyScore = 40;
      else if (level === 'medium') safetyScore = 70;

      res.subtitle = `⚠️ [${activeDangerZone.zone.riskLevel.toUpperCase()} RISK] ${activeDangerZone.zone.name} | ${res.subtitle}`;
      res.extra = { ...res.extra, dangerZone: activeDangerZone.zone };
    }

    // 2. Incident Proximity check (Road hazards)
    if (res.type !== "location" && res.type !== "poi") return res;

    const nearby = incidents.find((inc: any) => {
      if (!inc.geometry?.coordinates) return false;
      let coords: any;
      if (inc.geometry.type === "LineString") coords = inc.geometry.coordinates[0];
      else if (inc.geometry.type === "MultiLineString") coords = inc.geometry.coordinates[0]?.[0];
      else if (inc.geometry.type === "Point") coords = inc.geometry.coordinates;
      if (!coords || coords.length < 2) return false;
      return haversineDistance(res.lat, res.lng, coords[1], coords[0]) < 2;
    });

    if (nearby) {
      safetyScore = Math.min(safetyScore, 60); // Incident presence lowers score

      const localizedPrefix = getLocalizedText("Near active", lang);
      const status = getLocalizedText(nearby.properties?.status, lang);
      const name = resolveLabel(nearby.properties?.road_name, lang);

      return {
        ...res,
        subtitle: `🚦 ${localizedPrefix} ${status}: ${name} | ${res.subtitle}`,
        safety_score: safetyScore,
        extra: { ...res.extra, incident: nearby.properties }
      };
    }

    return {
      ...res,
      safety_score: safetyScore
    };
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

    // 1. First search local index (local bodies + roads + POIs)
    if (fuseIndex) {
      const localResults = fuseIndex.search(query, { limit: 5 });
      const formattedLocal = localResults
        .filter(r => r.item.lat && r.item.lng) // Only spatial results
        .map(r => ({
          name: r.item.name,
          lat: r.item.lat,
          lon: r.item.lng,
          type: r.item.source || r.item.type,
          subtitle: r.item.subtitle || "",
          source: "local"
        }));
      
      if (formattedLocal.length > 0) {
        logInfo(`[searchLocation] Found ${formattedLocal.length} local results for "${query}"`);
        return formattedLocal;
      }
    }

    // 2. Fall back to external Nominatim API for broader place search
    logInfo(`[searchLocation] No local results for "${query}", falling back to Nominatim...`);
    const baseUrl = (NOMINATIM_API_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
    const url = `${baseUrl}/search?format=json&q=${encodeURIComponent(query)}&viewbox=80.0,26.3,88.3,30.5&bounded=1&limit=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const response = await fetch(url, {
      headers: { "User-Agent": "MeroSadak-App/1.1.0", "Accept-Language": "en" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Geocoding error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.map((item: any) => {
      const parts = item.display_name.split(",");
      return { name: parts[0], lat: parseFloat(item.lat), lon: parseFloat(item.lon), type: item.type, subtitle: parts.slice(1, 4).join(",").trim(), source: "osm" };
    });
  } catch (err: any) {
    logError("searchLocation failed", err.message);
    return [];
  }
}

/**
 * Unified search entry point for the controller.
 * Wraps searchEntities to provide a simplified interface that supports
 * location-aware results in the future.
 */
export const search = async (query: string, location?: { lat: number; lng: number }): Promise<SearchResult[]> => {
  const results = await searchEntities(query, location);

  // Record search analytics
  if (query.length > 1) {
    const topResult = results[0];
    const category = topResult ? topResult.type : "unknown";

    // Log the general search, specific category, and the exact query frequency
    await recordAnalytics("search_performed", { query });
    await recordAnalytics(`search_query_${query.toLowerCase().trim()}`);
    await recordAnalytics(`search_category_${category}`);
  }

  return results;
};
