import { CityNode } from '../types';
import { NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';

const TYPE_PRIORITY: Record<string, number> = {
  'Metropolitan City': 0,
  'Sub-Metropolitan': 1,
  'Municipality': 2,
  'Rural Municipality': 3,
};

export const filterCities = (cities: CityNode[], query: string, limit = 20) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return cities
    .filter((city) =>
      city.name.toLowerCase().includes(normalizedQuery) ||
      city.district.toLowerCase().includes(normalizedQuery) ||
      city.province.toLowerCase().includes(normalizedQuery) ||
      city.nepaliName.toLowerCase().includes(normalizedQuery)
    )
    .sort((a, b) => {
      const aExact = a.name.toLowerCase() === normalizedQuery ? 0 : 1;
      const bExact = b.name.toLowerCase() === normalizedQuery ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aPriority = TYPE_PRIORITY[a.cityType ?? ''] ?? 4;
      const bPriority = TYPE_PRIORITY[b.cityType ?? ''] ?? 4;
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.isMajorHub !== b.isMajorHub) return b.isMajorHub ? 1 : -1;
      return 0;
    })
    .slice(0, limit);
};

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
