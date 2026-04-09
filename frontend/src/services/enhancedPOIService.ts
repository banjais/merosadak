// src/services/enhancedPOIService.ts
// Enhanced POI search with personalization and scoring

import { apiFetch } from '../api';
import {
  EnhancedPOI,
  GroupedPOIs,
  POICategory,
  POI_CATEGORIES,
  UserPOIPreferences,
  TripContext
} from '../types/poi';

// Main enhanced POI search
export async function searchEnhancedPOIs(
  query: string,
  userLocation: { lat: number; lng: number } | null,
  preferences: UserPOIPreferences,
  context: TripContext,
  maxResults: number = 20
): Promise<GroupedPOIs> {
  if (!userLocation) {
    return {};
  }

  try {
    // Fetch POIs from backend
    const pois = await fetchPOIs(query, userLocation, maxResults);
    
    // Score each POI based on preferences and context
    const scored = pois.map(poi => ({
      ...poi,
      score: calculatePOIScore(poi, preferences, context, userLocation)
    }));
    
    // Sort by score
    const sorted = scored.sort((a, b) => b.score - a.score);
    
    // Group by category
    return groupByCategory(sorted);
  } catch (err) {
    console.error('[EnhancedPOI] Search failed:', err);
    return {};
  }
}

// Fetch POIs from backend
async function fetchPOIs(
  query: string,
  userLocation: { lat: number; lng: number },
  maxResults: number
): Promise<EnhancedPOI[]> {
  try {
    const result = await apiFetch<any>(
      `/v1/pois?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lng=${userLocation.lng}&limit=${maxResults}`
    );
    
    return (result.data || []).map((poi: any) => ({
      id: poi.id || `poi-${poi.name}-${Math.random()}`,
      name: poi.name || poi.title || 'Unknown POI',
      category: categorizePOI(poi.type),
      subcategory: poi.subcategory,
      lat: poi.lat || 0,
      lng: poi.lng || 0,
      distance: poi.distance,
      rating: poi.rating,
      isOpen: poi.isOpen,
      isAccessible: poi.isAccessible,
      score: 0, // Will be calculated later
      icon: getCategoryIcon(poi.type),
      address: poi.address,
      phone: poi.phone,
      website: poi.website,
      description: poi.description
    }));
  } catch (err) {
    console.error('[EnhancedPOI] Failed to fetch POIs:', err);
    return [];
  }
}

// Calculate POI score based on user preferences and context
function calculatePOIScore(
  poi: EnhancedPOI,
  preferences: UserPOIPreferences,
  context: TripContext,
  userLocation: { lat: number; lng: number }
): number {
  let score = 0;
  
  // 1. Distance score (closer = higher)
  const distance = poi.distance || calculateDistance(
    userLocation.lat, userLocation.lng,
    poi.lat, poi.lng
  );
  score += Math.max(0, 50 - distance * 2); // 50 points at 0km, 0 points at 25km
  
  // 2. Category relevance score based on age group
  const categoryInfo = POI_CATEGORIES.find(c => c.id === poi.category);
  if (categoryInfo) {
    const ageScore = categoryInfo.ageRelevance[preferences.ageGroup] * 30;
    score += ageScore;
  }
  
  // 3. Interest score
  if (preferences.interests.includes(poi.category)) {
    score += 25;
  }
  
  // 4. Favorite categories boost (learned behavior)
  if (preferences.favoriteCategories?.indexOf(poi.category) === 0) {
    score += 20; // Top favorite
  } else if (preferences.favoriteCategories?.includes(poi.category)) {
    score += 10;
  }
  
  // 5. Context-based scoring
  // Time of day
  if (context.timeOfDay === 'night' && (poi.category === 'lodging' || poi.category === 'food')) {
    score += 15;
  }
  
  if (context.timeOfDay === 'morning' && poi.category === 'cafe') {
    score += 10;
  }
  
  // Weather
  if (context.weather === 'rainy' && (poi.category === 'lodging' || poi.category === 'cafe')) {
    score += 10;
  }
  
  // Trip duration
  if (context.tripDuration > 3 && poi.category === 'food') {
    score += 10;
  }
  
  if (context.distanceTraveled > 100 && poi.category === 'fuel') {
    score += 15;
  }
  
  // 6. Accessibility boost
  if (preferences.accessibility && poi.isAccessible) {
    score += 40;
  }
  
  // 7. Traveling with elderly/kids
  if (preferences.travelingWith === 'elderly' && poi.category === 'medical') {
    score += 20;
  }
  
  if (preferences.travelingWith === 'family' && (poi.category === 'family' || poi.category === 'food')) {
    score += 15;
  }
  
  // 8. Travel style
  if (preferences.travelStyle === 'budget' && poi.category === 'atm') {
    score += 10;
  }
  
  if (preferences.travelStyle === 'luxury' && (poi.category === 'lodging' || poi.category === 'food')) {
    score += 10;
  }
  
  if (preferences.travelStyle === 'adventure' && poi.category === 'adventure') {
    score += 20;
  }
  
  // 9. Rating bonus
  if (poi.rating) {
    score += poi.rating * 3; // Up to 15 points for 5-star
  }
  
  return Math.round(score);
}

// Group POIs by category
function groupByCategory(pois: EnhancedPOI[]): GroupedPOIs {
  const grouped: GroupedPOIs = {};
  
  pois.forEach(poi => {
    const category = poi.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(poi);
  });
  
  // Sort each category by score
  Object.keys(grouped).forEach(category => {
    grouped[category].sort((a, b) => b.score - a.score);
  });
  
  return grouped;
}

// Categorize POI from backend type
function categorizePOI(type?: string): POICategory {
  if (!type) return 'tourist';
  
  const t = type.toLowerCase();
  
  if (t.includes('fuel') || t.includes('petrol') || t.includes('gas') || t.includes('station')) return 'fuel';
  if (t.includes('restaurant') || t.includes('food') || t.includes('meal') || t.includes('dining')) return 'food';
  if (t.includes('cafe') || t.includes('coffee') || t.includes('tea') || t.includes('bakery')) return 'cafe';
  if (t.includes('hotel') || t.includes('lodging') || t.includes('resort') || t.includes('homestay')) return 'lodging';
  if (t.includes('hospital') || t.includes('medical') || t.includes('health') || t.includes('pharmacy') || t.includes('clinic')) return 'medical';
  if (t.includes('shop') || t.includes('market') || t.includes('mall') || t.includes('store')) return 'shopping';
  if (t.includes('temple') || t.includes('church') || t.includes('mosque') || t.includes('museum') || t.includes('heritage')) return 'culture';
  if (t.includes('adventure') || t.includes('trek') || t.includes('paraglid') || t.includes('rafting')) return 'adventure';
  if (t.includes('tourist') || t.includes('viewpoint') || t.includes('landmark') || t.includes('scenic')) return 'tourist';
  if (t.includes('park') || t.includes('garden') || t.includes('waterfall') || t.includes('lake') || t.includes('wildlife')) return 'nature';
  if (t.includes('bank') || t.includes('atm') || t.includes('money') || t.includes('exchange')) return 'banking';
  if (t.includes('police') || t.includes('fire') || t.includes('emergency') || t.includes('rescue')) return 'emergency';
  if (t.includes('bus') || t.includes('taxi') || t.includes('airport') || t.includes('transport')) return 'transport';
  if (t.includes('school') || t.includes('college') || t.includes('library') || t.includes('education')) return 'education';
  if (t.includes('gym') || t.includes('fitness') || t.includes('yoga') || t.includes('sport')) return 'fitness';
  if (t.includes('salon') || t.includes('spa') || t.includes('massage') || t.includes('laundry')) return 'personal';
  if (t.includes('cinema') || t.includes('theater') || t.includes('entertainment') || t.includes('nightlife')) return 'entertainment';
  if (t.includes('pet') || t.includes('vet') || t.includes('animal')) return 'pet';
  if (t.includes('family') || t.includes('playground') || t.includes('daycare') || t.includes('baby')) return 'family';
  if (t.includes('access') || t.includes('wheelchair') || t.includes('disabled')) return 'accessible';
  if (t.includes('parking')) return 'parking';
  if (t.includes('restroom') || t.includes('toilet') || t.includes('wc')) return 'restroom';
  if (t.includes('wifi') || t.includes('internet')) return 'wifi';
  
  return 'tourist'; // Default
}

// Get category icon
function getCategoryIcon(type?: string): string {
  if (!type) return '📍';
  
  const category = categorizePOI(type);
  const catInfo = POI_CATEGORIES.find(c => c.id === category);
  return catInfo?.icon || '📍';
}

// Calculate distance (Haversine)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Get relevant categories for user's age group
export function getRelevantCategories(ageGroup: string, limit: number = 12): POICategory[] {
  return POI_CATEGORIES
    .filter(cat => cat.ageRelevance[ageGroup as keyof typeof cat.ageRelevance] > 0.4)
    .sort((a, b) => b.ageRelevance[ageGroup as keyof typeof cat.ageRelevance] - a.ageRelevance[ageGroup as keyof typeof cat.ageRelevance])
    .slice(0, limit)
    .map(cat => cat.id);
}

// Get category color class
export function getCategoryColorClass(category: POICategory): string {
  const catInfo = POI_CATEGORIES.find(c => c.id === category);
  const color = catInfo?.color || 'gray';
  
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    pink: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300',
    teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
    lime: 'bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800 text-lime-700 dark:text-lime-300',
    fuchsia: 'bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-200 dark:border-fuchsia-800 text-fuchsia-700 dark:text-fuchsia-300',
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
    brown: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    sky: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
    slate: 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300',
    gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300',
    zinc: 'bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
  };
  
  return colorMap[color] || colorMap.gray;
}
