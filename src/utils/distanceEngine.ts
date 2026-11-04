import type { CityNode, VehicleType } from '../types';
import { findRoadGraphRoute, getRoadGraph, isRoadGraphReady, type RouteDistanceBreakdown } from './roadGraphRouter';
import { lookupSNHDistance, estimateDistance, type SNHCitation, type SNHReferenceData } from './snhLookup';
import { estimateMinutesFromSpeed } from './vehicleConfigs';

/**
 * Shared distance-calculation engine — the SINGLE measurement authority used by
 * BOTH the Route Planner and the Distance Calculator.
 *
 * Measurement hierarchy (never silently degraded):
 *   1. surveyed_highway — a route measured along actual DoR surveyed highway
 *      geometry (the road graph built from the survey GeoJSON). Connecting
 *      roads to reach the highway are measured and reported separately.
 *   2. road_network     — a route over the road graph where the surveyed share
 *      is small/zero but a real connected road path exists.
 *   3. aerial_fallback  — straight-line distance, ONLY when no surveyed or
 *      road-network path exists. Always labelled as an estimate.
 *
 * Consumers render `segments` (breakdown), `sourceLabel` (one-line attribution)
 * and `quality` (data-quality flags) verbatim, so the two features can never
 * drift apart in what they claim about a distance.
 */

export type DistanceMethodology = 'surveyed_highway' | 'road_network' | 'aerial_fallback';

export interface DistanceSegment {
  label: string;
  km: number;
  kind: 'surveyed' | 'connection' | 'aerial';
}

export interface DistanceQuality {
  /** True when the total is measured along surveyed highway alignment. */
  surveyed: boolean;
  /** True when a connecting road to/from the highway was needed. */
  connectorUsed: boolean;
  /** True when the result is a straight-line aerial estimate. */
  aerialFallback: boolean;
  /** True when surveyed coverage for this pair is incomplete or partial. */
  partialCoverage: boolean;
}

export interface DistanceResult {
  totalKm: number;
  methodology: DistanceMethodology;
  segments: DistanceSegment[];
  highwaysUsed: string[];
  /** Surveyed alignment geometry, or the 2-point straight line for aerial. */
  pathCoordinates: [number, number][];
  /** Path split into surveyed vs connector runs (map rendering). */
  pathSegments: { kind: 'surveyed' | 'connection'; coords: [number, number][] }[];
  /** Straight-line km for context (shown as "aerial X km" reference). */
  aerialKm?: number;
  /** DoR-published figure for this exact pair, when SNH has one. */
  publishedKm?: number;
  publishedCitation?: SNHCitation;
  /** Citation for the measurement actually used. */
  citation?: SNHCitation;
  /** ONE concise source line for the report. */
  sourceLabel: string;
  /** Longer technical detail for the info tooltip. */
  sourceDetail: string;
  quality: DistanceQuality;
  /** Travel time — only present for road-based methodology. */
  estimatedTimeMinutes?: number;
}

function aerialKmBetween(origin: CityNode, destination: CityNode): number {
  return estimateDistance(origin.lat, origin.lng, destination.lat, destination.lng).distanceKm;
}

/** Great-circle km between two CityNode-ish coordinate holders. */
function havKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return estimateDistance(a.lat, a.lng, b.lat, b.lng).distanceKm;
}

/** Turns a graph breakdown into the report's compact segment model. */
export function segmentsFromBreakdown(b: RouteDistanceBreakdown): DistanceSegment[] {
  const segments: DistanceSegment[] = [];
  const connectorKm = Math.round((b.originAccessKm + b.destAccessKm) * 10) / 10;
  if (connectorKm > 0.05) segments.push({ label: 'Connecting road', km: connectorKm, kind: 'connection' });
  if (b.networkJoinKm > 0.05) segments.push({ label: 'Network joins', km: Math.round(b.networkJoinKm * 10) / 10, kind: 'connection' });
  if (b.surveyedKm > 0.05) segments.push({ label: 'Surveyed highway', km: Math.round(b.surveyedKm * 10) / 10, kind: 'surveyed' });
  return segments;
}

/**
 * One shared entry point.
 *
 * @param snhReference optional loaded SNH reference — when given, a DoR-
 *        published figure for this exact pair is attached as a cross-reference
 *        (never merged into the measured total).
 */
export function calculateDistance(
  origin: CityNode,
  destination: CityNode,
  options: { vehicle?: VehicleType; snhReference?: SNHReferenceData | null } = {}
): DistanceResult {
  const published = lookupSNHDistance(origin.name, destination.name, options.snhReference ?? null);

  // ---- Priority 1 & 2: surveyed highway geometry over the road graph ----
  if (isRoadGraphReady()) {
    const route = findRoadGraphRoute(origin.id, destination.id)
      // Expanded cities may resolve by name only.
      || (origin.name && destination.name ? findRoadGraphRoute(origin.name, destination.name) : null);
    if (route && route.distanceKm > 0 && route.pathCoordinates.length >= 2) {
      const b = route.distanceBreakdown;
      const segments = segmentsFromBreakdown(b);
      const connectorUsed = b.originAccessKm + b.destAccessKm + b.networkJoinKm > 0.05;
      const aerialKm = aerialKmBetween(origin, destination);
      const methodology: DistanceMethodology = b.surveyedKm > 0.05 ? 'surveyed_highway' : 'road_network';
      return {
        totalKm: route.distanceKm,
        methodology,
        segments,
        highwaysUsed: route.highwaysUsed,
        pathCoordinates: route.pathCoordinates,
        pathSegments: route.pathSegments,
        aerialKm,
        publishedKm: published && published.distanceKm > 0 ? published.distanceKm : undefined,
        publishedCitation: published?.citation,
        sourceLabel: methodology === 'surveyed_highway'
          ? 'Surveyed highway data'
          : 'Road network data',
        sourceDetail: methodology === 'surveyed_highway'
          ? `Measured along DoR surveyed highway alignment (road-network graph built from the DoR survey GeoJSON).${published ? ` DoR publishes ${published.distanceKm} km for this exact pair (SNH).` : ''}${connectorUsed ? ` Includes ${Math.round((b.originAccessKm + b.destAccessKm + b.networkJoinKm) * 10) / 10} km of connecting roads outside the surveyed corridor.` : ''}`
          : 'Measured over the connected road network; no surveyed highway alignment covers this pair directly.',
        quality: {
          surveyed: b.surveyedKm > 0.05,
          connectorUsed,
          aerialFallback: false,
          partialCoverage: connectorUsed || !published,
        },
        estimatedTimeMinutes: estimateMinutesFromSpeed(route.distanceKm, options.vehicle ?? 'car'),
        citation: published?.citation,
      };
    }

    // An endpoint that is not directly represented in the surveyed graph is
    // not snapped with a straight-line stub and called a road connection.
    // Continue to the official pair reference (if available), otherwise use
    // the explicitly labelled aerial fallback below.
  }

  // ---- Priority 1b: official published pair (no alignment geometry) ----
  if (published && published.distanceKm > 0) {
    const aerialKm = aerialKmBetween(origin, destination);
    return {
      totalKm: published.distanceKm,
      methodology: 'surveyed_highway',
      segments: [{ label: 'Surveyed highway (official)', km: published.distanceKm, kind: 'surveyed' }],
      highwaysUsed: [],
      pathCoordinates: [], // no mapped alignment for this pair — do NOT fake one
      pathSegments: [],
      aerialKm,
      publishedKm: published.distanceKm,
      publishedCitation: published.citation,
      sourceLabel: 'Official surveyed length (DoR SNH)',
      sourceDetail: `DoR-published distance for this pair (SNH 2022/23${published.citation ? `, ${published.citation.table}` : ''}). The surveyed alignment between these exact endpoints is not in the mapped archive, so no route line is drawn.`,
      quality: {
        surveyed: true,
        connectorUsed: false,
        aerialFallback: false,
        partialCoverage: true,
      },
    };
  }

  // ---- Priority 3: aerial fallback, clearly labelled ----
  const aerial = estimateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  return {
    totalKm: aerial.distanceKm,
    methodology: 'aerial_fallback',
    segments: [{ label: 'Aerial estimate (straight line)', km: aerial.distanceKm, kind: 'aerial' }],
    highwaysUsed: [],
    pathCoordinates: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
    pathSegments: [],
    aerialKm: aerial.distanceKm,
    sourceLabel: 'Aerial estimate',
    sourceDetail: 'Straight-line (great-circle) distance. No surveyed highway corridor or connected road network covers this pair — the real road distance will be longer, especially in mountain terrain.',
    quality: {
      surveyed: false,
      connectorUsed: false,
      aerialFallback: true,
      partialCoverage: true,
    },
  };
}

/** Short human label for the route type chip used in reports. */
export function methodologyLabel(m: DistanceMethodology): string {
  switch (m) {
    case 'surveyed_highway': return 'Surveyed Highway';
    case 'road_network': return 'Road Network';
    case 'aerial_fallback': return 'Aerial Estimate';
  }
}
