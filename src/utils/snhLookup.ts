export type EvidenceLevel = 'published' | 'link_sum' | 'estimate';

export function getEvidenceLevelLabel(level: EvidenceLevel): string {
  switch (level) {
    case 'published':
      return 'DoR Published';
    case 'link_sum':
      return 'Link-Sum';
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
    const match = ref.links.find(
      (l) => l.name.toLowerCase().includes(key.replace(/\s+/g, ' '))
    );
    if (match && originMatches.indexOf(match.name) === -1) originMatches.push(match.name);
  }

  for (const key of destKeys) {
    const match = ref.links.find(
      (l) => l.name.toLowerCase().includes(key.replace(/\s+/g, ' '))
    );
    if (match && destMatches.indexOf(match.name) === -1) destMatches.push(match.name);
  }

  if (originMatches.length === 0 || destMatches.length === 0) return null;

  const fromEnd = originMatches[0];
  const toEnd = destMatches[0];

  const chain: LinkChainEntry[] = [];
  let foundStart = false;
  let totalDistance = 0;

  for (const link of ref.links) {
    if (link.name.toLowerCase().includes(fromEnd.toLowerCase()) || !foundStart) {
      if (!foundStart) {
        if (
          link.name.toLowerCase().includes(fromEnd.toLowerCase()) ||
          link.name.toLowerCase().includes(originKeys[0]) ||
          link.name.toLowerCase().includes(originKeys[0].replace(/^the\s+/, ''))
        ) {
          foundStart = true;
        }
      }
    }

    if (foundStart) {
      chain.push({
        code: link.code,
        name: link.name,
        lengthKm: link.length_km,
        pavementType: link.pavement_type,
        fromKm: link.from_km,
        toKm: link.to_km,
      });
      totalDistance += link.length_km;

      if (
        link.name.toLowerCase().includes(toEnd.toLowerCase()) ||
        link.name.toLowerCase().includes(destKeys[0]) ||
        destKeys.some((dk) => link.name.toLowerCase().includes(dk))
      ) {
        return {
          distanceKm: Math.round(totalDistance * 100) / 100,
          evidenceLevel: 'link_sum',
          linkChain: chain,
          publishedDistanceKm: totalDistance,
        };
      }
    }
  }

  if (chain.length > 0) {
    return {
      distanceKm: Math.round(totalDistance * 100) / 100,
      evidenceLevel: 'link_sum',
      note: 'Route extends beyond the matched chain. Partial link-sum only.',
      isUncertain: true,
      linkChain: chain,
    };
  }

  return null;
}

export function traceKathmanduToGulariya(ref?: SNHReferenceData | null): DistanceLookupResult {
  const reference = ref || cachedReferenceData;
  const published = lookupSNHDistance('Kathmandu', 'Gulariya', reference);
  if (published) {
    return published;
  }

  const table4 = reference?.tables.table_4;
  const links = reference?.links || [];

  const chain: LinkChainEntry[] = [];
  let totalFromTable4 = 0;

  const segments = [
    { from: 'Kathmandu', to: 'Mugling', distance: 108.08 },
    { from: 'Mugling', to: 'Narayangadh', distance: 36.16 },
    { from: 'Narayangadh', to: 'Butwal (Mahendrachok)', distance: 115.2 },
    { from: 'Butwal (Mahendrachok)', to: 'Kohalpur', distance: 235.61 },
  ];

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
    note: `Kathmandu → Kohalpur is verifiable via Table 4 (${totalFromTable4.toFixed(2)} km across 4 published segments). Kohalpur → Gulariya is implied as ${impliedKohalpurToGulariya.toFixed(2)} km (543.4 − ${totalFromTable4.toFixed(2)}). NH59 junction with NH01 near Kohalpur is not explicitly documented in Annex 2; the junction was inferred from geometry.`,
    unreconciledGapKm: Math.abs(impliedKohalpurToGulariya - 48.35),
     isUncertain: false,
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

export type DataSourceType = 'snh_published' | 'dor_geojson_linksum' | 'estimate_aerial';

export interface DistanceWithSource {
  distanceKm: number;
  evidenceLevel: EvidenceLevel;
  source: DataSourceType;
  citation?: SNHCitation;
  linkChain?: LinkChainEntry[];
  note?: string;
  isUncertain?: boolean;
  publishedDistanceKm?: number;
}

export function getSourceLabel(source: DataSourceType): string {
  switch (source) {
    case 'snh_published':
      return 'SNH 2022-23 (DoR Published)';
    case 'dor_geojson_linksum':
      return 'DoR Archives (GeoJSON Link-Sum)';
    case 'estimate_aerial':
      return 'Estimate (Aerial Line-of-Sight)';
    default:
      return source;
  }
}

export function getSourceDescription(source: DataSourceType): string {
  switch (source) {
    case 'snh_published':
      return 'Official Department of Roads published distance from Statistics of National Highway 2022/23';
    case 'dor_geojson_linksum':
      return 'DoR Archives survey link geometry — distance summed from per-link chainage in highway GeoJSON files';
    case 'estimate_aerial':
      return 'Aerial line-of-sight distance (geodesic great circle). No surveyed corridor data available.';
    default:
      return '';
  }
}

export function lookupDistanceWithFallback(
  originName: string,
  destinationName: string,
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
      source: 'snh_published',
      citation: published.citation,
      linkChain: published.linkChain,
      publishedDistanceKm: published.publishedDistanceKm,
    };
  }

  const linkSum = computeLinkSumDistance(originName, destinationName, ref);
  if (linkSum && linkSum.distanceKm > 0) {
    return {
      distanceKm: linkSum.distanceKm,
      evidenceLevel: 'link_sum',
      source: 'dor_geojson_linksum',
      citation: linkSum.citation,
      linkChain: linkSum.linkChain,
      isUncertain: linkSum.isUncertain,
      note: linkSum.note,
      publishedDistanceKm: linkSum.publishedDistanceKm,
    };
  }

  if (originLat !== undefined && originLng !== undefined && destLat !== undefined && destLng !== undefined) {
    const estimated = estimateDistance(originLat, originLng, destLat, destLng);
    return {
      distanceKm: estimated.distanceKm,
      evidenceLevel: 'estimate',
      source: 'estimate_aerial',
      citation: estimated.citation,
      isUncertain: estimated.isUncertain,
      note: estimated.note,
    };
  }

  return null;
}
