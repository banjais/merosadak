import { CityNode } from '../types';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';

let cachedExpandedCities: CityNode[] | null = null;

function toCityNode(item: any, index: number): CityNode {
  return {
    id: item.id || `ext-${index}`,
    name: item.name || item.Palika || item.palika || 'Unknown',
    nepaliName: item.nepaliName || item.nepali_name || '',
    district: item.district || item.District || '',
    province: item.province || '',
    lat: typeof item.lat === 'number' ? item.lat : (typeof item.latitude === 'number' ? item.latitude : 0),
    lng: typeof item.lng === 'number' ? item.lng : (typeof item.longitude === 'number' ? item.longitude : 0),
    elevationM: typeof item.elevationM === 'number' ? item.elevationM : 0,
    isMajorHub: item.isMajorHub || false,
    connectedHighways: item.connectedHighways || [],
  };
}

export async function loadExpandedCities(): Promise<CityNode[]> {
  if (cachedExpandedCities && cachedExpandedCities.length > 0) {
    return cachedExpandedCities;
  }

  const existingIds = new Set(CITIES_AND_JUNCTIONS.map((c) => c.id));
  const merged: CityNode[] = [...CITIES_AND_JUNCTIONS];

  const sources = [
    '/data/cities.json',
    '/data/palika-coords.json',
    '/data/district-hqs.json',
    '/data/district-centroids.json',
  ];

  for (const url of sources) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      const items = data.map((item: any, idx: number) => toCityNode(item, idx));
      for (const city of items) {
        if (!existingIds.has(city.id) && city.name && city.lat && city.lng) {
          merged.push(city);
          existingIds.add(city.id);
        }
      }
    } catch (e) {
      console.warn(`Failed loading expanded cities from ${url}:`, e);
    }
  }

  cachedExpandedCities = merged;
  return merged;
}

export function getCachedExpandedCities(): CityNode[] {
  return cachedExpandedCities || CITIES_AND_JUNCTIONS;
}
