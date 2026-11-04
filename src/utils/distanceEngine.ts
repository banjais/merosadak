import type { CityNode, VehicleType } from '../types';
import { findRoadGraphRoute, getRoadGraph, isRoadGraphReady, type RouteDistanceBreakdown } from './roadGraphRouter';
import { lookupSNHDistance, estimateDistance, type SNHCitation, type SNHReferenceData } from './snhLookup';
import { estimateMinutesFromSpeed } from './vehicleConfigs';
import { snapToNearestRoutingCity } from './routeOptimizer';

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

/**
 * Priority 2 — road-network connection for a place that does not directly sit
 * on the surveyed network: snap it to the nearest routing junction, measure the
 * junction-to-junction route over the surveyed graph, and ADD the two access
 * legs as honest connecting-road segments (never hide them inside the total).
 *
 * Places farther than MAX_ACCESS_SNAP_KM from any junction have no credible
 * road connection in the dataset — they fall through to the aerial fallback
 * instead of producing a fake route from a distant junction.
 */
const MAX_ACCESS_SNAP_KM = 40;

function calculateWithAccessConnector(
  origin: CityNode,
  destination: CityNode,
  vehicle: VehicleType,
  published: { distanceKm: number; citation?: SNHCitation } | null
): DistanceResult | null {
  const graph = getRoadGraph();
  if (!graph) return null;
  const resolvable = (c: CityNode) =>
    graph.citySnap[c.id] !== undefined ||
    (c.name && graph.citySnapByName[c.name.toLowerCase()] !== undefined);
  const originDirect = resolvable(origin);
  const destDirect = resolvable(destination);
  if (originDirect && destDirect) return null; // direct lookup already handled it

  const snapO = originDirect ? origin : snapToNearestRoutingCity(origin);
  const snapD = destDirect ? destination : snapToNearestRoutingCity(destination);
  if (!snapO || !snapD || snapO.id === snapD.id) return null;
  const accessO = originDirect ? 0 : havKm(origin, snapO);
  const accessD = destDirect ? 0 : havKm(snapD, destination);
  // Beyond the guard distance the "connection" would be fiction, not a road.
  if (accessO > MAX_ACCESS_SNAP_KM || accessD > MAX_ACCESS_SNAP_KM) return null;
  const route = findRoadGraphRoute(snapO.id, snapD.id);
  if (!route || route.distanceKm <= 0 || route.pathCoordinates.length < 2) return null;

  // Access legs are straight connectors to the snapped junctions — reported,
  // not hidden. (The junction itself is on the surveyed network.)
  const accessKm = Math.round((accessO + accessD) * 10) / 10;
  const totalKm = Math.round((route.distanceKm + accessO + accessD) * 10) / 10;

  const b = route.distanceBreakdown;
  // One honest "Connecting road" row covers every non-surveyed access leg
  // (user→junction stubs plus the graph's own origin/destination connectors);
  // joins and the surveyed run stay their own rows.
  const connectorTotalKm = Math.round((accessO + accessD + b.originAccessKm + b.destAccessKm) * 10) / 10;
  const segments: DistanceSegment[] = [];
  if (connectorTotalKm > 0.05) segments.push({ label: 'Connecting road', km: connectorTotalKm, kind: 'connection' });
  if (b.networkJoinKm > 0.05) segments.push({ label: 'Network joins', km: Math.round(b.networkJoinKm * 10) / 10, kind: 'connection' });
  if (b.surveyedKm > 0.05) segments.push({ label: 'Surveyed highway', km: Math.round(b.surveyedKm * 10) / 10, kind: 'surveyed' });

  const pathCoordinates: [number, number][] = [];
  const pathSegments: DistanceResult['pathSegments'] = [];
  if (accessO > 0.05) {
    const leg: [number, number][] = [[origin.lat, origin.lng], [snapO.lat, snapO.lng]];
    pathCoordinates.push(...leg);
    pathSegments.push({ kind: 'connection', coords: leg });
  }
  pathCoordinates.push(...route.pathCoordinates);
  pathSegments.push(...route.pathSegments);
  if (accessD > 0.05) {
    const leg: [number, number][] = [[snapD.lat, snapD.lng], [destination.lat, destination.lng]];
    pathCoordinates.push(...leg);
    pathSegments.push({ kind: 'connection', coords: leg });
  }

  const aerialKm = aerialKmBetween(origin, destination);
  return {
    totalKm,
    methodology: b.surveyedKm > 0.05 ? 'surveyed_highway' : 'road_network',
    segments,
    highwaysUsed: route.highwaysUsed,
    pathCoordinates,
    pathSegments,
    aerialKm,
    publishedKm: published && published.distanceKm > 0 ? published.distanceKm : undefined,
    publishedCitation: published?.citation,
    sourceLabel: 'Surveyed highway + connecting road',
    sourceDetail: `Measured over the DoR surveyed highway network, plus ${accessKm} km of connecting road to reach the highway access point${published ? `. DoR publishes ${published.distanceKm} km for this exact pair (SNH).` : ''}`,
    quality: {
      surveyed: b.surveyedKm > 0.05,
      connectorUsed: true,
      aerialFallback: false,
      partialCoverage: true,
    },
    estimatedTimeMinutes: estimateMinutesFromSpeed(totalKm, vehicle),
  };
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

    // ---- Priority 2: one endpoint is off-network → connect to the highway ----
    const connected = calculateWithAccessConnector(origin, destination, options.vehicle ?? 'car', published);
    if (connected) return connected;
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
