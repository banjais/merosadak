// One shared reverse geocoder for the whole app.
//
// My Location and the Route Planner both describe a GPS fix as a place. They
// previously used two different sources — the My Location page asked Nominatim
// for the real address, while the planner snapped the label to the nearest
// settlement in its own dataset — so the same fix could read as two different
// places ("Naubise" in the planner, "Naikap, Chandragiri" on the page). Every
// surface now resolves a fix through this module, so the planner's "My
// Location" agrees with the My Location page.
//
// The planner still snaps its ROUTING origin to the nearest graph node (the
// road graph cannot route from an arbitrary address), but the label it shows
// comes from here.
//
// OSM Nominatim usage policy forbids per-sample requests, so results are
// cached per ~110 m grid cell for 10 minutes and callers re-describe their
// position only after moving at least 25 m.

import { getDistanceKm } from './geoUtils';

export interface ReverseGeocodeAddress {
  /** Street-level place: road, path, neighbourhood, suburb, hamlet or village. */
  localArea: string | null;
  /** City / town / municipality / county from the OSM address block. */
  municipality: string | null;
  district: string | null;
  province: string | null;
  postcode: string | null;
  country: string | null;
  /** OSM's full display_name, every component joined. */
  displayName: string | null;
  /** The compact parts joined — what My Location headlines. */
  formatted: string | null;
}

export interface ReverseGeocodeResult extends ReverseGeocodeAddress {
  lat: number;
  lng: number;
}

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

/** Re-describe the position only after the fix moved this far. */
const MIN_MOVE_METRES = 25;
/** Cached results older than this are re-fetched even for the same cell. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

const CACHE_KEY_PREFIX = 'mero-sadak-revgeo-';

function gridKey(lat: number, lng: number): string {
  // ~110 m grid: fixes on the same street usually share a cell, so walking
  // around one neighbourhood does not re-request for every GPS sample.
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

interface CacheEntry {
  at: number;
  address: ReverseGeocodeAddress;
}

function readCache(key: string): CacheEntry | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.at !== 'number' || !parsed.address) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(CACHE_KEY_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, address: ReverseGeocodeAddress): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const entry: CacheEntry = { at: Date.now(), address };
    window.sessionStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* storage full or blocked — the address still resolves, just uncached */
  }
}

/** The exact field mapping My Location has always shown, kept verbatim. */
function readOsmAddress(data: unknown): ReverseGeocodeAddress {
  const block = (data as { address?: Record<string, string>; display_name?: string } | null) || {};
  const a = block.address || {};
  const parts: string[] = [];
  const localPlace =
    a.road || a.path || a.footway || a.pedestrian || a.neighbourhood || a.suburb || a.hamlet || a.village;
  if (localPlace) parts.push(localPlace);
  const city = a.city || a.town || a.municipality || a.county;
  if (city) parts.push(city);
  const district = a.district;
  if (district && district !== city) parts.push(district);
  const province = a.state || a.province;
  if (province) parts.push(province);
  const postcode = a.postcode;
  if (postcode) parts.push(postcode);
  const country = a.country;
  if (country) parts.push(country);
  return {
    localArea: localPlace ?? null,
    municipality: city ?? null,
    district: district ?? null,
    province: province ?? null,
    postcode: postcode ?? null,
    country: country ?? null,
    displayName: block.display_name ?? null,
    formatted: parts.join(', ') || null,
  };
}

const inflight = new Map<string, Promise<ReverseGeocodeResult | null>>();

/**
 * Describe a coordinate as a place, the same way the My Location page does.
 * Resolves null when OSM is unreachable (offline, rate limited) — callers keep
 * whatever place description they already have. Failed results are not cached,
 * so the next fix retries and an offline session recovers without a reload.
 */
export function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const key = gridKey(lat, lng);
  const cached = readCache(key);
  if (cached) {
    return Promise.resolve({ lat, lng, ...cached.address });
  }

  const running = inflight.get(key);
  if (running) return running;

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        `${NOMINATIM_REVERSE}?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' }, signal: controller.signal },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const address = readOsmAddress(data);
      writeCache(key, address);
      return { lat, lng, ...address };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

/**
 * Rate-limit gate: true when `last` is unset or the fix has moved far enough
 * from the last resolved position to justify describing it again.
 */
export function movedPastLastGeocode(
  lat: number,
  lng: number,
  last: { lat: number; lng: number } | null,
): boolean {
  if (!last) return true;
  return getDistanceKm(last.lat, last.lng, lat, lng) * 1000 > MIN_MOVE_METRES;
}

/**
 * The short place name an origin field should read: the street-level area and
 * municipality joined, falling back to whichever one exists. Duplicate parts
 * ("Kirtipur, Kirtipur") are collapsed.
 */
export function shortLocalityLabel(address: ReverseGeocodeAddress | null | undefined): string | null {
  if (!address) return null;
  const parts = [address.localArea, address.municipality].filter(
    (p): p is string => !!p,
  );
  const unique = [...new Set(parts)];
  return unique.join(', ') || null;
}
