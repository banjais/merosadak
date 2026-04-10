// frontend/src/services/savedLocationsService.ts
// Bookmarked/saved locations with categories

const STORAGE_KEY = 'merosadak_saved_locations';
const MAX_LOCATIONS = 20;

export type LocationCategory = 'home' | 'work' | 'favorite' | 'frequent' | 'custom';

export interface SavedLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: LocationCategory;
  address?: string;
  addedAt: string;
  lastVisited?: string;
  visitCount: number;
  color?: string; // custom marker color
  notes?: string;
}

const CATEGORY_DEFAULTS: Record<LocationCategory, { icon: string; color: string; label: string }> = {
  home: { icon: '🏠', color: '#3b82f6', label: 'Home' },
  work: { icon: '💼', color: '#8b5cf6', label: 'Work' },
  favorite: { icon: '⭐', color: '#f59e0b', label: 'Favorite' },
  frequent: { icon: '📍', color: '#10b981', label: 'Frequent' },
  custom: { icon: '📌', color: '#6b7280', label: 'Custom' },
};

function getLocations(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocations(locations: SavedLocation[]): void {
  try {
    const trimmed = locations.slice(0, MAX_LOCATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[SavedLocations] Failed to save:', e);
  }
}

export const savedLocationsService = {
  CATEGORY_DEFAULTS,

  /** Add a new saved location */
  addLocation(loc: Omit<SavedLocation, 'id' | 'addedAt' | 'visitCount'>): SavedLocation {
    const location: SavedLocation = {
      ...loc,
      id: `loc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString(),
      visitCount: 0,
    };

    const locations = getLocations();
    locations.push(location);
    saveLocations(locations);
    return location;
  },

  /** Get all saved locations */
  getLocations(): SavedLocation[] {
    return getLocations();
  },

  /** Get locations by category */
  getByCategory(category: LocationCategory): SavedLocation[] {
    return getLocations().filter(l => l.category === category);
  },

  /** Get a specific location by ID */
  getById(id: string): SavedLocation | undefined {
    return getLocations().find(l => l.id === id);
  },

  /** Update a saved location */
  updateLocation(id: string, updates: Partial<SavedLocation>): void {
    const locations = getLocations().map(l =>
      l.id === id ? { ...l, ...updates } : l
    );
    saveLocations(locations);
  },

  /** Record a visit to a saved location */
  recordVisit(id: string): void {
    const locations = getLocations().map(l =>
      l.id === id
        ? { ...l, lastVisited: new Date().toISOString(), visitCount: l.visitCount + 1 }
        : l
    );
    saveLocations(locations);
  },

  /** Delete a saved location */
  deleteLocation(id: string): void {
    const locations = getLocations().filter(l => l.id !== id);
    saveLocations(locations);
  },

  /** Get most visited locations */
  getMostVisited(limit = 5): SavedLocation[] {
    return getLocations()
      .filter(l => l.visitCount > 0)
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, limit);
  },

  /** Get recently visited locations */
  getRecentlyVisited(limit = 5): SavedLocation[] {
    return getLocations()
      .filter(l => l.lastVisited)
      .sort((a, b) => new Date(b.lastVisited!).getTime() - new Date(a.lastVisited!).getTime())
      .slice(0, limit);
  },

  /** Search saved locations */
  search(query: string): SavedLocation[] {
    const q = query.toLowerCase();
    return getLocations().filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.address?.toLowerCase().includes(q) ||
      l.notes?.toLowerCase().includes(q)
    );
  },

  /** Clear all saved locations */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  /** Get location count */
  getCount(): number {
    return getLocations().length;
  },

  /** Check if at max capacity */
  isFull(): boolean {
    return getLocations().length >= MAX_LOCATIONS;
  },
};
