import { Highway, RoadIncident, HighwayWeatherNode, HighwayPOI, TrafficCorridor, KnownBlackspot, CityNode } from '../types';
import {
  NEPAL_HIGHWAYS as INITIAL_HIGHWAYS,
  CITIES_AND_JUNCTIONS as INITIAL_CITIES,
  LIVE_ROAD_INCIDENTS as INITIAL_INCIDENTS,
  HIGHWAY_WEATHER_NODES as INITIAL_WEATHER,
  HIGHWAY_POIS as INITIAL_POIS,
  TRAFFIC_CORRIDORS as INITIAL_TRAFFIC,
} from '../data/nepalHighwaysData';
import { NEPAL_HIGHWAY_BLACKSPOTS as INITIAL_BLACKSPOTS } from '../data/accidentBlackspotsData';

let cached79Highways: Highway[] | null = null;
let cachedIncidents: RoadIncident[] | null = null;
let cachedWeather: HighwayWeatherNode[] | null = null;
let cachedPOIs: HighwayPOI[] | null = null;
let cachedCorridors: TrafficCorridor[] | null = null;
let cachedBlackspots: KnownBlackspot[] | null = null;
let cachedDistanceMatrix: Record<string, Record<string, number>> | null = null;

/**
 * Fetch and parse all 79 National Highways with full GeoJSON vector paths and DoR metadata
 */
export async function loadAll79Highways(): Promise<Highway[]> {
  if (cached79Highways && cached79Highways.length >= 79) {
    return cached79Highways;
  }

  try {
    const res = await fetch('/data/all-highways-79.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cached79Highways = data;
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch /data/all-highways-79.json, falling back to bundled dataset:', err);
  }

  return INITIAL_HIGHWAYS;
}

/**
 * Load raw high-res GeoJSON for a specific highway
 */
export async function loadHighwayGeoJson(fileName: string): Promise<any | null> {
  try {
    const res = await fetch(`/data/highway/${fileName}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Failed loading GeoJSON for ${fileName}:`, err);
  }
  return null;
}

/**
 * Load real-time road incidents & verified DoR hazards
 */
export async function loadRealtimeIncidents(): Promise<RoadIncident[]> {
  if (cachedIncidents) return cachedIncidents;

  try {
    const res = await fetch('/data/incidents.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedIncidents = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('Using bundled incidents:', e);
  }

  return INITIAL_INCIDENTS;
}

/**
 * Load real-time mountain weather & pass grip telemetry
 */
export async function loadMountainWeather(): Promise<HighwayWeatherNode[]> {
  if (cachedWeather) return cachedWeather;

  try {
    const res = await fetch('/data/mountain-weather.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedWeather = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('Using bundled weather:', e);
  }

  return INITIAL_WEATHER;
}

/**
 * Load verified POIs (EV charging hubs, fuel, DoR trauma posts)
 */
export async function loadHighwayPOIs(): Promise<HighwayPOI[]> {
  if (cachedPOIs) return cachedPOIs;

  try {
    const res = await fetch('/data/pois.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedPOIs = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('Using bundled POIs:', e);
  }

  return INITIAL_POIS;
}

/**
 * Load live traffic bottleneck corridors and historical rush-hour delays
 */
export async function loadTrafficCorridors(): Promise<TrafficCorridor[]> {
  if (cachedCorridors) return cachedCorridors;

  try {
    const res = await fetch('/data/traffic-corridors.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedCorridors = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('Using bundled traffic corridors:', e);
  }

  return INITIAL_TRAFFIC;
}

/**
 * Load accident blackspots & high-hazard mountain curves
 */
export async function loadBlackspots(): Promise<KnownBlackspot[]> {
  if (cachedBlackspots) return cachedBlackspots;

  try {
    const res = await fetch('/data/blackspots.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedBlackspots = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('Using bundled blackspots:', e);
  }

  return INITIAL_BLACKSPOTS;
}

/**
 * Load inter-city DoR distance matrix
 */
export async function loadDistanceMatrix(): Promise<Record<string, Record<string, number>> | null> {
  if (cachedDistanceMatrix) return cachedDistanceMatrix;

  try {
    const res = await fetch('/data/distance-matrix.json');
    if (res.ok) {
      const data = await res.json();
      cachedDistanceMatrix = data;
      return data;
    }
  } catch (e) {
    console.warn('Failed loading distance matrix:', e);
  }

  return null;
}
