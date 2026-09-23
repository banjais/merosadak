// Geographic utility functions for spatial calculations and route corridor filtering
import { NEPAL_HIGHWAYS, CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { CityNode, Highway } from '../types';

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function latLngToMeters(lat: number, lng: number, refLat: number): { x: number; y: number } {
  const kx = 111320 * Math.cos(toRadians(refLat));
  const ky = 110574;
  return { x: kx * toRadians(lng), y: ky * toRadians(lat) };
}

function closestPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): { x: number; y: number; along: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, along: 0 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { x: ax + t * dx, y: ay + t * dy, along: t };
}

function metersToKm(m: number): number {
  return m / 1000;
}

/**
 * Computes the perpendicular distance from a point to the nearest line segment
 * of a highway, using equirectangular projection at the point's latitude.
 * Returns distance in km and the nearest point on the road geometry.
 */
export function distanceToHighwayGeometry(
  lat: number, lng: number,
  coordinates: [number, number][]
): { distanceKm: number; nearestLat: number; nearestLng: number } | null {
  if (!coordinates || coordinates.length < 2) return null;
  const refLat = lat;
  const p = latLngToMeters(lat, lng, refLat);
  let minDistM = Infinity;
  let nearestLat = coordinates[0][0];
  let nearestLng = coordinates[0][1];

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = latLngToMeters(coordinates[i][0], coordinates[i][1], refLat);
    const b = latLngToMeters(coordinates[i + 1][0], coordinates[i + 1][1], refLat);
    const cp = closestPointOnSegment(p.x, p.y, a.x, a.y, b.x, b.y);
    const dx = cp.x - p.x;
    const dy = cp.y - p.y;
    const distM = Math.sqrt(dx * dx + dy * dy);
    if (distM < minDistM) {
      minDistM = distM;
      nearestLat = coordinates[i][0] + (coordinates[i + 1][0] - coordinates[i][0]) * cp.along;
      nearestLng = coordinates[i][1] + (coordinates[i + 1][1] - coordinates[i][1]) * cp.along;
    }
  }

  return { distanceKm: metersToKm(minDistM), nearestLat, nearestLng };
}

/**
 * Calculates the Haversine distance in kilometers between two lat/lng coordinates.
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determines whether a geographical point lies near a user's chosen route path
 * or its origin / destination endpoints within a specified distance buffer (default: 30 km).
 */
export function isPointNearRoute(
  pointLat: number,
  pointLng: number,
  pathCoordinates?: [number, number][],
  origin?: { lat: number; lng: number } | null,
  destination?: { lat: number; lng: number } | null,
  maxDistanceKm: number = 30
): boolean {
  if (origin && getDistanceKm(pointLat, pointLng, origin.lat, origin.lng) <= maxDistanceKm) {
    return true;
  }
  if (destination && getDistanceKm(pointLat, pointLng, destination.lat, destination.lng) <= maxDistanceKm) {
    return true;
  }
  if (!pathCoordinates || pathCoordinates.length === 0) {
    return false;
  }

  // Sample points along path to optimize performance
  const step = Math.max(1, Math.floor(pathCoordinates.length / 60));
  for (let i = 0; i < pathCoordinates.length; i += step) {
    const [pLat, pLng] = pathCoordinates[i];
    if (getDistanceKm(pointLat, pointLng, pLat, pLng) <= maxDistanceKm) {
      return true;
    }
  }

  // Always check the very last coordinate
  if (pathCoordinates.length > 0) {
    const last = pathCoordinates[pathCoordinates.length - 1];
    if (getDistanceKm(pointLat, pointLng, last[0], last[1]) <= maxDistanceKm) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the nearest highway junction (city/junction node) from a given coordinate.
 * Returns the nearest city, the distance in km, and the highways connected to it.
 */
export function findNearestHighwayJunction(lat: number, lng: number): {
  city: CityNode | null;
  distanceKm: number | null;
} {
  let closestCity: CityNode | null = null;
  let minDistKm = Infinity;

  CITIES_AND_JUNCTIONS.forEach((city) => {
    const d = getDistanceKm(lat, lng, city.lat, city.lng);
    if (d < minDistKm) {
      minDistKm = d;
      closestCity = city;
    }
  });

  return { city: closestCity, distanceKm: minDistKm < Infinity ? minDistKm : null };
}

/**
 * Finds the nearest highway segment from a given coordinate.
 * Uses perpendicular projection onto road geometry for accuracy,
 * falling back to waypoint distance for sparse data.
 */
export function findNearestHighwayFromCoords(lat: number, lng: number): {
  highway: Highway | null;
  segment: { from: string; to: string; distanceKm: number } | null;
  nearestPoint: { lat: number; lng: number } | null;
  distanceKm: number | null;
} | null {
  let nearest: {
    highway: Highway | null;
    segment: { from: string; to: string; distanceKm: number } | null;
    nearestPoint: { lat: number; lng: number } | null;
    distanceKm: number;
  } | null = null;

  for (const highway of NEPAL_HIGHWAYS) {
    if (!highway.segments) continue;
    for (const segment of highway.segments) {
      if (!segment.coordinates || segment.coordinates.length === 0) continue;

      // Use perpendicular projection for segments with 2+ points
      if (segment.coordinates.length >= 2) {
        const geoDist = distanceToHighwayGeometry(lat, lng, segment.coordinates);
        if (geoDist && (!nearest || geoDist.distanceKm < nearest.distanceKm)) {
          nearest = {
            highway,
            segment: {
              from: segment.from,
              to: segment.to,
              distanceKm: segment.distanceKm,
            },
            nearestPoint: { lat: geoDist.nearestLat, lng: geoDist.nearestLng },
            distanceKm: geoDist.distanceKm,
          };
        }
      } else {
        // Fallback: single waypoint
        const [segLat, segLng] = segment.coordinates[0];
        const d = getDistanceKm(lat, lng, segLat, segLng);
        if (!nearest || d < nearest.distanceKm) {
          nearest = {
            highway,
            segment: {
              from: segment.from,
              to: segment.to,
              distanceKm: segment.distanceKm,
            },
            nearestPoint: { lat: segLat, lng: segLng },
            distanceKm: d,
          };
        }
      }
    }
  }

  return nearest;
}

export interface HighwayDistanceInfo {
  totalDistanceKm: number;
  source: 'road_graph' | 'snh_links' | 'highway_data';
  linkSumKm?: number;
  snhPublishedKm?: number;
  note?: string;
}

export function getHighwayTotalDistance(
  highwayCode: string,
  roadGraph?: { highways: string[]; adjacency: [number, number, number][][]; nodes: [number, number][] } | null,
  snhLinks?: any[] | null
): HighwayDistanceInfo | null {
  const code = highwayCode.trim().toUpperCase();

  let roadGraphKm = 0;
  if (roadGraph && roadGraph.highways) {
    for (let i = 0; i < roadGraph.highways.length; i++) {
      if (roadGraph.highways[i].toUpperCase() === code) {
        for (const node of roadGraph.adjacency) {
          for (const [to, dist, hwyIdx] of node) {
            if (hwyIdx === i) {
              roadGraphKm += dist;
            }
          }
        }
      }
    }
  }

  let snhLinkSumKm = 0;
  if (snhLinks && snhLinks.length > 0) {
    for (const link of snhLinks) {
      if ((link.highway || '').toUpperCase() === code || (link.code || '').toUpperCase().startsWith(code)) {
        snhLinkSumKm += link.length_km || 0;
      }
    }
  }

  const highway = NEPAL_HIGHWAYS.find(
    (h) => h.code.toLowerCase() === code.toLowerCase() || h.id.toLowerCase() === code.toLowerCase()
  );

  if (roadGraphKm > 0) {
    return {
      totalDistanceKm: Math.round(roadGraphKm * 100) / 100,
      source: 'road_graph',
      linkSumKm: snhLinkSumKm > 0 ? Math.round(snhLinkSumKm * 100) / 100 : undefined,
      note: highway ? `${highway.name} — DoR official chainage from road-graph edges` : undefined,
    };
  }

  if (snhLinkSumKm > 0) {
    return {
      totalDistanceKm: Math.round(snhLinkSumKm * 100) / 100,
      source: 'snh_links',
      linkSumKm: Math.round(snhLinkSumKm * 100) / 100,
      note: 'Summed from SNH 2022/23 published survey links',
    };
  }

  if (highway && highway.totalLengthKm > 0) {
    return {
      totalDistanceKm: highway.totalLengthKm,
      source: 'highway_data',
      note: `${highway.name} — length from curated NEPAL_HIGHWAYS data (no survey links available)`,
    };
  }

  return null;
}

export function estimateAerialDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(getDistanceKm(lat1, lon1, lat2, lon2) * 100) / 100;
}

export interface PavementBreakdown {
  BT: number;
  GR: number;
  ER: number;
  UC: number;
  PL: number;
  totalKm: number;
}

export interface HighwayEnrichment {
  code: string;
  name: string;
  nepaliName: string;
  totalLengthKm: number;
  lengthSource: 'road_graph' | 'snh_links' | 'highway_data' | 'all-highways-79';
  startPoint: string;
  endPoint: string;
  provinces?: string[];
  districts?: string[];
  pavement: PavementBreakdown;
  citiesAlongRoute: Array<{ name: string; district: string; lat: number; lng: number; isMajorHub?: boolean }>;
  segmentLinksCount?: number;
  status?: 'verified' | 'partial' | 'missing' | 'unverified';
  note?: string;
}

const PAVE_TYPE_MAP: Record<string, keyof PavementBreakdown> = {
  BT: 'BT',
  GR: 'GR',
  ER: 'ER',
  UC: 'UC',
  PL: 'PL',
  BLACKTOPPED: 'BT',
  BLACKTOOTED: 'BT',
  GRAVEL: 'GR',
  EARTH: 'ER',
  UNCATALBED: 'UC',
  PIPED: 'PL',
  PIPED_LABOUR: 'PL',
};

export function getPavementBreakdown(segmentLinks?: Array<{ paveType?: string; pave_type?: string; linkLenKm?: number; link_len_km?: number }>): PavementBreakdown {
  const result: PavementBreakdown = { BT: 0, GR: 0, ER: 0, UC: 0, PL: 0, totalKm: 0 };
  if (!segmentLinks || segmentLinks.length === 0) return result;
  for (const link of segmentLinks) {
    const km = link.linkLenKm || link.link_len_km || 0;
    const paveType = (link.paveType || link.pave_type || '').toUpperCase();
    const mapped = PAVE_TYPE_MAP[paveType];
    if (mapped) {
      result[mapped] += km;
    }
    result.totalKm += km;
  }
  result.BT = Math.round(result.BT * 100) / 100;
  result.GR = Math.round(result.GR * 100) / 100;
  result.ER = Math.round(result.ER * 100) / 100;
  result.UC = Math.round(result.UC * 100) / 100;
  result.PL = Math.round(result.PL * 100) / 100;
  result.totalKm = Math.round(result.totalKm * 100) / 100;
  return result;
}

export function getHighwayEnrichment(
  highwayCode: string,
  roadGraph?: { highways: string[]; adjacency: [number, number, number][][]; nodes: [number, number][] } | null,
  all79Data?: any[] | null
): HighwayEnrichment | null {
  const code = highwayCode.trim().toUpperCase();
  const highway = NEPAL_HIGHWAYS.find(
    (h) => h.code.toLowerCase() === code.toLowerCase() || h.id.toLowerCase() === code.toLowerCase()
  );

  const hw79 = all79Data
    ? all79Data.find((h) => (h.code || '').toUpperCase() === code || (h.id || '').toUpperCase() === code)
    : null;

  let totalLengthKm = 0;
  let lengthSource: HighwayEnrichment['lengthSource'] = 'highway_data';

  if (roadGraph && roadGraph.highways) {
    for (let i = 0; i < roadGraph.highways.length; i++) {
      if (roadGraph.highways[i].toUpperCase() === code) {
        let sumKm = 0;
        for (const node of roadGraph.adjacency) {
          for (const [to, dist, hwyIdx] of node) {
            if (hwyIdx === i) {
              sumKm += dist;
            }
          }
        }
        if (sumKm > 0) {
          totalLengthKm = Math.round(sumKm * 100) / 100;
          lengthSource = 'road_graph';
        }
      }
    }
  }

  if (totalLengthKm === 0 && hw79 && hw79.segmentLinks && hw79.segmentLinks.length > 0) {
    const sumKm = hw79.segmentLinks.reduce((s: number, l: any) => s + (l.linkLenKm || 0), 0);
    if (sumKm > 0) {
      totalLengthKm = Math.round(sumKm * 100) / 100;
      lengthSource = 'all-highways-79';
    }
  }

  if (totalLengthKm === 0 && highway && highway.totalLengthKm > 0) {
    totalLengthKm = highway.totalLengthKm;
    lengthSource = 'highway_data';
  }

  const segmentLinks = hw79?.segmentLinks || highway?.segmentLinks || [];
  const pavement = getPavementBreakdown(segmentLinks);

  const citiesAlongRoute = CITIES_AND_JUNCTIONS.filter((city) =>
    city.connectedHighways.some((ch) => ch.toUpperCase() === code)
  ).map((city) => ({
    name: city.name,
    district: city.district,
    lat: city.lat,
    lng: city.lng,
    isMajorHub: city.isMajorHub,
  }));

  let status: HighwayEnrichment['status'] = 'unverified';
  if (highway) status = 'verified';
  else if (hw79) status = 'partial';
  else if (totalLengthKm > 0) status = 'verified';
  else status = 'missing';

  const note = status === 'missing'
    ? `Highway ${code} is referenced by cities but has no geometry in NEPAL_HIGHWAYS or road-graph — needs DoR GeoJSON import`
    : status === 'partial'
    ? `Highway ${code} has DoR GeoJSON data but is not in curated NEPAL_HIGHWAYS`
    : undefined;

  return {
    code,
    name: highway?.name || hw79?.name || `Highway ${code}`,
    nepaliName: highway?.nepaliName || hw79?.nepaliName || '',
    totalLengthKm,
    lengthSource,
    startPoint: highway?.startPoint || hw79?.startPoint || '',
    endPoint: highway?.endPoint || hw79?.endPoint || '',
    provinces: highway?.provinces || hw79?.provinces || [],
    districts: hw79?.districts || highway?.districts || [],
    pavement,
    citiesAlongRoute,
    segmentLinksCount: segmentLinks.length,
    status,
    note,
  };
}
