// backend/src/utils/iconMap.ts

/**
 * 📍 POI Category to Icon Mapper
 * Maps category strings to frontend-compatible icon identifiers.
 */
export const getMarkerIcon = (category: string): string => {
  const cat = category.toLowerCase();

  const map: Record<string, string> = {
    fuel: 'gas-station',
    petrol: 'gas-station',
    hospital: 'local-hospital',
    clinic: 'local-hospital',
    restaurant: 'restaurant',
    cafe: 'coffee',
    hotel: 'hotel',
    lodge: 'hotel',
    police: 'policy-station',
    parking: 'local-parking',
    shop: 'shopping-cart',
    market: 'storefront',
    temple: 'synagogue', // Closest Material Icon for religious sites
    bank: 'account-balance',
    atm: 'atm'
  };

  return map[cat] || 'location-on'; // Default pin icon
};
