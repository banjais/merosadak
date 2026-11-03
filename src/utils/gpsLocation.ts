// One shared GPS fix for the whole app. Session storage is the hand-off between
// the surfaces that need a location: the map (centres on it), My Location
// (describes it) and the Route Planner (routes from it). Previously each one
// ran its own detection, so the planner could show a different place than the
// My Location page for the same fix.

export const GPS_CACHE_KEY = 'mero-sadak-gps';

/** Persistent last-known fix (localStorage). Survives browser restarts so a
 * refresh — even days later — boots the map on the user's area instead of a
 * country-wide view. Unlike the session cache there is no freshness cutoff:
 * a stale position still beats showing all of Nepal. */
export const GPS_LAST_KNOWN_KEY = 'mero-sadak-gps-last';

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

/**
 * The last known fix from persistent storage (localStorage), whatever its age.
 * Falls back to null when nothing usable was ever stored or storage is
 * unavailable. Used for the map boot camera: any real position is a better
 * first view than the whole-country overview.
 */
export function readLastKnownGps(): GpsFix | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(GPS_LAST_KNOWN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { lat, lng, timestamp } = parsed as Record<string, unknown>;
    if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return null;
    if (lat === 0 || lng === 0) return null;
    return { lat, lng, timestamp: isFiniteCoord(timestamp) ? timestamp : 0 };
  } catch {
    return null;
  }
}

export function writeCachedGps(lat: number, lng: number): void {
  if (typeof window === 'undefined') return;
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng) || lat === 0 || lng === 0) return;
  try {
    if (window.sessionStorage) {
      window.sessionStorage.setItem(GPS_CACHE_KEY, JSON.stringify({ lat, lng, timestamp: Date.now() }));
    }
    // Persist across sessions too, so a refresh always reopens on the user's
    // area rather than falling back to a country-wide view.
    if (window.localStorage) {
      window.localStorage.setItem(GPS_LAST_KNOWN_KEY, JSON.stringify({ lat, lng, timestamp: Date.now() }));
    }
  } catch {
    /* storage full or blocked — the fix still works, it just isn't cached */
  }
}
