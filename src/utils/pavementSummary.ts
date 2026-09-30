import type { LinkChainEntry } from './snhLookup';

export interface PavementTypeTotal {
  type: string;
  distanceKm: number;
}

export const PAVEMENT_RECORD_NOTE =
  'Pavement type reflects the cited DoR link record, not present-day road condition.';

const pavementLabels: Record<string, string> = {
  BT: 'Blacktopped',
  BLACKTOP: 'Blacktopped',
  BLACKTOPPED: 'Blacktopped',
  GR: 'Gravel',
  GRAVEL: 'Gravel',
  ER: 'Earthen',
  EARTH: 'Earthen',
  EARTHEN: 'Earthen',
  ASPHALT: 'Asphalt',
  CONCRETE: 'Concrete',
  PAVED: 'Paved (type unspecified)',
};

export function getPavementTypeLabel(pavementType: string): string {
  const normalized = pavementType.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return pavementLabels[normalized] || (normalized ? `${normalized} (source code)` : 'Unspecified');
}

export function summarizePavementTypes(links: LinkChainEntry[]): PavementTypeTotal[] {
  const totals = new Map<string, number>();
  for (const link of links) {
    const label = getPavementTypeLabel(link.pavementType);
    totals.set(label, (totals.get(label) || 0) + link.lengthKm);
  }
  return [...totals].map(([type, distanceKm]) => ({
    type,
    distanceKm: Math.round(distanceKm * 10) / 10,
  }));
}
