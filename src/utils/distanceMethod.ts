import type { EvidenceLevel } from './snhLookup';

export type DistanceMethodEvidence = EvidenceLevel | 'route_graph';

export function getDistanceMethodLabel(evidence: DistanceMethodEvidence): string {
  switch (evidence) {
    case 'published':
      return 'DoR-published city-pair distance (SNH)';
    case 'link_sum':
      return 'Combined distances of DoR highway links';
    case 'geodesic':
      return 'Calculated along DoR-mapped highway geometry';
    case 'estimate':
      return 'Straight-line aerial estimate; not road distance';
    case 'route_graph':
      return 'Calculated along the route-planner GIS path';
  }
}
