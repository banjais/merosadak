/**
 * Route corridor scoping.
 *
 * Given the polyline of the chosen route, tells us for any point:
 *   - offKm    how far the point is from the route (nearest segment)
 *   - alongKm  how far along the route (from the origin) that nearest point is
 *
 * This is what lets the planner show only what is on THIS route, in the order
 * the traveller will meet it, instead of a whole-country list.
 *
 * Pure functions, no React, no I/O.
 */

export type LatLng = [number, number]; // [lat, lng]

export interface RouteIndex {
  pts: LatLng[];
  /** cumulative geometric km at each vertex (unscaled) */
  cumKm: number[];
  /** geometric length of the polyline */
  geometryKm: number;
  /** factor applied so alongKm agrees with the route distance shown to the user */
  scale: number;
}

export interface RouteHit<T> {
  item: T;
  alongKm: number;
  offKm: number;
}

const R_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nepal bounding box, used to tell [lat,lng] from [lng,lat] in loose data. */
const inLat = (v: number) => v >= 26 && v <= 31;
const inLng = (v: number) => v >= 79.5 && v <= 88.5;

/**
 * Some datasets store [lng, lat] (GeoJSON order), others [lat, lng].
 * Returns a [lat, lng] pair or null if neither reading falls inside Nepal.
 */
export function normalizeLatLng(a: unknown, b: unknown): LatLng | null {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  if (inLat(a) && inLng(b)) return [a, b];
  if (inLat(b) && inLng(a)) return [b, a];
  return null;
}

/**
 * Build an index over the route polyline.
 * @param displayTotalKm the distance the UI shows for the route; alongKm is
 *   scaled to it so "km 84" on the feed matches the route summary. The scale
 *   is only applied when it is plausible (a coarse polyline under-measures).
 */
export function buildRouteIndex(
  path: LatLng[] | undefined | null,
  displayTotalKm?: number
): RouteIndex | null {
  if (!path || path.length < 2) return null;
  const pts = path.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;

  const cumKm: number[] = [0];
  for (let i = 1; i < pts.length; i++) cumKm.push(cumKm[i - 1] + haversineKm(pts[i - 1], pts[i]));
  const geometryKm = cumKm[cumKm.length - 1];
  if (!(geometryKm > 0)) return null;

  let scale = 1;
  if (displayTotalKm && displayTotalKm > 0) {
    const s = displayTotalKm / geometryKm;
    if (s >= 0.5 && s <= 2) scale = s;
  }
  return { pts, cumKm, geometryKm, scale };
}

/** Nearest-segment projection of a point onto the route. */
export function projectOntoRoute(idx: RouteIndex, lat: number, lng: number): { alongKm: number; offKm: number } {
  const kx = 111.32 * Math.cos(toRad(lat));
  const ky = 110.574;
  let bestOff = Infinity;
  let bestAlong = 0;

  for (let i = 0; i < idx.pts.length - 1; i++) {
    const a = idx.pts[i];
    const b = idx.pts[i + 1];
    // local planar coordinates (km) with the query point at the origin
    const ax = (a[1] - lng) * kx;
    const ay = (a[0] - lat) * ky;
    const bx = (b[1] - lng) * kx;
    const by = (b[0] - lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < bestOff) {
      bestOff = off;
      bestAlong = idx.cumKm[i] + t * (idx.cumKm[i + 1] - idx.cumKm[i]);
    }
  }
  return { alongKm: bestAlong * idx.scale, offKm: bestOff };
}

/**
 * Keep only items within `maxOffKm` of the route, ordered by position along it.
 * `getPos` may return null for items without usable coordinates (they are dropped).
 */
export function scopeToRoute<T>(
  items: readonly T[] | undefined | null,
  idx: RouteIndex | null,
  getPos: (t: T) => LatLng | null,
  maxOffKm: number
): RouteHit<T>[] {
  if (!items || !idx) return [];
  const hits: RouteHit<T>[] = [];
  for (const item of items) {
    const pos = getPos(item);
    if (!pos) continue;
    const { alongKm, offKm } = projectOntoRoute(idx, pos[0], pos[1]);
    if (offKm <= maxOffKm) hits.push({ item, alongKm, offKm });
  }
  hits.sort((a, b) => a.alongKm - b.alongKm);
  return hits;
}
