// frontend/src/services/routeHistoryService.ts
// Tracks user's route history (last 50 routes) in localStorage

const STORAGE_KEY = 'merosadak_route_history';
const MAX_ROUTES = 50;

export interface RouteRecord {
  id: string;
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string };
  distance: number; // km
  duration: number; // minutes
  timestamp: string;
  routeType: 'fastest' | 'safest' | 'scenic';
  highwayUsed?: string;
  incidents?: Array<{
    title: string;
    status: string;
    location: string;
  }>;
}

function getHistory(): RouteRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: RouteRecord[]): void {
  try {
    // Keep only last MAX_ROUTES
    const trimmed = history.slice(-MAX_ROUTES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[RouteHistory] Failed to save:', e);
  }
}

export const routeHistoryService = {
  /** Add a completed route to history */
  addRoute(route: Omit<RouteRecord, 'id' | 'timestamp'>): RouteRecord {
    const record: RouteRecord = {
      ...route,
      id: `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    const history = getHistory();
    history.push(record);
    saveHistory(history);
    return record;
  },

  /** Get all route history */
  getHistory(): RouteRecord[] {
    return getHistory();
  },

  /** Get last N routes */
  getRecent(limit = 10): RouteRecord[] {
    return getHistory().slice(-limit).reverse();
  },

  /** Get routes from last 7 days */
  getThisWeek(): RouteRecord[] {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return getHistory().filter(r => new Date(r.timestamp).getTime() > weekAgo);
  },

  /** Get routes from last 30 days */
  getThisMonth(): RouteRecord[] {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return getHistory().filter(r => new Date(r.timestamp).getTime() > monthAgo);
  },

  /** Calculate total distance traveled */
  getTotalDistance(period?: 'week' | 'month'): number {
    const routes = period === 'week' ? this.getThisWeek()
      : period === 'month' ? this.getThisMonth()
        : getHistory();

    return routes.reduce((sum, r) => sum + r.distance, 0);
  },

  /** Get most frequently visited destinations */
  getTopDestinations(limit = 5): Array<{ name: string; count: number }> {
    const history = getHistory();
    const counts = new Map<string, number>();

    history.forEach(r => {
      const name = r.to.name;
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  /** Get most used highways */
  getTopHighways(limit = 5): Array<{ highway: string; count: number }> {
    const history = getHistory().filter(r => r.highwayUsed);
    const counts = new Map<string, number>();

    history.forEach(r => {
      if (r.highwayUsed) {
        counts.set(r.highwayUsed, (counts.get(r.highwayUsed) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([highway, count]) => ({ highway, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  /** Clear all route history */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  /** Delete a specific route */
  deleteRoute(id: string): void {
    const history = getHistory().filter(r => r.id !== id);
    saveHistory(history);
  },
};
