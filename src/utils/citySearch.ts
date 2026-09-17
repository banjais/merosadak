import { CityNode } from '../types';

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
