import { CityNode } from '../types';

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
    .slice(0, limit);
};
