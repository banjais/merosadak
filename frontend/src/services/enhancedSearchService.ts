// src/services/enhancedSearchService.ts
// Comprehensive search service with debouncing, grouping, and context

import { apiFetch } from '../api';
import { searchEnhancedPOIs, getRelevantCategories, getCategoryColorClass } from './enhancedPOIService';
import { getUserPOIPreferences } from './userPreferencesService';
import { TravelPlan } from '../types/travelPlan';
import { detectSearchIntent, IntentResult } from './searchIntent';

export interface SearchResult {
  id: string;
  type: 'place' | 'highway' | 'poi' | 'recent' | 'traffic';
  name: string;
  subtitle?: string;
  icon: string;
  lat?: number;
  lng?: number;
  distance?: number; // km from user
  data?: any; // Additional context data
}

export interface GroupedSearchResults {
  places: SearchResult[];
  highways: SearchResult[];
  pois: SearchResult[];
  recents: SearchResult[];
}

export interface RouteInfo {
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string };
  distance: number; // km
  duration: number; // hours
  highways: string[];
  incidents: number;
  blockedSections: number;
  status: 'clear' | 'partial' | 'blocked';
  alternatives?: RouteInfo[];
}

// Debounced search function
let searchTimeout: NodeJS.Timeout | null = null;

export function debouncedSearch(
  query: string,
  userLocation: { lat: number; lng: number } | null,
  maxResults: number = 7,
  callback: (groupedResults: GroupedSearchResults, intent: IntentResult) => void
) {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // Wait 300ms after user stops typing
  searchTimeout = setTimeout(async () => {
    if (!query || query.length < 2) {
      // Return recent searches if query is empty
      const recents = await getRecentSearches();
      callback({ places: [], highways: [], pois: [], recents }, { intent: 'mixed', originalQuery: '' });
      return;
    }

    try {
      // Detect intent FIRST
      const intent = detectSearchIntent(query);

      // Then perform enhanced search with intent context
      const results = await performEnhancedSearch(query, userLocation, maxResults, intent);
      callback(results, intent);
    } catch (err) {
      console.error('[EnhancedSearch] Search failed:', err);
      const intent = detectSearchIntent(query);
      callback({ places: [], highways: [], pois: [], recents: await getRecentSearches() }, intent);
    }
  }, 300);
}

// Main search function
async function performEnhancedSearch(
  query: string,
  userLocation: { lat: number; lng: number } | null,
  maxResults: number = 7,
  intent?: IntentResult
): Promise<GroupedSearchResults> {
  const results: GroupedSearchResults = {
    places: [],
    highways: [],
    pois: [],
    recents: []
  };

  const detectedIntent = intent || detectSearchIntent(query);

  // Parallel searches (including traffic)
  const [placeResults, highwayResults, poiResults, trafficResults] = await Promise.allSettled([
    searchPlaces(query, userLocation),
    searchHighways(query, detectedIntent),
    searchPOIs(query, userLocation, detectedIntent),
    shouldSearchTraffic(query, detectedIntent)
      ? searchTraffic(userLocation)
      : Promise.resolve([])
  ]);

  // Process results
  if (placeResults.status === 'fulfilled') {
    results.places = placeResults.value.slice(0, 3);
  }

  if (highwayResults.status === 'fulfilled') {
    results.highways = highwayResults.value.slice(0, 2);
  }

  if (poiResults.status === 'fulfilled') {
    results.pois = poiResults.value.slice(0, 3);
  }

  // Add traffic results if searched
  if (trafficResults.status === 'fulfilled' && trafficResults.value.length > 0) {
    // Merge traffic into POIs with 'traffic' type
    results.pois = [...trafficResults.value.slice(0, 2), ...results.pois].slice(0, 5);
  }

  // Get recent searches
  results.recents = await getRecentSearches(query);

  return results;
}

// Search places using Nominatim + backend
async function searchPlaces(
  query: string,
  userLocation: { lat: number; lng: number } | null
): Promise<SearchResult[]> {
  try {
    // Try Nominatim first
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=np&limit=5`
    );

    if (!response.ok) throw new Error('Nominatim failed');

    const data = await response.json();

    return data.map((item: any) => ({
      id: `place-${item.place_id}`,
      type: 'place' as const,
      name: item.display_name.split(',')[0],
      subtitle: item.display_name.split(',').slice(1, 3).join(','),
      icon: '📍',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      distance: userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, parseFloat(item.lat), parseFloat(item.lon))
        : undefined
    }));
  } catch (err) {
    // Fallback to backend search
    try {
      const result = await apiFetch<any>(`/v1/search?q=${encodeURIComponent(query)}&limit=5`);
      return (result.data || []).map((item: any) => ({
        id: `search-${item.id || item.name}`,
        type: 'place' as const,
        name: item.name || item.title,
        subtitle: item.type || item.source,
        icon: '📍',
        lat: item.lat,
        lng: item.lng
      }));
    } catch {
      return [];
    }
  }
}

// Search highways with intent context
async function searchHighways(query: string, intent?: IntentResult): Promise<SearchResult[]> {
  try {
    const result = await apiFetch<any>('/v1/highways');
    const highways = result.data || [];

    // If highway intent, prioritize match
    if (intent?.intent === 'highway' && intent.highway) {
      const queryLower = intent.highway.toLowerCase();
      const scored = highways
        .map((h: any) => {
          const codeLower = (h.code || '').toLowerCase();
          const nameLower = (h.name || '').toLowerCase();
          const districtsLower = (h.districts || []).map((d: string) => d.toLowerCase());

          let score = 0;
          if (codeLower === queryLower) score = 100;
          else if (codeLower.includes(queryLower)) score = 90;
          else if (nameLower.includes(queryLower)) score = 80;
          else if (districtsLower.some((d: string) => d.includes(queryLower))) score = 60;

          return { ...h, score };
        })
        .filter((h: any) => h.score > 0)
        .sort((a: any, b: any) => b.score - a.score);

      return scored.map((h: any) => ({
        id: `highway-${h.code}`,
        type: 'highway' as const,
        name: `${h.code} - ${h.name || h.code}`,
        subtitle: h.districts?.slice(0, 3).join(', ') || 'National Highway',
        icon: '🛣️',
        data: h
      }));
    }

    // Default fuzzy search
    const queryLower = query.toLowerCase();
    const scored = highways
      .map((h: any) => {
        const codeLower = (h.code || '').toLowerCase();
        const nameLower = (h.name || '').toLowerCase();

        let score = 0;
        if (codeLower === queryLower) score = 100;
        else if (codeLower.includes(queryLower)) score = 90;
        else if (nameLower.includes(queryLower)) score = 80;

        return { ...h, score };
      })
      .filter((h: any) => h.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5);

    return scored.map((h: any) => ({
      id: `highway-${h.code}`,
      type: 'highway' as const,
      name: `${h.code} - ${h.name || h.code}`,
      subtitle: h.districts?.slice(0, 3).join(', ') || 'National Highway',
      icon: '🛣️',
      data: h
    }));
  } catch {
    return [];
  }
}

// Determine if we should search traffic based on intent
function shouldSearchTraffic(query: string, intent?: IntentResult): boolean {
  if (intent?.intent === 'traffic') return true;
  const q = query.toLowerCase();
  return q.includes('traffic') || q.includes('jam') || q.includes('congestion') || q.includes('blocked');
}

// Search POIs with intent context
async function searchPOIs(query: string, userLocation: { lat: number; lng: number } | null, intent?: IntentResult): Promise<SearchResult[]> {
  if (!userLocation) return [];

  try {
    const preferences = getUserPOIPreferences();
    const context = {
      timeOfDay: getTimeOfDay() as any,
      weather: 'clear' as any,
      tripDuration: 0,
      distanceTraveled: 0,
      isHighway: false,
      hasChildren: false,
      hasElderly: false
    };

    // If POI category intent, search for that category
    let searchQuery = query;
    if (intent?.intent === 'poi_category' && intent.poiCategory) {
      searchQuery = intent.poiCategory;
    } else if (intent?.intent === 'poi' && intent.location) {
      searchQuery = intent.location;
    }

    const groupedPOIs = await searchEnhancedPOIs(searchQuery, userLocation, preferences, context, 10);

    // Flatten and convert to SearchResult
    const results: SearchResult[] = [];
    Object.entries(groupedPOIs).forEach(([category, pois]) => {
      pois.slice(0, 3).forEach(poi => {
        results.push({
          id: `poi-${poi.id}`,
          type: 'poi' as const,
          name: poi.name,
          subtitle: `${category} · ${poi.distance?.toFixed(1) || '?'} km`,
          icon: poi.icon,
          lat: poi.lat,
          lng: poi.lng,
          distance: poi.distance,
          score: poi.score
        });
      });
    });

    return results.slice(0, intent?.intent === 'poi' || intent?.intent === 'poi_category' ? 10 : 5);
  } catch {
    return [];
  }
}

// Get time of day
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// Search traffic conditions
async function searchTraffic(userLocation: { lat: number; lng: number } | null): Promise<SearchResult[]> {
  if (!userLocation) return [];

  try {
    const result = await apiFetch(`/v1/traffic/flow?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=20`);

    if (!(result as any)?.success || !(result as any)?.data) return [];

    const traffic = (result as any).data;
    const results: SearchResult[] = [];

    // Add traffic summary as a result
    if (traffic.summary) {
      results.push({
        id: 'traffic-summary',
        type: 'traffic' as const,
        name: 'Traffic Conditions',
        subtitle: `${traffic.summary.congestedSegments} congested areas · Avg speed ${traffic.summary.averageSpeed} km/h`,
        icon: '🚦',
        lat: userLocation.lat,
        lng: userLocation.lng,
        distance: 0
      });
    }

    // Add Waze alerts as results
    if (traffic.wazeAlerts) {
      traffic.wazeAlerts.slice(0, 3).forEach((alert: any) => {
        results.push({
          id: `traffic-alert-${alert.id}`,
          type: 'traffic' as const,
          name: alert.type.replace(/_/g, ' '),
          subtitle: alert.description,
          icon: '🚨',
          lat: alert.location?.lat,
          lng: alert.location?.lng,
          distance: alert.location ? calculateDistance(userLocation.lat, userLocation.lng, alert.location.lat, alert.location.lng) : undefined
        });
      });
    }

    return results;
  } catch {
    return [];
  }
}

// Recent searches management
const RECENT_KEY = 'merosadak_recent_searches';

async function getRecentSearches(currentQuery?: string): Promise<SearchResult[]> {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    const recents: SearchResult[] = stored ? JSON.parse(stored) : [];

    // Filter out current query if provided
    return currentQuery
      ? recents.filter(r => r.name.toLowerCase().includes(currentQuery.toLowerCase())).slice(0, 3)
      : recents.slice(0, 3);
  } catch {
    return [];
  }
}

export function saveRecentSearch(result: SearchResult) {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    const recents: SearchResult[] = stored ? JSON.parse(stored) : [];

    // Remove if already exists
    const filtered = recents.filter(r => r.id !== result.id);

    // Add to front, limit to 10
    const updated = [result, ...filtered].slice(0, 10);

    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[EnhancedSearch] Failed to save recent search:', err);
  }
}

// Utility: Haversine distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const EARTH_RADIUS_KM = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

// Utility: Get POI icon
function getPoiIcon(type?: string): string {
  if (!type) return '📍';
  const t = type.toLowerCase();
  if (t.includes('fuel') || t.includes('petrol') || t.includes('gas')) return '⛽';
  if (t.includes('food') || t.includes('restaurant') || t.includes('hotel')) return '🍽️';
  if (t.includes('hospital') || t.includes('medical') || t.includes('health')) return '🏥';
  if (t.includes('police')) return '🚔';
  if (t.includes('tourist') || t.includes('attraction')) return '📸';
  return '📍';
}
