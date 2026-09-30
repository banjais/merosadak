import type { DistanceMethodEvidence } from './distanceMethod';

export function getDistanceRouteHighways(
  highwaysUsed: string[] = [],
  linkChain: { code: string }[] = []
): string[] {
  const codes = linkChain.length ? linkChain.map((link) => link.code) : highwaysUsed;
  return [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
}

export function getHighwayCountLabel(codes: string[]): string {
  const count = codes.length;
  const roadType = codes.every((code) => /^NH\d+$/i.test(code)) ? 'National Highway' : 'Highway';
  return `${roadType}${count === 1 ? '' : 's'} (${count})`;
}

export function getShortestRouteStatus(evidence: DistanceMethodEvidence): string {
  switch (evidence) {
    case 'geodesic':
      return 'Shortest by distance in archived DoR geometry; not verified as the shortest current-road route.';
    case 'published':
      return 'Shortest-route status is not specified in the cited DoR figure.';
    case 'link_sum':
      return 'Shortest-route status is not established by the combined link records.';
    case 'estimate':
      return 'Not applicable: this is a straight-line estimate, not a road route.';
    case 'route_graph':
      return 'Planner-selected path; shortest status depends on the selected routing preference.';
  }
}
