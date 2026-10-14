// One shared GPS fix for the whole app. Session storage is the hand-off between
// the surfaces that need a location: the map (centres on it), My Location
// (describes it) and the Route Planner (routes from it). Previously each one
// ran its own detection, so the planner could show a different place than the
// My Location page for the same fix.

export const GPS_CACHE_KEY = 'mero-sadak-gps';

/** A fix older than this is treated as absent, so a stale pin never wins. */
export const GPS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export interface GpsFix {
  lat: number;
  lng: number;
  timestamp: number;
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The last known fix, or null when storage is unavailable (private mode,
 * disabled storage, SSR) or nothing usable was stored.
 */
export function readCachedGps(): GpsFix | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(GPS_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { lat, lng, timestamp } = parsed as Record<string, unknown>;
    if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return null;
    // Reject (0, 0) and the mirror case: the null-coordinate guard that keeps
    // the graph builder honest applies here too, or a bad fix reads as a
    // position in the Gulf of Guinea.
    if (lat === 0 || lng === 0) return null;
    return { lat, lng, timestamp: isFiniteCoord(timestamp) ? timestamp : 0 };
  } catch {
    return null;
  }
}

/** Reads the cache but only returns a fix that is still fresh. */
export function readFreshCachedGps(maxAgeMs: number = GPS_CACHE_MAX_AGE_MS): GpsFix | null {
  const cached = readCachedGps();
  if (!cached) return null;
  if (Date.now() - cached.timestamp > maxAgeMs) return null;
  return cached;
}

export function writeCachedGps(lat: number, lng: number): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng) || lat === 0 || lng === 0) return;
  try {
    window.sessionStorage.setItem(GPS_CACHE_KEY, JSON.stringify({ lat, lng, timestamp: Date.now() }));
  } catch {
    /* storage full or blocked — the fix still works, it just isn't cached */
  }
}
