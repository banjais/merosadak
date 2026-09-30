import type { CityNode } from '../types';
import { findRoadGraphRoute, isRoadGraphReady } from './roadGraphRouter';

export type EvidenceLevel = 'published' | 'link_sum' | 'geodesic' | 'estimate';

export function getEvidenceLevelLabel(level: EvidenceLevel): string {
  switch (level) {
    case 'published':
      return 'DoR Published (SNH)';
    case 'link_sum':
      return 'DoR Link-Sum (derived)';
    case 'geodesic':
      return 'DoR Archive Route (derived)';
    case 'estimate':
      return 'Estimate (not DoR-certified)';
    default:
      return level;
  }
}

export function getEvidenceLevelColor(level: EvidenceLevel): [number, number, number] {
  switch (level) {
    case 'published':
      return [16, 185, 129];
    case 'link_sum':
      return [59, 130, 246];
    case 'geodesic':
      return [99, 102, 242];
    case 'estimate':
      return [245, 152, 61];
    default:
      return [153, 161, 179];
  }
}

export interface SNHCitation {
  document: string;
  table: string;
  row?: number | null;
  printedPage?: number;
  pdfPage?: number;
  via?: string | null;
}

export interface LinkChainEntry {
  code: string;
  name: string;
  lengthKm: number;
  pavementType: string;
  fromKm: number;
  toKm: number;
}

export interface DistanceLookupResult {
  distanceKm: number;
  evidenceLevel: EvidenceLevel;
  citation?: SNHCitation;
  linkChain?: LinkChainEntry[];
  note?: string;
  isUncertain?: boolean;
  unreconciledGapKm?: number;
  publishedDistanceKm?: number;
  highwaysUsed?: string[];
}

export interface SNHReferenceData {
  document: string;
  publisher: string;
  publication_date: string;
  pdf_pages: number;
  description: string;
  tables: Record<string, any>;
  published_distances: Record<string, any>;
  links: any[];
  city_aliases: Record<string, string[]>;
  corrections: any[];
}

let cachedReferenceData: SNHReferenceData | null = null;

export async function loadSNHReference(): Promise<SNHReferenceData | null> {
  if (cachedReferenceData) return cachedReferenceData;
  try {
    const res = await fetch('/data/snh-reference.json');
    if (!res.ok) return null;
    cachedReferenceData = await res.json();
    return cachedReferenceData;
  } catch {
    return null;
  }
}

export function getCachedSNHReference(): SNHReferenceData | null {
  return cachedReferenceData;
}

function normalizeKey(name: string): string {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function resolveAlias(name: string, aliases: Record<string, string[]>): string[] {
  const key = normalizeKey(name);
  const resolved: string[] = [];
  if (aliases[key]) {
    aliases[key].forEach((alias) => resolved.push(normalizeKey(alias)));
  }
  resolved.push(key);
  return [...new Set(resolved)];
}

export function lookupSNHDistance(
  originName: string,
  destinationName: string,
  referenceData?: SNHReferenceData | null
): DistanceLookupResult | null {
  const ref = referenceData || cachedReferenceData;
  if (!ref) return null;

  const originKeys = resolveAlias(originName, ref.city_aliases);
  const destKeys = resolveAlias(destinationName, ref.city_aliases);

  for (const originKey of originKeys) {
    for (const destKey of destKeys) {
      const directKey = `${originKey}|${destKey}`;
      const entry = ref.published_distances[directKey];
      if (entry && entry.distance_km > 0) {
        return {
          distanceKm: entry.distance_km,
          evidenceLevel: 'published',
          citation: {
            document: entry.source,
            table: entry.table,
            row: entry.row,
            printedPage: entry.printed_page,
            pdfPage: entry.pdf_page,
            via: entry.via,
          },
          publishedDistanceKm: entry.distance_km,
        };
      }
    }
  }

  return null;
}

export function computeLinkSumDistance(
  originName: string,
  destinationName: string,
  referenceData?: SNHReferenceData | null
): DistanceLookupResult | null {
  const ref = referenceData || cachedReferenceData;
  if (!ref) return null;

  const originKeys = resolveAlias(originName, ref.city_aliases);
  const destKeys = resolveAlias(destinationName, ref.city_aliases);

  const originMatches: string[] = [];
  const destMatches: string[] = [];

  for (const key of originKeys) {
    const normalizedKey = key.replace(/\s+/g, ' ').toLowerCase();
    const exactMatch = ref.links.find(
      (l) => l.name.toLowerCase().replace(/\s+/g, ' ') === normalizedKey
    );
    if (exactMatch && originMatches.indexOf(exactMatch.name) === -1) {
      originMatches.push(exactMatch.name);
    }
  }

  for (const key of destKeys) {
    const normalizedKey = key.replace(/\s+/g, ' ').toLowerCase();
    const exactMatch = ref.links.find(
      (l) => l.name.toLowerCase().replace(/\s+/g, ' ') === normalizedKey
    );
    if (exactMatch && destMatches.indexOf(exactMatch.name) === -1) {
      destMatches.push(exactMatch.name);
    }
  }

  if (originMatches.length === 0 || destMatches.length === 0) return null;

  const fromEnd = originMatches[0];
  const toEnd = destMatches[0];

  const links = ref.links;
  const originIdx = links.findIndex((l) => l.name.toLowerCase().includes(fromEnd.toLowerCase()));
  const destIdx = links.findIndex((l) => l.name.toLowerCase().includes(toEnd.toLowerCase()));

  if (originIdx === -1 || destIdx === -1) return null;

  const startIdx = Math.min(originIdx, destIdx);
  const endIdx = Math.max(originIdx, destIdx);
  const forward = originIdx <= destIdx;

  const chain: LinkChainEntry[] = [];
  let totalDistance = 0;

  for (let i = startIdx; i <= endIdx; i += 1) {
    const link = links[i];
    chain.push({
      code: link.code,
      name: link.name,
      lengthKm: link.length_km,
      pavementType: link.pavement_type,
      fromKm: link.from_km,
      toKm: link.to_km,
    });
    totalDistance += link.length_km;
  }

  return {
    distanceKm: Math.round(totalDistance * 100) / 100,
    evidenceLevel: 'link_sum',
    linkChain: forward ? chain : chain.reverse(),
    publishedDistanceKm: totalDistance,
    note: forward ? undefined : 'Matched in reverse link order; distance is still the corridor length between these endpoints.',
  };
}

export function traceKathmanduToGulariya(ref?: SNHReferenceData | null): DistanceLookupResult {
  const reference = ref || cachedReferenceData;
  const published = lookupSNHDistance('Kathmandu', 'Gulariya', reference);
  if (published) {
    return published;
  }

  const links = reference?.links || [];

  const segments = [
    { from: 'Kathmandu', to: 'Mugling', distance: 108.08 },
    { from: 'Mugling', to: 'Narayangadh', distance: 36.16 },
    { from: 'Narayangadh', to: 'Butwal (Mahendrachok)', distance: 115.2 },
    { from: 'Butwal (Mahendrachok)', to: 'Kohalpur', distance: 235.61 },
  ];

  const chain: LinkChainEntry[] = [];
  let totalFromTable4 = 0;

  for (const seg of segments) {
    chain.push({
      code: `Table 4: ${seg.from} → ${seg.to}`,
      name: `${seg.from} → ${seg.to}`,
      lengthKm: seg.distance,
      pavementType: 'BT',
      fromKm: 0,
      toKm: seg.distance,
    });
    totalFromTable4 += seg.distance;
  }

  const impliedKohalpurToGulariya = 543.4 - totalFromTable4;

  // Look up the link-chain distance from SNH reference links
  const linkSumResult = computeLinkSumDistance('Kathmandu', 'Gulariya', reference);
  const linkChainKm = linkSumResult ? linkSumResult.distanceKm : 0;

  // The conflict: published 543.4 km vs link-chain sum
  const linkChainConflict = linkChainKm > 0;
  const gapFromLinkChain = linkChainConflict ? Math.abs(543.4 - linkChainKm) : 0;

  let note = `Kathmandu → Kohalpur is verifiable via Table 4 (${totalFromTable4.toFixed(2)} km across 4 published segments). Kohalpur → Gulariya is implied as ${impliedKohalpurToGulariya.toFixed(2)} km (543.4 − ${totalFromTable4.toFixed(2)}). NH59 junction with NH01 near Kohalpur is not explicitly documented in Annex 2; the junction was inferred from geometry.`;

  if (linkChainConflict) {
    note += ` CONFLICT: Published distance 543.40 km vs DoR Archives GeoJSON link-chain sum ${linkChainKm.toFixed(2)} km (gap: ${gapFromLinkChain.toFixed(2)} km). Requires DoR confirmation of NH59/NH01 junction near Kohalpur.`;
  }

  return {
    distanceKm: 543.4,
    evidenceLevel: 'published',
    citation: {
      document: 'SNH 2022/23',
      table: 'Table 6',
      row: 59,
      printedPage: 12,
      pdfPage: 22,
      via: 'via NH17 Prithvi Highway',
    },
    publishedDistanceKm: 543.4,
    linkChain: chain,
    note,
    unreconciledGapKm: gapFromLinkChain,
    isUncertain: linkChainConflict,
  };
}

export function estimateDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): DistanceLookupResult {
  const R = 6371;
  const dLat = ((destLat - originLat) * Math.PI) / 180;
  const dLon = ((destLng - originLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((originLat * Math.PI) / 180) *
      Math.cos((destLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = Math.round(R * c * 100) / 100;

  return {
    distanceKm: km,
    evidenceLevel: 'estimate',
    citation: {
      document: 'Geodesic Great Circle Calculation',
      table: 'Aerial Line-of-Sight',
    },
    publishedDistanceKm: km,
    isUncertain: true,
    note: 'Aerial distance only. No published DoR corridor data available for this city pair. Use for rough reference only — road distance will be longer, especially in mountain terrain.',
  };
}

export type DataSourceType = 'dor_snh' | 'dor_geojson' | 'estimate_aerial';

export interface DistanceWithSource {
  distanceKm: number;
  evidenceLevel: EvidenceLevel;
  source: DataSourceType;
  citation?: SNHCitation;
  linkChain?: LinkChainEntry[];
  note?: string;
  isUncertain?: boolean;
  publishedDistanceKm?: number;
  highwaysUsed?: string[];
  inferredConnectorKm?: number;
}

export function getSourceLabel(source: DataSourceType): string {
  switch (source) {
    case 'dor_snh':
      return 'DoR SNH published tables';
    case 'dor_geojson':
      return 'DoR highway archive geometry (computed route)';
    case 'estimate_aerial':
      return 'Aerial (Straight-Line)';
    default:
      return source;
  }
}

export function getSourceDescription(source: DataSourceType): string {
  switch (source) {
    case 'dor_snh':
      return 'DoR Statistics of National Highway 2022/23. Only a pair with a table/page citation is a distance published by DoR.';
    case 'dor_geojson':
      return 'Distance computed over archived DoR highway geometry. It is derived by MEROSADAK and is not a DoR-published city-pair figure.';
    case 'estimate_aerial':
      return 'Aerial line-of-sight distance (geodesic great circle). No surveyed corridor data available.';
    default:
      return '';
  }
}

export function lookupGeoJsonRouteDistance(
  originId: string,
  destinationId: string,
  originName?: string,
  destinationName?: string
): DistanceWithSource | null {
  if (!isRoadGraphReady()) return null;
  const route = findRoadGraphRoute(originId, destinationId)
    || (originName && destinationName ? findRoadGraphRoute(originName, destinationName) : null);
  if (!route) return null;
  return {
    distanceKm: route.distanceKm,
    evidenceLevel: 'geodesic',
    source: 'dor_geojson',
    citation: {
      document: 'Department of Roads highway archive',
      table: 'Computed shortest path over archived highway geometry',
    },
    note: route.inferredConnectorKm > 0
      ? `Derived by MEROSADAK over DoR archive geometry; DoR does not publish this pair. ${route.inferredConnectorKm.toFixed(1)} km uses inferred access or network-join connectors.`
      : 'Derived route computed by MEROSADAK over DoR archive geometry; DoR does not publish this city-pair figure.',
    highwaysUsed: route.highwaysUsed,
    inferredConnectorKm: route.inferredConnectorKm,
  };
}

export function lookupDistanceWithFallback(
  originName: string,
  destinationName: string,
  originId?: string,
  destId?: string,
  originLat?: number,
  originLng?: number,
  destLat?: number,
  destLng?: number,
  referenceData?: SNHReferenceData | null
): DistanceWithSource | null {
  const ref = referenceData || cachedReferenceData;

  const published = lookupSNHDistance(originName, destinationName, ref);
  if (published && published.distanceKm > 0) {
    return {
      distanceKm: published.distanceKm,
      evidenceLevel: 'published',
      source: 'dor_snh',
      citation: published.citation,
      linkChain: published.linkChain,
      publishedDistanceKm: published.publishedDistanceKm,
    };
  }

  const geoRoute = lookupGeoJsonRouteDistance(
    originId || originName,
    destId || destinationName,
    originName,
    destinationName
  );
  if (geoRoute && geoRoute.distanceKm > 0) {
    return geoRoute;
  }

  if (originLat !== undefined && originLng !== undefined && destLat !== undefined && destLng !== undefined) {
    const estimated = estimateDistance(originLat, originLng, destLat, destLng);
    return {
      distanceKm: estimated.distanceKm,
      evidenceLevel: 'estimate',
      source: 'estimate_aerial',
      citation: estimated.citation,
      isUncertain: estimated.isUncertain,
      note: 'Aerial distance only. No published DoR corridor data available for this city pair. Use for rough reference only — road distance will be longer, especially in mountain terrain.',
    };
  }

  return null;
}
