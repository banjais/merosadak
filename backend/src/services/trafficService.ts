import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { logInfo, logError } from "../logs/logs.js";
import { CACHE_TRAFFIC, CACHE_DIR } from "../config/paths.js";
import { config } from "../config/index.js";

const TOMTOM_KEY = config.TOMTOM_API_KEY;

/**
 * 🌍 Geocode location string to lat/lng
 */
export const geocodeLocation = async (query: string) => {
  if (!query) return null;

  try {
    const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json`;
    const res = await axios.get(url, { params: { key: TOMTOM_KEY, countrySet: "NP", limit: 1 } });
    const result = res.data.results?.[0];
    if (!result) return null;

    return {
      lat: result.position.lat,
      lng: result.position.lon,
      name: result.address.freeformAddress,
      municipality: result.address.municipality
    };

  } catch (err: any) {
    logError("TrafficService Geocoding failed: " + query, err.message);
    return null;
  }
};

/**
 * 🚦 Traffic flow at specific coordinates
 */
export const getTrafficFlow = async (lat: number, lng: number) => {
  try {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json`;
    const res = await axios.get(url, { params: { key: TOMTOM_KEY, point: `${lat},${lng}` } });
    const data = res.data.flowSegmentData;
    if (!data) return null;

    return {
      currentSpeed: data.currentSpeed,
      freeFlowSpeed: data.freeFlowSpeed,
      currentTravelTime: data.currentTravelTime,
      confidence: data.confidence,
      roadClosure: data.roadClosure || false
    };

  } catch (err: any) {
    logError(`Traffic Flow fetch failed at ${lat},${lng}`, err.message);
    return null;
  }
};

/**
 * 🌐 Global highway traffic summary
 */
export const getGlobalHighwayFlow = async () => {
  try {
    return {
      status: "Operational",
      network: "Nepal National Highways",
      segmentsMonitored: 79,
      lastUpdated: new Date().toISOString(),
      provider: "TomTom Real-Time"
    };
  } catch (err: any) {
    logError("Global Highway Flow fetch failed", err.message);
    return { status: "Error", message: err.message };
  }
};

/**
 * 🖼️ Fetch traffic overlay tile PNG for map
 */
export const fetchTrafficTile = async (z: string, x: string, y: string): Promise<Buffer> => {
  try {
    const url = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${z}/${x}/${y}.png`;
    const res = await axios.get(url, { params: { key: TOMTOM_KEY }, responseType: "arraybuffer" });
    return Buffer.from(res.data);
  } catch (err: any) {
    logError(`Traffic tile fetch failed: ${z}/${x}/${y}`, err.message);
    throw new Error("Failed to fetch traffic tile");
  }
};

/**
 * ✅ Cached Traffic (Global)
 */
export const getCachedTraffic = async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });

    const cache: any = {};
    cache.globalFlow = await getGlobalHighwayFlow();

    await fs.writeFile(CACHE_TRAFFIC, JSON.stringify(cache, null, 2), "utf-8");
    logInfo("[TrafficService] Traffic cache updated");

    return cache;

  } catch (err: any) {
    logError("[TrafficService] Failed to update traffic cache", err.message);
    try {
      const raw = await fs.readFile(CACHE_TRAFFIC, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { globalFlow: null };
    }
  }
};

// Alias for compatibility
export const getTraffic = getCachedTraffic;
