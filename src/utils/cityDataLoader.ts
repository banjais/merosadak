import { CityNode, Highway } from '../types';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';

let cachedExpandedCities: CityNode[] | null = null;

export const CITY_HIGHWAY_TOUCH_DISTANCE_KM = 5;

function stringValue(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function numberValue(item: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function toCityNode(item: Record<string, unknown>, index: number, source: string): CityNode {
  const name = stringValue(item, ['name', 'Palika', 'palika', 'hqCity']) || 'Unknown';
  const lat = numberValue(item, ['lat', 'latitude']);
  const lng = numberValue(item, ['lng', 'longitude']);
  const connectedHighwaysValue = item.connectedHighways;
  const connectedHighways = Array.isArray(connectedHighwaysValue)
    ? connectedHighwaysValue.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    id: stringValue(item, ['id']) || `${source}-${index}`,
    name,
    nepaliName: stringValue(item, ['nepaliName', 'nepali_name']),
    district: stringValue(item, ['district', 'District']),
    province: stringValue(item, ['province', 'Province']),
    lat,
    lng,
    elevationM: numberValue(item, ['elevationM', 'elevation']),
    isMajorHub: item.isMajorHub === true,
    connectedHighways,
  };
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)
  );
}

function isValidCity(city: CityNode): boolean {
  return (
    city.name !== 'Unknown' &&
    Number.isFinite(city.lat) &&
    Number.isFinite(city.lng) &&
    city.lat >= 26 &&
    city.lat <= 31 &&
    city.lng >= 79 &&
    city.lng <= 89
  );
}

function cityKey(city: CityNode): string {
  return `${city.name.trim().toLowerCase()}|${city.district.trim().toLowerCase()}|${city.lat.toFixed(5)}|${city.lng.toFixed(5)}`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

export function getNearestRoutingCity(city: CityNode): CityNode {
  const bundledCities = CITIES_AND_JUNCTIONS;
  if (bundledCities.some((candidate) => candidate.id === city.id)) return city;

  let nearest = bundledCities[0] || city;
  let minimumDistance = Infinity;

  for (const candidate of bundledCities) {
    const distance = distanceKm(city.lat, city.lng, candidate.lat, candidate.lng);
    if (distance < minimumDistance) {
      minimumDistance = distance;
      nearest = candidate;
    }
  }

  return nearest;
}

function distanceToSegmentKm(lat: number, lng: number, start: [number, number], end: [number, number]): number {
  const [startLat, startLng] = start;
  const [endLat, endLng] = end;
  const latRad = toRadians(lat);
  const cosLat = Math.cos(latRad);
  const dx = (endLng - startLng) * cosLat;
  const dy = endLat - startLat;
  const px = (lng - startLng) * cosLat;
  const py = lat - startLat;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return distanceKm(lat, lng, startLat, startLng);

  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
  return distanceKm(lat, lng, startLat + t * dy, startLng + (t * dx) / cosLat);
}

interface HighwayLine {
  coordinates: [number, number][];
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function toHighwayLine(coordinates: [number, number][]): HighwayLine | null {
  const validCoordinates = coordinates.filter(
    (coordinate): coordinate is [number, number] =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1])
  );

  if (validCoordinates.length < 2) return null;

  const lats = validCoordinates.map((coordinate) => coordinate[0]);
  const lngs = validCoordinates.map((coordinate) => coordinate[1]);
  return {
    coordinates: validCoordinates,
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function getHighwayLines(highways: Highway[]): HighwayLine[] {
  const lines: HighwayLine[] = [];

  for (const highway of highways) {
    const coordinateLines = Array.isArray(highway.coordinates) ? highway.coordinates : [];
    const sourceLines =
      coordinateLines.length > 0
        ? coordinateLines
        : (highway.segments || []).map((segment) => segment.coordinates);

    for (const coordinates of sourceLines) {
      if (!Array.isArray(coordinates)) continue;
      const line = toHighwayLine(coordinates as [number, number][]);
      if (line) lines.push(line);
    }
  }

  return lines;
}

export function filterCitiesNearHighways(
  cities: CityNode[],
  highways: Highway[],
  maxDistanceKm = CITY_HIGHWAY_TOUCH_DISTANCE_KM
): CityNode[] {
  const lines = getHighwayLines(highways);
  const latMargin = maxDistanceKm / 111;

  return cities.filter((city) => {
    if (!isValidCity(city)) return false;
    if (city.connectedHighways.length > 0) return true;

    const lngMargin = maxDistanceKm / (111 * Math.max(0.1, Math.cos(toRadians(city.lat))));
    return lines.some((line) => {
      if (
        city.lat < line.minLat - latMargin ||
        city.lat > line.maxLat + latMargin ||
        city.lng < line.minLng - lngMargin ||
        city.lng > line.maxLng + lngMargin
      ) {
        return false;
      }

      for (let index = 1; index < line.coordinates.length; index += 1) {
        if (
          distanceToSegmentKm(
            city.lat,
            city.lng,
            line.coordinates[index - 1],
            line.coordinates[index]
          ) <= maxDistanceKm
        ) {
          return true;
        }
      }
      return false;
    });
  });
}

export async function loadExpandedCities(): Promise<CityNode[]> {
  if (cachedExpandedCities && cachedExpandedCities.length > 0) {
    return cachedExpandedCities;
  }

  const existingIds = new Set(CITIES_AND_JUNCTIONS.map((city) => city.id));
  const existingKeys = new Set(CITIES_AND_JUNCTIONS.map(cityKey));
  const merged: CityNode[] = [...CITIES_AND_JUNCTIONS];
  const sources = [
    { url: '/data/cities.json', grouped: true, key: 'cities' },
    { url: '/data/palika-coords.json', grouped: false, key: 'palika' },
    { url: '/data/district-hqs.json', grouped: false, key: 'district-hqs' },
    { url: '/data/district-centroids.json', grouped: false, key: 'district-centroids' },
  ];

  for (const source of sources) {
    try {
      const res = await fetch(source.url);
      if (!res.ok) continue;
      const data: unknown = await res.json();
      const nonGroupedItems = asObjectArray(data);
      const datasets = Array.isArray(data)
        ? [data]
        : source.grouped
          ? Object.values(data).flatMap((value) => {
              const items = asObjectArray(value);
              return items.length > 0 ? [items] : [];
            })
          : nonGroupedItems.length > 0
            ? [nonGroupedItems]
            : [];

      for (const items of datasets) {
        for (let index = 0; index < items.length; index += 1) {
          const city = toCityNode(items[index], index, `${source.key}-${datasets.indexOf(items)}`);
          const key = cityKey(city);
          if (
            isValidCity(city) &&
            !existingIds.has(city.id) &&
            !existingKeys.has(key)
          ) {
            merged.push(city);
            existingIds.add(city.id);
            existingKeys.add(key);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed loading expanded cities from ${source.url}:`, error);
    }
  }

  cachedExpandedCities = merged;
  return merged;
}

export function getCachedExpandedCities(): CityNode[] {
  return cachedExpandedCities || CITIES_AND_JUNCTIONS;
}
