import Fuse from 'fuse.js';
import { logInfo, logError } from '../logs/logs.js';
import { redisClient } from './cacheService.js'; // Upstash Redis
import * as weatherService from './weatherService.js';
import { getCachedRoads, calculateHaversine } from './roadService.js';
import { ROAD_STATUS } from '../constants/sheets.js';
import { CACHE_ALERTS } from '../config/paths.js';
import fs from 'fs/promises';
import { getRealWeather } from './weatherService.js';
import { searchPOIs } from './poiService.js';
import { getTrafficFlow } from './trafficService.js';
import { getCachedMonsoonRisk } from './monsoonService.js';

export interface SearchResult {
  id: string;
  name: string;
  type: 'road' | 'traffic' | 'poi' | 'location' | 'weather';
  lat: number;
  lng: number;
  subtitle?: string;
  source: 'local' | 'tomtom' | 'osm' | 'weather';
  score?: number;
  extra?: any;
}

/** ------------------------
 * Local Fuse.js Index
 * ------------------------ */
let fuseIndex: Fuse<SearchResult> | null = null;

/**
 * 🔄 Refresh Search Index from all local caches
 * Called by Scheduler after successful data sync
 */
export const refreshIndexFromCaches = async () => {
  try {
    const roadData = await getCachedRoads();
    const items: SearchResult[] = [];

    // 1. Index Roads/Highways
    if (roadData && roadData.features) {
       roadData.features.forEach((f: any) => {
         const name = f.properties.road_name || f.properties.road_refno;
         if (name) {
           items.push({
             id: `road-${f.properties.id || f.properties.road_refno}`,
             name,
             type: 'road',
             lat: f.geometry.coordinates[0][1] || f.geometry.coordinates[1],
             lng: f.geometry.coordinates[0][0] || f.geometry.coordinates[0],
             subtitle: `${f.properties.road_refno ? '['+f.properties.road_refno+']' : ''} Status: ${f.properties.status}`,
             source: 'local',
             extra: f.properties
           });
         }
       });
    }

    // 2. Index Points of Interest & Alerts
    try {
      const alertsRaw = await fs.readFile(CACHE_ALERTS, "utf-8");
      const alerts = JSON.parse(alertsRaw);
      alerts.forEach((a: any) => {
        items.push({
          id: `alert-${Date.now()}-${Math.random()}`,
          name: a.type,
          type: 'traffic', // Use traffic type for alerting UI
          lat: a.lat,
          lng: a.lng,
          subtitle: a.message,
          source: a.message.includes('[Waze]') ? 'osm' : 'tomtom', // Hack for icon mapping
          extra: a
        });
      });
    } catch {
      logInfo("No cached alerts to index.");
    }

    fuseIndex = new Fuse(items, { 
      keys: ['name', 'subtitle'], 
      threshold: 0.3,
      includeScore: true
    });

    logInfo(`🔍 Search Index Refreshed: ${items.length} segments indexed`);
  } catch (err: any) {
    logError("❌ [SearchService] Index refresh failed", err.message);
  }
};

/** ------------------------
 * External Search with Cache
 * ------------------------ */
const searchExternalWithCache = async (query: string): Promise<SearchResult[]> => {
  const cacheKey = `search:ext:${query.toLowerCase().replace(/\s+/g, '_')}`;

  try {
    const cached = await redisClient.get<SearchResult[]>(cacheKey);
    if (cached) {
      logInfo(`☁️ Search Cache Hit: "${query}"`);
      return cached;
    }

    // Fetch external APIs (TomTom / OSM / Weather)
    const results = await fetchExternalAPIs(query);

    if (results.length > 0) {
      await redisClient.set(cacheKey, results, { ex: 86400 }); // cache 24h
      logInfo(`☁️ Cached External Search: "${query}"`);
    }

    return results;
  } catch (err: any) {
    logError("[SearchService] External search failed", err.message);
    return [];
  }
};

/** ------------------------
 * Main Search Function
 * ------------------------ */
export const searchEntities = async (query: string, limit: number = 10): Promise<SearchResult[]> => {
  if (!query) return [];

  const lowerQuery = query.trim().toLowerCase();
  let results: SearchResult[] = [];

  // ⭐ 0. Smart Intent Detection (Traffic / Weather / POIs)
  const smartResults = await handleSmartIntent(lowerQuery);
  if (smartResults.length > 0) {
    results = [...results, ...smartResults];
  }

  // ⭐ 1. Highway Code/Name Detection
  const highwayResults = await searchHighways(query);
  results = [...results, ...highwayResults];

  // 2. Local Fuse.js search (incidents, POIs)
  if (fuseIndex) {
    const localMatches = fuseIndex.search(query, { limit: 5 });
    results = [...results, ...localMatches.map(r => ({ ...r.item, score: r.score }))];
  }

  // 3. External fallback (Nepal restricted)
  if (results.length < 3) {
    const externalResults = await searchExternalWithCache(query);
    results = [...results, ...externalResults];
  }

  // 4. Incident Context Injection
  results = await injectIncidentContext(results);

  return results.slice(0, limit);
};

/**
 * ⚡ Smart Intent Handler: Keywords + Geocoding
 */
async function handleSmartIntent(query: string): Promise<SearchResult[]> {
  const weatherKeywords = ['weather', 'rain', 'temp', 'forecast', 'mausam'];
  const trafficKeywords = ['traffic', 'jam', 'crowd', 'slow', 'bhid'];
  const poiKeywords = ['hospital', 'fuel', 'petrol', 'atm', 'bank', 'police'];

  const hasWeather = weatherKeywords.some(k => query.includes(k));
  const hasTraffic = trafficKeywords.some(k => query.includes(k));
  const hasPOI = poiKeywords.find(k => query.includes(k));

  if (!hasWeather && !hasTraffic && !hasPOI) return [];

  // Extract clean place (remove keywords)
  let cleanPlace = query;
  [...weatherKeywords, ...trafficKeywords, ...poiKeywords].forEach(k => {
    cleanPlace = cleanPlace.replace(k, '').trim();
  });

  if (!cleanPlace) return []; // Only keyword found, no place

  // Geocode the place first
  const locations = await searchLocation(cleanPlace);
  if (locations.length === 0) return [];
  const loc = locations[0]; // Take best match

  const intents: SearchResult[] = [];

  if (hasWeather) {
    try {
      const w = await getRealWeather(loc.lat, loc.lon);
      intents.push({
        id: `smart-weather-${loc.lat}-${loc.lon}`,
        name: `${loc.name} Weather`,
        type: 'weather',
        lat: loc.lat,
        lng: loc.lon,
        subtitle: `🌡️ ${w.temp}°C | ${w.icon} ${w.condition} | 💧 ${w.humidity}%`,
        source: 'weather',
        extra: w
      });
    } catch {}
  }

  if (hasTraffic) {
    try {
      const t = await getTrafficFlow(loc.lat, loc.lon);
      intents.push({
        id: `smart-traffic-${loc.lat}-${loc.lon}`,
        name: `${loc.name} Traffic`,
        type: 'traffic',
        lat: loc.lat,
        lng: loc.lon,
        subtitle: t ? `🚗 ${t.currentSpeed}km/h (Flow: ${t.confidence > 0.8 ? 'Good' : 'Congested'})` : '📡 Signal search for traffic...',
        source: 'tomtom',
        extra: t
      });
    } catch {}
  }

  if (hasPOI) {
    try {
      const p = await searchPOIs(hasPOI, loc.lat, loc.lon);
      if (p.length > 0) {
        intents.push({
          id: `smart-poi-${loc.lat}-${loc.lon}`,
          name: `${p[0].name}`,
          type: 'poi',
          lat: p[0].location.lat,
          lng: p[0].location.lng,
          subtitle: `📍 Near ${loc.name} (${p[0].category})`,
          source: 'tomtom',
          extra: p[0]
        });
      }
    } catch {}
  }

  return intents;
}

/**
 * 🛣️ Search for Highways by Ref No (NH01) or Name
 */
async function searchHighways(query: string): Promise<SearchResult[]> {
  const normQuery = query.toUpperCase().replace(/\s+/g, '');
  const data = await getCachedRoads();
  const monsoonRisks = await getCachedMonsoonRisk();
  
  if (!data || !data.features) return [];

  const highwayMap = new Map<string, any>();

  data.features.forEach((f: any) => {
    const ref = (f.properties.road_refno || "").toUpperCase();
    const name = (f.properties.road_refno || f.properties.road_name || "").toUpperCase();
    
    if (ref.includes(normQuery) || name.includes(normQuery)) {
      const key = ref || name;
      if (!highwayMap.has(key)) {
        highwayMap.set(key, {
          id: `hw-${key}`,
          name: f.properties.road_name || f.properties.road_refno,
          type: 'road',
          lat: f.geometry.coordinates[0][1] || f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0][0] || f.geometry.coordinates[0],
          segments: 0,
          blocked: 0,
          oneWay: 0,
          highRiskMonsoon: 0,
          ref: f.properties.road_refno,
          source: 'local'
        });
      }
      
      const stats = highwayMap.get(key);
      stats.segments++;
      if (f.properties.status === ROAD_STATUS.BLOCKED) stats.blocked++;
      if (f.properties.status === ROAD_STATUS.ONE_LANE) stats.oneWay++;

      // Check Monsoon Risk for this segment
      const risk = monsoonRisks.find(r => r.roadId === f.properties.id || r.roadId === f.properties.road_refno);
      if (risk && (risk.riskLevel === 'HIGH' || risk.riskLevel === 'EXTREME')) {
        stats.highRiskMonsoon++;
      }
    }
  });

  return Array.from(highwayMap.values()).map(h => ({
    ...h,
    subtitle: `${h.ref ? '['+h.ref+'] ' : ''}${h.blocked > 0 ? '❌ ' + h.blocked + ' Blocks' : '✅ Clear'}${h.oneWay > 0 ? ' | ⚠️ ' + h.oneWay + ' One-Way' : ''}${h.highRiskMonsoon > 0 ? ' | ⛈️ ' + h.highRiskMonsoon + ' Monsoon Risks' : ''}`,
    extra: { ...h }
  }));
}

/**
 * 📍 Check if found locations are near any active incidents
 */
async function injectIncidentContext(results: SearchResult[]): Promise<SearchResult[]> {
  const roads = await getCachedRoads();
  const incidents = roads.features.filter((f: any) => f.properties.status !== ROAD_STATUS.RESUMED);

  return results.map(res => {
    if (res.type !== 'location') return res;

    const nearby = incidents.find((inc: any) => {
      const incCoords = inc.geometry.type === "LineString" ? inc.geometry.coordinates[0] : inc.geometry.coordinates;
      return calculateHaversine(res.lat, res.lng, incCoords[1], incCoords[0]) < 2; // 2km radius
    });

    if (nearby) {
      return {
        ...res,
        subtitle: `⚠️ Near active ${nearby.properties.status}: ${nearby.properties.road_name}`,
        extra: { ...res.extra, incident: nearby.properties }
      };
    } else if (res.source === 'osm') {
      return {
        ...res,
        subtitle: `✅ Road currently reported clear in this area.`
      };
    }
    return res;
  });
}

/** ------------------------
 * Fetch from external APIs
 * ------------------------ */
async function fetchExternalAPIs(query: string): Promise<SearchResult[]> {
  try {
    // 1️⃣ Nominatim (OSM) search
    const results = await searchLocation(query);
    
    return results.map(item => ({
      id: `osm-${item.lat}-${item.lon}`,
      name: item.name,
      type: 'location',
      lat: item.lat,
      lng: item.lon,
      subtitle: item.type,
      source: 'osm'
    }));
  } catch (err: any) {
    logError("[SearchService] fetchExternalAPIs failed", err.message);
    return [];
  }
}

/**
 * 📍 Search coordinates using OpenStreetMap Nominatim
 */
export async function searchLocation(query: string) {
  try {
    if (!query) return [];

    // 🇳🇵 Restricted to Nepal Bounding Box
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&viewbox=80,26,89,31&bounded=1&limit=5`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Sadak-Sathi-App/1.1.0",
        "Accept-Language": "en",
      },
    });

    if (!response.ok)
      throw new Error(
        `Geocoding provider (OSM) error: ${response.status} ${response.statusText}`
      );

    const data = await response.json();

    return data.map((item: any) => {
      const parts = item.display_name.split(',');
      const shortName = parts[0];
      const context = parts.slice(1, 4).join(',').trim(); // Get district/region context

      return {
        name: shortName,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        subtitle: context
      };
    });
  } catch (err: any) {
    logError("[searchService] searchLocation failed", { error: err.message });
    return [];
  }
}
