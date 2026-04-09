// src/services/searchIntent.ts
// Smart search intent detection system

export type SearchIntent = 'place' | 'highway' | 'weather' | 'traffic' | 'poi' | 'poi_category' | 'mixed';

export interface IntentResult {
  intent: SearchIntent;
  location?: string;
  highway?: string;
  poiCategory?: string;
  originalQuery: string;
}

// Highway database for matching
const HIGHWAY_CODES = [
  'NH01', 'NH02', 'NH03', 'NH04', 'NH05', 'NH06', 'NH07', 'NH08', 'NH09', 'NH10',
  'NH11', 'NH12', 'NH13', 'NH14', 'NH15', 'NH16', 'NH17', 'NH18', 'NH19', 'NH20',
  'FH01', 'FH02', 'FH03', 'FH04', 'FH05'
];

const HIGHWAY_NAMES = [
  'mahendra', 'prithvi', 'tribhuvan', 'arniko', 'janakpur', 'narayani',
  'koshi', 'mechi', 'karjanha', 'hulaki', 'postal', 'pushpalal',
  'madan bhandari', 'bp koirala', 'gorkha', 'dharan', 'ilam', 'jogbani'
];

// POI categories
const POI_CATEGORIES = [
  'fuel', 'petrol', 'diesel', 'hospital', 'clinic', 'hotel', 'restaurant', 
  'cafe', 'food', 'atm', 'bank', 'school', 'college', 'pharmacy', 'temple',
  'museum', 'park', 'tourist', 'viewpoint', 'shopping', 'market', 'police'
];

/**
 * Detect search intent from user query
 */
export function detectSearchIntent(query: string): IntentResult {
  const originalQuery = query;
  const q = query.toLowerCase().trim();
  
  // Remove common stop words for analysis
  const cleanQuery = q.replace(/\b(in|at|near|around|of|the|a|an)\b/g, '').trim();
  
  // 1. Check for WEATHER intent
  // "weather pokhara", "pokhara weather", "weather in kathmandu"
  if (q.includes('weather') || q.includes('मौसम') || q.includes('temp') || q.includes('rain')) {
    const location = extractLocation(cleanQuery.replace(/weather|मौसम|temp|rain/g, ''));
    return {
      intent: 'weather',
      location: location || undefined,
      originalQuery
    };
  }
  
  // 2. Check for TRAFFIC intent
  // "traffic newroad", "newroad traffic", "traffic jam", "congestion"
  if (q.includes('traffic') || q.includes('jam') || q.includes('congestion') || 
      q.includes('blocked') || q.includes('traffic jam')) {
    const location = extractLocation(cleanQuery.replace(/traffic|jam|congestion|blocked/g, ''));
    return {
      intent: 'traffic',
      location: location || undefined,
      originalQuery
    };
  }
  
  // 3. Check for HIGHWAY intent
  // "NH01", "mahendra highway", "prithvi highway"
  const highwayMatch = detectHighway(cleanQuery);
  if (highwayMatch) {
    return {
      intent: 'highway',
      highway: highwayMatch,
      originalQuery
    };
  }
  
  // 4. Check for POI CATEGORY intent
  // "fuel", "hospital", "hotel near me"
  const poiCategoryMatch = detectPOICategory(cleanQuery);
  if (poiCategoryMatch) {
    const location = extractLocation(cleanQuery.replace(new RegExp(poiCategoryMatch, 'g'), ''));
    return {
      intent: 'poi_category',
      poiCategory: poiCategoryMatch,
      location: location || undefined,
      originalQuery
    };
  }
  
  // 5. Check for POI + LOCATION intent
  // "pois bhairahawa", "hotel in pokhara"
  if (q.includes('poi') || q.includes('place') || q.includes('spot')) {
    const location = extractLocation(cleanQuery.replace(/poi|place|spot/g, ''));
    return {
      intent: 'poi',
      location: location || undefined,
      originalQuery
    };
  }
  
  // 6. Check if query is just a location name
  // "pokhara", "kathmandu", "new road"
  if (cleanQuery.length >= 2) {
    return {
      intent: 'place',
      location: cleanQuery || undefined,
      originalQuery
    };
  }
  
  // 7. Default: Mixed intent
  return {
    intent: 'mixed',
    originalQuery
  };
}

/**
 * Extract location name from query
 */
function extractLocation(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;
  
  // Remove common prefixes/suffixes
  let loc = trimmed
    .replace(/^in\s+/i, '')
    .replace(/^near\s+/i, '')
    .replace(/^around\s+/i, '')
    .trim();
  
  return loc || null;
}

/**
 * Detect highway reference
 */
function detectHighway(query: string): string | null {
  // Check for codes like NH01, FH02
  const codeMatch = query.match(/(nh|fh)\d+/i);
  if (codeMatch) {
    return codeMatch[0].toUpperCase();
  }
  
  // Check for highway names
  for (const name of HIGHWAY_NAMES) {
    if (query.includes(name)) {
      return name;
    }
  }
  
  // Check for "highway" keyword followed by something
  if (query.includes('highway')) {
    const parts = query.replace('highway', '').trim();
    if (parts.length >= 2) {
      return parts;
    }
    return 'highway';
  }
  
  return null;
}

/**
 * Detect POI category
 */
function detectPOICategory(query: string): string | null {
  for (const category of POI_CATEGORIES) {
    if (query.includes(category)) {
      // Map synonyms to standard categories
      if (['fuel', 'petrol', 'diesel'].includes(category)) return 'fuel';
      if (['hospital', 'clinic', 'pharmacy'].includes(category)) return 'medical';
      if (['hotel', 'lodging', 'resort'].includes(category)) return 'lodging';
      if (['restaurant', 'food', 'cafe'].includes(category)) return 'food';
      if (['atm', 'bank'].includes(category)) return 'banking';
      if (['temple', 'museum', 'tourist'].includes(category)) return 'tourist';
      return category;
    }
  }
  return null;
}

/**
 * Get user-friendly description of intent
 */
export function getIntentDescription(intent: IntentResult): string {
  switch (intent.intent) {
    case 'weather':
      return intent.location 
        ? `Weather in ${intent.location}`
        : 'Weather information';
    case 'traffic':
      return intent.location 
        ? `Traffic in ${intent.location}`
        : 'Traffic conditions';
    case 'highway':
      return `Highway: ${intent.highway}`;
    case 'poi_category':
      return intent.location
        ? `${intent.poiCategory} in ${intent.location}`
        : `Nearby ${intent.poiCategory}`;
    case 'poi':
      return intent.location
        ? `Places in ${intent.location}`
        : 'Places nearby';
    case 'place':
      return `Location: ${intent.location}`;
    case 'mixed':
      return 'Search results';
    default:
      return intent.originalQuery;
  }
}

/**
 * Get icon for intent
 */
export function getIntentIcon(intent: IntentResult): string {
  switch (intent.intent) {
    case 'weather': return '🌦️';
    case 'traffic': return '🚦';
    case 'highway': return '🛣️';
    case 'poi_category':
    case 'poi': return '📍';
    case 'place': return '📍';
    case 'mixed': return '🔍';
    default: return '🔍';
  }
}
