import { CityNode } from '../types';
import { NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';

const TYPE_PRIORITY: Record<string, number> = {
  Airport: 0,
  'Bus Station': 1,
  'Highway Town': 2,
  'Highway Node': 2,
  Published: 2,
  'Tourist Place': 3,
  Temple: 3,
  'Metropolitan City': 4,
  'Sub-Metropolitan': 4,
  Municipality: 4,
  'Rural Municipality': 4,
};

const CITY_SEARCH_ALIASES: Record<string, string[]> = {
  attariya: ['attaria'],
};

export const filterCities = (cities: CityNode[], query: string, limit = 20) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const nameMatchesQuery = (city: CityNode) => {
    const normalizedName = city.name.toLowerCase();
    return normalizedName.includes(normalizedQuery) ||
      (CITY_SEARCH_ALIASES[normalizedName] || []).some((alias) => alias.includes(normalizedQuery));
  };
  const isExactNameMatch = (city: CityNode) => {
    const normalizedName = city.name.toLowerCase();
    return normalizedName === normalizedQuery ||
      (CITY_SEARCH_ALIASES[normalizedName] || []).includes(normalizedQuery);
  };

  return cities
    .filter((city) =>
      nameMatchesQuery(city) ||
      city.district.toLowerCase().includes(normalizedQuery) ||
      city.province.toLowerCase().includes(normalizedQuery) ||
      city.nepaliName.toLowerCase().includes(normalizedQuery)
    )
    .sort((a, b) => {
      const aExact = isExactNameMatch(a) ? 0 : 1;
      const bExact = isExactNameMatch(b) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aInDistrict = a.district.toLowerCase() === normalizedQuery ? 0 : 1;
      const bInDistrict = b.district.toLowerCase() === normalizedQuery ? 0 : 1;
      if (aInDistrict !== bInDistrict) return aInDistrict - bInDistrict;
      const aPriority = TYPE_PRIORITY[a.cityType ?? ''] ?? 4;
      const bPriority = TYPE_PRIORITY[b.cityType ?? ''] ?? 4;
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.connectedHighways.length !== b.connectedHighways.length) {
        return b.connectedHighways.length - a.connectedHighways.length;
      }
      if (a.isMajorHub !== b.isMajorHub) return a.isMajorHub ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
};

const GEOCODE_CACHE = new Map<string, CityNode | null>();

export async function searchCitiesWithGeocode(
  cities: CityNode[],
  query: string,
  limit = 20
): Promise<CityNode[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  // First try local match
  const local = filterCities(cities, normalizedQuery, limit);
  if (local.length > 0) return local;

  // Fall back to Nominatim geocoding for unknown places (e.g. "Chaupatta")
  if (GEOCODE_CACHE.has(normalizedQuery)) {
    const cached = GEOCODE_CACHE.get(normalizedQuery);
    return cached ? [cached] : [];
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(normalizedQuery)}, Nepal`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) {
      GEOCODE_CACHE.set(normalizedQuery, null);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      GEOCODE_CACHE.set(normalizedQuery, null);
      return [];
    }
    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 26 || lat > 31 || lng < 79 || lng > 89) {
      GEOCODE_CACHE.set(normalizedQuery, null);
      return [];
    }
    const geoCity: CityNode = {
      id: `geocode-${normalizedQuery.toLowerCase().replace(/\s+/g, '-')}`,
      name: first.name || normalizedQuery,
      nepaliName: '',
      district: '',
      province: '',
      cityType: 'Geocoded',
      lat,
      lng,
      elevationM: 0,
      isMajorHub: false,
      connectedHighways: [],
    };
    GEOCODE_CACHE.set(normalizedQuery, geoCity);
    return [geoCity];
  } catch {
    GEOCODE_CACHE.set(normalizedQuery, null);
    return [];
  }
}

export interface HighwayJunctionResult {
  id: string;
  name: string;
  type: 'highway_junction';
  highwayCode: string;
  highwayName: string;
  district?: string;
  province?: string;
  lat: number;
  lng: number;
}

export function filterHighwayJunctions(query: string, limit = 10): HighwayJunctionResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const results: HighwayJunctionResult[] = [];

  for (const highway of NEPAL_HIGHWAYS) {
    if (highway.keyPassesAndJunctions && highway.keyPassesAndJunctions.length > 0) {
      for (const junction of highway.keyPassesAndJunctions) {
        if (junction.toLowerCase().includes(normalizedQuery)) {
          results.push({
            id: `junction-${highway.code}-${junction}`,
            name: junction,
            type: 'highway_junction',
            highwayCode: highway.code,
            highwayName: highway.name,
            lat: highway.center?.[0] ?? 0,
            lng: highway.center?.[1] ?? 0,
          });
        }
      }
    }

    if (highway.name.toLowerCase().includes(normalizedQuery) ||
        (highway.nepaliName || '').toLowerCase().includes(normalizedQuery)) {
      results.push({
        id: `highway-${highway.code}`,
        name: `${highway.name} (${highway.code})`,
        type: 'highway_junction',
        highwayCode: highway.code,
        highwayName: highway.name,
        lat: highway.center?.[0] ?? 0,
        lng: highway.center?.[1] ?? 0,
      });
    }
  }

  return results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === normalizedQuery ? 0 : 1;
    const bExact = b.name.toLowerCase() === normalizedQuery ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return 0;
  }).slice(0, limit);
}

export function filterCitiesWithJunctions(
  cities: CityNode[],
  query: string,
  cityLimit = 15,
  junctionLimit = 5
) {
  const cityResults = filterCities(cities, query, cityLimit);
  const junctionResults = filterHighwayJunctions(query, junctionLimit);

  return {
    cities: cityResults,
    junctions: junctionResults,
  };
}
