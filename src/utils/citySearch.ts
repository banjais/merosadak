import { CityNode } from '../types';
import { NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';
import { getCityLink } from './roadGraphRouter';

const TYPE_PRIORITY: Record<string, number> = {
  'Metropolitan City': 0,
  'Sub-Metropolitan': 1,
  'Municipality': 2,
  'Rural Municipality': 3,
};

/**
 * Match quality, best first. A province or district hit is a weak signal that
 * pulls in every other settlement in that region, so it ranks below any hit on
 * the place name itself.
 */
const MATCH_EXACT_NAME = 0;
const MATCH_NAME_PREFIX = 1;
const MATCH_NAME_CONTAINS = 2;
const MATCH_WORD_PREFIX = 3;
const MATCH_NEPALI_NAME = 4;
const MATCH_DISTRICT = 5;
const MATCH_PROVINCE = 6;
const NO_MATCH = -1;

/**
 * How many highways a place joins, preferring the surveyed graph over the
 * curated list. Kept local rather than imported from the row component so this
 * module stays free of React.
 */
function highwayCountFor(city: CityNode): number {
  const link = getCityLink(city);
  if (link && link.highways.length > 0) return link.highways.length;
  return new Set([...(city.connectedHighways ?? []), city.highwayCode].filter(Boolean)).size;
}

const scoreCity = (city: CityNode, normalizedQuery: string): number => {
  const name = city.name.toLowerCase();
  if (name === normalizedQuery) return MATCH_EXACT_NAME;
  if (name.startsWith(normalizedQuery)) return MATCH_NAME_PREFIX;
  if (name.includes(normalizedQuery)) return MATCH_NAME_CONTAINS;
  // "muglin narayanghat" should still surface Mugling before Hetauda.
  if (name.split(/[\s/,()-]+/).some((word) => word.startsWith(normalizedQuery))) {
    return MATCH_WORD_PREFIX;
  }
  if (city.nepaliName && city.nepaliName.toLowerCase().includes(normalizedQuery)) {
    return MATCH_NEPALI_NAME;
  }
  if (city.district && city.district.toLowerCase().includes(normalizedQuery)) {
    return MATCH_DISTRICT;
  }
  if (city.province && city.province.toLowerCase().includes(normalizedQuery)) {
    return MATCH_PROVINCE;
  }
  return NO_MATCH;
};

export interface FilterCitiesOptions {
  /** Places to skip, e.g. the endpoint already chosen in the other field. */
  excludeIds?: Set<string>;
}

/**
 * How many suggestions a picker should show for a given query.
 *
 * A one- or two-character query is a prefix scan over the whole corpus, so a
 * fixed small cap would hide most of what matched. The list still stays bounded
 * — showing every match would bury the dropdown — and the caller reports the
 * remainder so the user knows to keep typing. Shared by every place picker so
 * the planner and the calculator cannot drift apart again.
 */
export const DEFAULT_CITY_SUGGESTION_LIMIT = 8;
export const BROAD_QUERY_CITY_SUGGESTION_LIMIT = 16;
export const VERY_BROAD_QUERY_CITY_SUGGESTION_LIMIT = 24;

export function citySuggestionLimit(query: string): number {
  const length = query.trim().length;
  if (length <= 1) return VERY_BROAD_QUERY_CITY_SUGGESTION_LIMIT;
  if (length === 2) return BROAD_QUERY_CITY_SUGGESTION_LIMIT;
  return DEFAULT_CITY_SUGGESTION_LIMIT;
}

/** Every place a query matches, ignoring the display cap. */
export function countCityMatches(  cities: CityNode[],
  query: string,
  options: FilterCitiesOptions = {}
): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  let count = 0;
  for (const city of cities) {
    if (options.excludeIds?.has(city.id)) continue;
    if (scoreCity(city, normalizedQuery) !== NO_MATCH) count += 1;
  }
  return count;
}

/**
 * Rank city candidates for an autocomplete. Results are ordered by match
 * strength first, so a name hit always outranks a province-wide sweep, and the
 * list is capped by default so a broad query never dumps the whole corpus.
 */
export const filterCities = (
  cities: CityNode[],
  query: string,
  limit = 8,
  options: FilterCitiesOptions = {}
) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const scored: Array<{ city: CityNode; rank: number; match: number; highways: number }> = [];

  for (const city of cities) {
    if (options.excludeIds?.has(city.id)) continue;
    const match = scoreCity(city, normalizedQuery);
    if (match === NO_MATCH) continue;
    scored.push({
      city,
      rank: TYPE_PRIORITY[city.cityType ?? ''] ?? 4,
      match,
      // Places that join a real highway are the ones a driver can actually
      // depart from, so they lead within a match tier. Counted from the
      // surveyed graph, with the curated list as the fallback.
      highways: highwayCountFor(city),
    });
  }

  scored.sort((a, b) => {
    if (a.match !== b.match) return a.match - b.match;
    if (a.highways !== b.highways) return b.highways - a.highways;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.city.isMajorHub !== b.city.isMajorHub) return a.city.isMajorHub ? -1 : 1;
    // Prefer the most specific place: "Pokhara" before "Pokhara Metropolitan Ward 3".
    if (a.city.name.length !== b.city.name.length) return a.city.name.length - b.city.name.length;
    return a.city.name.localeCompare(b.city.name);
  });

  return scored.slice(0, limit).map((entry) => entry.city);
};

const GEOCODE_CACHE = new Map<string, CityNode | null>();

export async function searchCitiesWithGeocode(
  cities: CityNode[],
  query: string,
  limit = 8
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
      // Nominatim does not return a Nepal province in a shape we can trust, so
      // leave it blank rather than asserting a wrong one.
      province: '',
      cityType: 'Geocoded',
      lat,
      lng,
      // Unknown elevation must stay 0 so callers can detect and hide it.
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
  cityLimit = 8,
  junctionLimit = 4
) {
  const cityResults = filterCities(cities, query, cityLimit);
  const junctionResults = filterHighwayJunctions(query, junctionLimit);

  return {
    cities: cityResults,
    junctions: junctionResults,
  };
}
