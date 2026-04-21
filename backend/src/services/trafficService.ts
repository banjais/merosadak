// backend/src/services/trafficService.ts
// Enhanced traffic service with TomTom flow polylines and Waze alerts

import axios from "axios";
import { logInfo, logError } from "../logs/logs.js";
import { TOMTOM_API_KEY, TOMTOM_API_URL } from "../config/index.js";
import { getCachedRoads } from "./roadService.js";
import type { TrafficFlowSegment, WazeAlert, TrafficResult } from "../types.js";

// Cache for traffic data (5 minutes)
let trafficCache: TrafficResult | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get comprehensive traffic data with TomTom flow + Waze alerts
 */
export async function getTrafficData(
  lat: number,
  lng: number,
  radius: number = 10
): Promise<TrafficResult> {
  // Check cache first
  const now = Date.now();
  if (trafficCache && (now - cacheTimestamp) < CACHE_TTL) {
    logInfo("[TrafficService] Using cached traffic data");
    return trafficCache;
  }

  try {
    const [tomtomSegments, wazeAlerts] = await Promise.allSettled([
      fetchTomTomFlowSegments(lat, lng, radius),
      fetchWazeAlerts()
    ]);

    const segments = tomtomSegments.status === 'fulfilled' ? tomtomSegments.value : [];
    const alerts = wazeAlerts.status === 'fulfilled' ? wazeAlerts.value : [];

    // Calculate summary
    const congested = segments.filter(s =>
      s.congestionLevel === 'medium' || s.congestionLevel === 'high' || s.congestionLevel === 'extreme'
    );

    const result: TrafficResult = {
      flowSegments: segments,
      wazeAlerts: alerts,
      summary: {
        totalSegments: segments.length,
        congestedSegments: congested.length,
        averageSpeed: segments.length > 0
          ? Math.round(segments.reduce((sum, s) => sum + s.currentSpeed, 0) / segments.length)
          : 0,
        averageDelay: segments.length > 0
          ? Math.round(segments.reduce((sum, s) => sum + s.delay, 0) / segments.length)
          : 0
      },
      lastUpdated: new Date().toISOString()
    };

    // Update cache
    trafficCache = result;
    cacheTimestamp = now;

    logInfo(`[TrafficService] Fetched traffic: ${segments.length} segments, ${alerts.length} alerts`);
    return result;
  } catch (err: any) {
    logError("[TrafficService] Failed to fetch traffic data", { error: err.message });
    // Return cached data even if expired on error
    return trafficCache || createEmptyTrafficResult();
  }
}

/**
 * Fetch TomTom traffic flow segments with polylines
 */
async function fetchTomTomFlowSegments(
  lat: number,
  lng: number,
  radius: number
): Promise<TrafficFlowSegment[]> {
  if (!TOMTOM_API_KEY) {
    logInfo("[TrafficService] TomTom API key not configured");
    return [];
  }

  try {
    const url = `${TOMTOM_API_URL}/traffic/flow/segment/json?point=${lat},${lng}&radius=${radius}&key=${TOMTOM_API_KEY}`;

    const response = await axios.get(url, { timeout: 10000 });
    const flowSegments = response.data?.flowSegments || [];

    return flowSegments.map((segment: any, index: number) => {
      const currentSpeed = segment.currentSpeed || 0;
      const freeFlowSpeed = segment.freeFlowSpeed || 60;
      const speedRatio = currentSpeed / freeFlowSpeed;

      // Determine congestion level and color
      let congestionLevel: TrafficFlowSegment['congestionLevel'];
      let color: TrafficFlowSegment['color'];

      if (speedRatio > 0.8) {
        congestionLevel = 'low';
        color = 'green';
      } else if (speedRatio > 0.5) {
        congestionLevel = 'medium';
        color = 'yellow';
      } else if (speedRatio > 0.3) {
        congestionLevel = 'high';
        color = 'orange';
      } else {
        congestionLevel = 'extreme';
        color = 'red';
      }

      // Decode polyline coordinates from TomTom response
      const coordinates = decodePolyline(segment.polyline || segment.coordinates || '');

      return {
        id: `tomtom-${segment.id || index}`,
        coordinates,
        currentSpeed: Math.round(currentSpeed),
        freeFlowSpeed: Math.round(freeFlowSpeed),
        congestionLevel,
        color,
        delay: segment.delaySeconds || 0,
        confidence: segment.confidence || 0.5
      };
    }).filter((s: TrafficFlowSegment) => s.coordinates.length > 1);
  } catch (err: any) {
    logError("[TrafficService] TomTom fetch failed", { error: err.message });
    return [];
  }
}

/**
 * Fetch Waze real-time alerts
 */
async function fetchWazeAlerts(): Promise<WazeAlert[]> {
  try {
    // Use Waze Partner Hub feed
    const WAZE_URL = process.env.WAZE_JSON ||
      'https://www.waze.com/row-partnerhub-api/partners/19031804998/waze-feeds/75887a4e-e8fc-4329-a4c8-7f84be88914e?format=1';

    const response = await axios.get(WAZE_URL, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    const alerts = response.data?.alerts || response.data || [];

    return alerts
      .filter((alert: any) => alert.location?.lat && alert.location?.lon)
      .map((alert: any, index: number) => {
        const type = (alert.type || '').toUpperCase();
        let severity: WazeAlert['severity'] = 'low';

        if (type.includes('ACCIDENT') || type.includes('ROAD_CLOSED')) {
          severity = 'high';
        } else if (type.includes('HAZARD') || type.includes('JAM')) {
          severity = 'medium';
        }

        return {
          id: alert.uuid || alert.id || `waze-${index}`,
          type,
          subtype: alert.subType || '',
          location: {
            lat: alert.location.lat,
            lng: alert.location.lon
          },
          description: alert.description || alert.comment || alert.type || 'Traffic alert',
          severity,
          timestamp: alert.pubDate || new Date().toISOString()
        };
      });
  } catch (err: any) {
    logError("[TrafficService] Waze fetch failed", { error: err.message });
    return [];
  }
}

/**
 * Decode TomTom polyline string to [lat, lng] coordinates
 */
function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];

  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lat / 1E5, lng / 1E5]);
  }

  return coordinates;
}

/**
 * Create empty traffic result
 */
function createEmptyTrafficResult(): TrafficResult {
  return {
    flowSegments: [],
    wazeAlerts: [],
    summary: {
      totalSegments: 0,
      congestedSegments: 0,
      averageSpeed: 0,
      averageDelay: 0
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Clear traffic cache (for manual refresh)
 */
export function clearTrafficCache(): void {
  trafficCache = null;
  cacheTimestamp = 0;
  logInfo("[TrafficService] Cache cleared");
}

// Aliases for backward compatibility
export const refreshTrafficCache = clearTrafficCache;
export const getCachedTraffic = getTrafficData;
