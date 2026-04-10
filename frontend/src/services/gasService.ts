import { APP_CONFIG } from '../config/config';

export interface ServiceItem {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  hours?: string;
  rating?: number;
  distance?: number;
  status?: string;
  description?: string;
  source: 'gas' | 'backend' | 'osm';
}

const SERVICE_TYPES: Record<string, string> = {
  fuel: 'fuel',
  food: 'restaurant',
  hospital: 'hospital',
  traffic: 'traffic',
  monsoon: 'weather',
  roads: 'road',
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_KM = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fetch POI data from the backend API.
 */
async function fetchFromBackend(
  serviceType: string,
  lat: number,
  lng: number
): Promise<ServiceItem[]> {
  const base = APP_CONFIG.apiBaseUrl;
  const query = SERVICE_TYPES[serviceType] || serviceType;
  
  // Build URL with query params
  const params = new URLSearchParams({ q: query });
  if (lat && lng) {
    params.append('lat', lat.toString());
    params.append('lng', lng.toString());
  }
  
  const url = `${base}/v1/pois?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[gasService] Backend returned ${res.status} for ${serviceType}`);
      return [];
    }

    const json = await res.json();
    const items = json.data || json.merged || json.features || json.results || (Array.isArray(json) ? json : []);

    return items.map((item: any, i: number) => {
      // Handle different response formats
      const props = item.properties || item.poi || item;
      const loc = item.location || item.geometry?.coordinates || item.position || {};
      
      const poiLat = loc.lat || loc.latitude || (Array.isArray(loc) ? loc[1] : 0);
      const poiLng = loc.lng || loc.lon || loc.longitude || (Array.isArray(loc) ? loc[0] : 0);

      return {
        id: item.id || props.id || `backend-${serviceType}-${i}`,
        name: props.name || props.title || props.poiName || item.name || 'Unknown',
        type: serviceType,
        lat: parseFloat(poiLat) || 0,
        lng: parseFloat(poiLng) || 0,
        address: props.address || props.freeformAddress || props.vicinity || '',
        phone: props.phone || props.phoneNumber || '',
        hours: props.hours || props.openingHours || '',
        rating: parseFloat(props.rating || 0),
        distance: haversineKm(lat, lng, parseFloat(poiLat) || 0, parseFloat(poiLng) || 0),
        status: props.status || item.status || 'active',
        description: props.description || props.remarks || props.category || '',
        source: 'backend' as const,
      };
    }).filter((s: ServiceItem) => s.lat !== 0 && s.lng !== 0);
  } catch (err) {
    console.error(`[gasService] Failed to fetch ${serviceType}:`, err);
    return [];
  }
}

/**
 * Fetch traffic data from backend traffic endpoint.
 */
async function fetchTrafficData(
  lat: number,
  lng: number
): Promise<ServiceItem[]> {
  const base = APP_CONFIG.apiBaseUrl;
  const url = `${base}/v1/traffic/nearby?lat=${lat}&lng=${lng}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];

    const json = await res.json();
    // Handle { count, roads } format
    const items = json.roads || json.incidents || json.data || json.features || [];

    return items.map((item: any, i: number) => {
      const props = item.properties || item;
      const loc = item.geometry?.coordinates || {};
      
      return {
        id: item.id || `traffic-${i}`,
        name: props.road_name || props.name || props.title || 'Traffic Point',
        type: 'traffic',
        lat: loc[1] || 0,
        lng: loc[0] || 0,
        address: props.incidentDistrict || props.location || '',
        description: props.status || props.description || '',
        status: props.status || 'active',
        source: 'backend' as const,
      };
    }).filter((s: ServiceItem) => s.lat !== 0 && s.lng !== 0);
  } catch {
    return [];
  }
}

/**
 * Fetch road incidents from backend.
 */
async function fetchRoadData(
  lat: number,
  lng: number
): Promise<ServiceItem[]> {
  const base = APP_CONFIG.apiBaseUrl;
  const url = `${base}/v1/roads/all`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];

    const json = await res.json();
    // Handle both array and object with merged property
    const items = Array.isArray(json) ? json : (json.merged || json.data || json.features || []);

    return items.map((item: any, i: number) => {
      const props = item.properties || item;
      const loc = item.geometry?.coordinates || {};
      
      return {
        id: item.id || `road-${i}`,
        name: props.road_name || props.name || 'Road Alert',
        type: 'roads',
        lat: loc[1] || 0,
        lng: loc[0] || 0,
        address: props.incidentDistrict || props.location || '',
        description: props.status || props.description || '',
        status: props.status || 'active',
        source: 'backend' as const,
      };
    }).filter((s: ServiceItem) => s.lat !== 0 && s.lng !== 0);
  } catch {
    return [];
  }
}

/**
 * Main fetch function.
 */
export async function fetchServiceData(
  serviceType: string,
  lat: number,
  lng: number
): Promise<ServiceItem[]> {
  // Special handling for traffic and roads
  if (serviceType === 'traffic') {
    return fetchTrafficData(lat, lng);
  }
  if (serviceType === 'roads') {
    return fetchRoadData(lat, lng);
  }

  // Standard POI fetch
  return fetchFromBackend(serviceType, lat, lng);
}
