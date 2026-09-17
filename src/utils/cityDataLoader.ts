import { CityNode, Highway } from '../types';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';

let cachedExpandedCities: CityNode[] | null = null;

export const CITY_HIGHWAY_TOUCH_DISTANCE_KM = 5;

const DISTRICT_PROVINCE_MAP: Record<string, string> = {
  // Koshi Province
  Taplejung: 'Koshi', Panchthar: 'Koshi', Morang: 'Koshi', Sunsari: 'Koshi',
  Dhankuta: 'Koshi', Sankhuwasabha: 'Koshi', Solukhumbu: 'Koshi',
  Okhaldhunga: 'Koshi', Khotang: 'Koshi', Bhojpur: 'Koshi', Terhathum: 'Koshi', Udayapur: 'Koshi',

  // Madhesh Province
  Bara: 'Madhesh', Parsa: 'Madhesh', Rautahat: 'Madhesh', Saptari: 'Madhesh',
  Siraha: 'Madhesh', Dhanusha: 'Madhesh', Mahottari: 'Madhesh', Sarlahi: 'Madhesh',

  // Bagmati Province
  Bhaktapur: 'Bagmati', Chitwan: 'Bagmati', Dhading: 'Bagmati', Dolakha: 'Bagmati',
  Kathmandu: 'Bagmati', Kavrepalanchok: 'Bagmati', Lalitpur: 'Bagmati',
  Makawanpur: 'Bagmati', Nuwakot: 'Bagmati', Ramechhap: 'Bagmati',
  Rasuwa: 'Bagmati', Sindhuli: 'Bagmati', Sindhupalchok: 'Bagmati',

  // Gandaki Province
  Baglung: 'Gandaki', Gorkha: 'Gandaki', Kaski: 'Gandaki', Lamjung: 'Gandaki',
  Manang: 'Gandaki', Mustang: 'Gandaki', Myagdi: 'Gandaki',
  Nawalparasi_E: 'Gandaki', Nawalpur: 'Gandaki', Parbat: 'Gandaki',
  Syangja: 'Gandaki', Tanahu: 'Gandaki',

  // Lumbini Province
  Arghakhanchi: 'Lumbini', Banke: 'Lumbini', Bardiya: 'Lumbini', Dang: 'Lumbini',
  Gulmi: 'Lumbini', Kapilvastu: 'Lumbini', Nawalparasi_W: 'Lumbini',
  Palpa: 'Lumbini', Pyuthan: 'Lumbini', Rolpa: 'Lumbini', Rupandehi: 'Lumbini',

  // Karnali Province
  Dailekh: 'Karnali', Dolpa: 'Karnali', Humla: 'Karnali', Jajarkot: 'Karnali',
  Jumla: 'Karnali', Kalikot: 'Karnali', Mugu: 'Karnali',
  Rukum_E: 'Karnali', Rukum_W: 'Lumbini', Salyan: 'Karnali', Surkhet: 'Karnali',

  // Sudurpashchim Province
  Achham: 'Sudurpashchim', Baitadi: 'Sudurpashchim', Bajhang: 'Sudurpashchim',
  Bajura: 'Sudurpashchim', Dadeldhura: 'Sudurpashchim', Darchula: 'Sudurpashchim',
  Doti: 'Sudurpashchim', Kailali: 'Sudurpashchim', Kanchanpur: 'Sudurpashchim',
};

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

function normalizeName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim();
}

function toCityNode(item: Record<string, unknown>, index: number, source: string, cityType?: string): CityNode {
  const rawName = stringValue(item, ['name', 'Palika', 'palika', 'hqCity']) || 'Unknown';
  const name = normalizeName(rawName);
  const lat = numberValue(item, ['lat', 'latitude']);
  const lng = numberValue(item, ['lng', 'longitude']);
  const connectedHighwaysValue = item.connectedHighways;
  const connectedHighways = Array.isArray(connectedHighwaysValue)
    ? connectedHighwaysValue.filter((value): value is string => typeof value === 'string')
    : [];

  const district = stringValue(item, ['district', 'District']);
  const provinceFromData = stringValue(item, ['province', 'Province']);
  const province = DISTRICT_PROVINCE_MAP[district] || provinceFromData || 'Bagmati';

  return {
    id: stringValue(item, ['id']) || `${source}-${index}`,
    name,
    nepaliName: stringValue(item, ['nepaliName', 'nepali_name']),
    district,
    province,
    cityType,
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
  return `${normalizeName(city.name).trim().toLowerCase()}|${city.district.trim().toLowerCase()}`;
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
  const merged: CityNode[] = CITIES_AND_JUNCTIONS.map((city) => ({ ...city, name: normalizeName(city.name) }));
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
      const datasets: { items: Record<string, unknown>[]; cityType?: string }[] = Array.isArray(data)
        ? [{ items: data, cityType: undefined }]
        : source.grouped
          ? Object.entries(data as Record<string, unknown[]>).flatMap(([key, value]) => {
              const items = asObjectArray(value);
              if (items.length === 0) return [];
              const typeMap: Record<string, string> = {
                metropolitan: 'Metropolitan City',
                sub_metropolitan: 'Sub-Metropolitan',
                municipality: 'Municipality',
                rural_municipality: 'Rural Municipality',
              };
              return [{ items, cityType: typeMap[key] }];
            })
          : nonGroupedItems.length > 0
            ? [{ items: nonGroupedItems, cityType: stringValue(nonGroupedItems[0], ['type']) || undefined }]
            : [];

      for (const dataset of datasets) {
        for (let index = 0; index < dataset.items.length; index += 1) {
          const item = dataset.items[index];
          let cityType = dataset.cityType;
          if (!cityType) {
            cityType = stringValue(item, ['type']) || undefined;
          }
          if (!cityType && source.key === 'palika') {
            cityType = 'Municipality';
          }
          const city = toCityNode(item, index, `${source.key}-${index}`, cityType);
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
