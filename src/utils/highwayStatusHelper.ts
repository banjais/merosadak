import { Highway, HighwaySegment, RoadIncident, UserRoadReport, RoadStatusType, SurfaceType } from '../types';
import { LIVE_ROAD_INCIDENTS, INITIAL_USER_REPORTS } from '../data/nepalHighwaysData';

export type HighwayRealtimeStatusType = 'open' | 'roadwork' | 'obstruction' | 'caution' | 'closed';

export interface HighwaySegmentLiveStatus {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  avgSpeedKmh: number;
  surface: SurfaceType;
  status: RoadStatusType;
  realtimeStatusType: HighwayRealtimeStatusType;
  statusLabel: string;
  lanes: number;
  elevationStartM?: number;
  elevationEndM?: number;
  currentIssue?: string;
  lastUpdated?: string;
  verifiedBy?: string;
  hasIncident?: boolean;
  incidentType?: string;
  coordinates?: [number, number][];
}

export interface HighwayRealtimeAnalysis {
  highwayId: string;
  highwayCode: string;
  highwayName: string;
  realtimeStatus: HighwayRealtimeStatusType;
  statusLabel: 'Open' | 'Roadwork' | 'Obstruction' | 'Caution' | 'Closed';
  statusBadgeText: string;
  statusSummary: string;
  passabilityScore: number; // 0 - 100%
  totalSegments: number;
  openSegmentsCount: number;
  roadworkSegmentsCount: number;
  obstructionSegmentsCount: number;
  cautionSegmentsCount: number;
  activeIncidentsCount: number;
  segments: HighwaySegmentLiveStatus[];
  headlineIssue?: string;
  theme: {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
    icon: string;
  };
}

// Mapping of classic highway codes (H01-H15) to New National Highway Codes (NH01-NH80)
const HIGHWAY_CODE_ALIASES: Record<string, string[]> = {
  NH01: ['H01', 'MAHENDRA', 'EAST-WEST', 'EAST WEST'],
  NH17: ['H04', 'PRITHVI'],
  NH44: ['H05', 'NARAYANGHAT-MUGLING', 'MUGLING-NARAYANGHAT', 'NARAYANGARH-MUGLING'],
  NH13: ['H13', 'BP', 'B.P.', 'SINDHULI'],
  NH48: ['H10', 'SIDDHARTHA'],
  NH41: ['H02', 'TRIBHUVAN', 'BYROAD', 'BY-ROAD'],
  NH42: ['H02', 'TRIBHUVAN', 'BYROAD'],
  NH64: ['H06', 'KARNALI'],
  NH03: ['H03', 'ARANIKO'],
  NH15: ['H15', 'MID-HILL', 'PUSHPALAL', 'MADHYAPAHADI'],
  NH02: ['H07', 'POSTAL', 'HULAKI'],
  NH09: ['MADAN BHANDARI'],
  NH08: ['H08', 'KOSHI'],
  NH07: ['H09', 'MECHI'],
  NH16: ['H12', 'SAGARMATHA'],
  NH66: ['H14', 'MAHAKALI'],
  H01: ['NH01', 'MAHENDRA'],
  H04: ['NH17', 'PRITHVI'],
  H05: ['NH44', 'NARAYANGHAT-MUGLING'],
  H13: ['NH13', 'BP', 'B.P.'],
  H10: ['NH48', 'SIDDHARTHA'],
  H02: ['NH41', 'NH42', 'TRIBHUVAN'],
  H06: ['NH64', 'KARNALI'],
  H03: ['NH03', 'ARANIKO'],
  H15: ['NH15', 'MID-HILL', 'PUSHPALAL']
};

/**
 * Check if an incident or report relates to a specific highway
 */
export function isIncidentMatchingHighway(
  inc: RoadIncident | UserRoadReport,
  highwayCode: string,
  highwayName: string
): boolean {
  const code = (highwayCode || '').toUpperCase().trim();
  const name = (highwayName || '').toUpperCase().trim();
  const incCode = (inc.highwayCode || '').toUpperCase().trim();
  const incName = ('highwayName' in inc ? (inc.highwayName || '') : '').toUpperCase().trim();
  const incLocation = ('locationName' in inc ? inc.locationName : inc.location || '').toUpperCase();
  const incDesc = (inc.description || '').toUpperCase();

  if (incCode && (incCode === code || incCode === code.replace('NH', 'H') || incCode === code.replace('H', 'NH'))) {
    return true;
  }

  const aliases = HIGHWAY_CODE_ALIASES[code] || [];
  for (const alias of aliases) {
    if (incCode === alias || incName.includes(alias) || incLocation.includes(alias)) {
      return true;
    }
  }

  if (name && (incName.includes(name) || incLocation.includes(name) || incDesc.includes(name))) {
    return true;
  }

  return false;
}

/**
 * Standardize segments and compute real-time status for any highway
 */
export function analyzeHighwayRealtimeStatus(
  highway: Highway,
  liveIncidents: RoadIncident[] = LIVE_ROAD_INCIDENTS,
  userReports: UserRoadReport[] = INITIAL_USER_REPORTS
): HighwayRealtimeAnalysis {
  const code = (highway.code || '').toUpperCase();
  const name = highway.name || `National Highway ${code}`;

  // Find all incidents matching this highway
  const matchedIncidents = liveIncidents.filter((inc) =>
    isIncidentMatchingHighway(inc, code, name)
  );
  const matchedReports = userReports.filter((rep) =>
    isIncidentMatchingHighway(rep, code, name)
  );

  // Extract or synthesize segments
  const rawSegments = highway.segments && highway.segments.length > 0 ? highway.segments : [];
  const segments: HighwaySegmentLiveStatus[] = [];

  if (rawSegments.length > 0) {
    rawSegments.forEach((seg, idx) => {
      const segFrom = seg.from.toLowerCase();
      const segTo = seg.to.toLowerCase();

      // Check if any incident specifically affects this segment
      const segIncident = matchedIncidents.find((inc) => {
        const loc = (inc.locationName || inc.title || '').toLowerCase();
        return loc.includes(segFrom) || loc.includes(segTo) || (inc.chainageKm && seg.id.includes('seg'));
      });

      const segReport = matchedReports.find((rep) => {
        const loc = (rep.location || rep.description || '').toLowerCase();
        return loc.includes(segFrom) || loc.includes(segTo);
      });

      let calculatedStatus: HighwayRealtimeStatusType = 'open';
      let statusLabel = 'Open';
      let issue = seg.currentIssue;
      let verifiedBy = 'DoR Traffic Division';

      if (segIncident) {
        verifiedBy = segIncident.dorVerified ? 'DoR & Traffic Police 103 (Verified)' : 'Traffic Police Report';
        if (segIncident.type === 'landslide' || segIncident.type === 'flood' || segIncident.severity === 'severe') {
          calculatedStatus = 'obstruction';
          statusLabel = 'Obstruction';
          issue = segIncident.title + ': ' + segIncident.description;
        } else if (segIncident.type === 'construction' || segIncident.type === 'bridge_maintenance') {
          calculatedStatus = 'roadwork';
          statusLabel = 'Roadwork';
          issue = segIncident.title + ' - ' + segIncident.description;
        } else {
          calculatedStatus = 'caution';
          statusLabel = 'Caution';
          issue = segIncident.title;
        }
      } else if (seg.status === 'obstructed' || seg.status === 'closed') {
        calculatedStatus = 'obstruction';
        statusLabel = 'Obstruction';
      } else if (seg.status === 'caution' || seg.surface === 'under_construction') {
        calculatedStatus = 'roadwork';
        statusLabel = 'Roadwork';
      } else if (segReport) {
        if (segReport.incidentType === 'landslide' || segReport.severity === 'severe') {
          calculatedStatus = 'obstruction';
          statusLabel = 'Obstruction';
        } else if (segReport.incidentType === 'construction') {
          calculatedStatus = 'roadwork';
          statusLabel = 'Roadwork';
        } else {
          calculatedStatus = 'caution';
          statusLabel = 'Caution';
        }
        issue = `Community alert: ${segReport.description} (${segReport.reporterName})`;
        verifiedBy = segReport.verified ? 'Verified Community Report' : 'Unverified Citizen Report';
      }

      segments.push({
        id: seg.id || `${highway.id || code}-seg-${idx + 1}`,
        from: seg.from,
        to: seg.to,
        distanceKm: seg.distanceKm,
        avgSpeedKmh: seg.avgSpeedKmh || (calculatedStatus === 'obstruction' ? 15 : calculatedStatus === 'roadwork' ? 30 : 50),
        surface: seg.surface || 'blacktopped_fair',
        status: seg.status || (calculatedStatus === 'obstruction' ? 'obstructed' : calculatedStatus === 'roadwork' ? 'caution' : 'clear'),
        realtimeStatusType: calculatedStatus,
        statusLabel,
        lanes: seg.lanes || 2,
        elevationStartM: seg.elevationStartM,
        elevationEndM: seg.elevationEndM,
        currentIssue: issue || (calculatedStatus === 'open' ? 'Normal two-way traffic flow' : undefined),
        lastUpdated: seg.lastUpdated || (segIncident ? segIncident.reportedAt : 'Recently verified'),
        verifiedBy,
        hasIncident: !!(segIncident || segReport),
        incidentType: segIncident?.type || segReport?.incidentType,
        coordinates: seg.coordinates
      });
    });
  } else if (highway.segmentLinks && highway.segmentLinks.length > 0) {
    // Generate structured segments from DoR surveyed links
    // Group adjacent small links to create 3 to 6 meaningful highway segments
    const links = highway.segmentLinks;
    const groupSize = Math.max(1, Math.ceil(links.length / 5));

    for (let i = 0; i < links.length; i += groupSize) {
      const chunk = links.slice(i, i + groupSize);
      const chunkDist = chunk.reduce((sum, l) => sum + (l.linkLenKm || 0), 0);
      const firstLink = chunk[0];
      const lastLink = chunk[chunk.length - 1];

      const fromName = firstLink.linkName ? firstLink.linkName.split('-')[0].trim() : (firstLink.distName || `${code} Sec ${i + 1}`);
      const toName = lastLink.linkName ? (lastLink.linkName.split('-')[1] || lastLink.linkName).trim() : (lastLink.distName || `${code} Sec ${i + chunk.length}`);

      const paveType = firstLink.paveType || 'Blacktopped';
      let surface: SurfaceType = 'blacktopped_fair';
      if (paveType.toLowerCase().includes('asphalt') || paveType.toLowerCase().includes('concrete')) {
        surface = 'asphalt_excellent';
      } else if (paveType.toLowerCase().includes('gravel')) {
        surface = 'gravel';
      } else if (paveType.toLowerCase().includes('earthen') || paveType.toLowerCase().includes('track')) {
        surface = 'offroad_mud';
      }

      // Check matched incidents for this chunk
      const chunkInc = matchedIncidents.find(inc => {
        const lName = (inc.locationName || '').toLowerCase();
        return chunk.some(c => (c.distName && lName.includes(c.distName.toLowerCase())) || (c.linkName && lName.includes(c.linkName.toLowerCase())));
      });

      let chunkStatus: HighwayRealtimeStatusType = 'open';
      let statusLabel = 'Open';
      let issue: string | undefined;

      if (chunkInc) {
        if (chunkInc.type === 'landslide' || chunkInc.type === 'flood' || chunkInc.severity === 'severe') {
          chunkStatus = 'obstruction';
          statusLabel = 'Obstruction';
          issue = chunkInc.title + ': ' + chunkInc.description;
        } else if (chunkInc.type === 'construction' || chunkInc.type === 'bridge_maintenance') {
          chunkStatus = 'roadwork';
          statusLabel = 'Roadwork';
          issue = chunkInc.title;
        } else {
          chunkStatus = 'caution';
          statusLabel = 'Caution';
          issue = chunkInc.title;
        }
      } else if (surface === 'offroad_mud') {
        chunkStatus = 'caution';
        statusLabel = 'Caution';
        issue = 'Unpaved mountain track; 4WD vehicle recommended';
      }

      segments.push({
        id: `${code}-linkgrp-${Math.floor(i / groupSize) + 1}`,
        from: fromName || `Km ${Math.round(firstLink.linkFrom || 0)}`,
        to: toName || `Km ${Math.round(lastLink.linkTo || chunkDist)}`,
        distanceKm: Number(chunkDist.toFixed(1)) || 25,
        avgSpeedKmh: surface === 'asphalt_excellent' ? 55 : surface === 'blacktopped_fair' ? 45 : 25,
        surface,
        status: chunkStatus === 'obstruction' ? 'obstructed' : chunkStatus === 'roadwork' ? 'caution' : 'clear',
        realtimeStatusType: chunkStatus,
        statusLabel,
        lanes: 2,
        currentIssue: issue || (chunkStatus === 'open' ? 'Smooth flow across surveyed links' : undefined),
        lastUpdated: chunkInc ? chunkInc.reportedAt : 'DoR 2025 Road Survey',
        verifiedBy: firstLink.divName ? `DoR Road Division ${firstLink.divName}` : 'Department of Roads',
        hasIncident: !!chunkInc,
        incidentType: chunkInc?.type
      });
    }
  } else {
    // Single continuous corridor segment
    const hasSevereInc = matchedIncidents.some(i => i.type === 'landslide' || i.type === 'flood');
    const hasWorkInc = matchedIncidents.some(i => i.type === 'construction' || i.type === 'bridge_maintenance');
    
    let genStatus: HighwayRealtimeStatusType = 'open';
    if (hasSevereInc) genStatus = 'obstruction';
    else if (hasWorkInc) genStatus = 'roadwork';
    else if (highway.overallStatus === 'caution') genStatus = 'roadwork';

    segments.push({
      id: `${code}-seg-main`,
      from: highway.startPoint || 'Start Junction',
      to: highway.endPoint || 'Terminal Junction',
      distanceKm: highway.totalLengthKm || 45,
      avgSpeedKmh: 45,
      surface: 'blacktopped_fair',
      status: genStatus === 'obstruction' ? 'obstructed' : genStatus === 'roadwork' ? 'caution' : 'clear',
      realtimeStatusType: genStatus,
      statusLabel: genStatus === 'obstruction' ? 'Obstruction' : genStatus === 'roadwork' ? 'Roadwork' : 'Open',
      lanes: 2,
      currentIssue: matchedIncidents[0]?.title || (genStatus === 'open' ? 'Two-way open for all vehicles' : undefined),
      lastUpdated: 'Live Feed',
      verifiedBy: highway.dorDivision || 'DoR Traffic Operations'
    });
  }

  // Calculate aggregated segment statistics
  const totalSegs = segments.length;
  const openCount = segments.filter((s) => s.realtimeStatusType === 'open').length;
  const roadworkCount = segments.filter((s) => s.realtimeStatusType === 'roadwork').length;
  const obstructionCount = segments.filter((s) => s.realtimeStatusType === 'obstruction').length;
  const cautionCount = segments.filter((s) => s.realtimeStatusType === 'caution').length;

  let overallRealtimeStatus: HighwayRealtimeStatusType = 'open';
  let overallLabel: 'Open' | 'Roadwork' | 'Obstruction' | 'Caution' | 'Closed' = 'Open';
  let badgeText = '✓ Two-Way Open';
  let statusSummary = `${totalSegs} of ${totalSegs} segments operational`;
  let headlineIssue: string | undefined;

  if (obstructionCount > 0) {
    overallRealtimeStatus = 'obstruction';
    overallLabel = 'Obstruction';
    badgeText = `⛔ Obstruction (${obstructionCount} ${obstructionCount === 1 ? 'Sec' : 'Secs'})`;
    const obstructedSeg = segments.find((s) => s.realtimeStatusType === 'obstruction');
    headlineIssue = obstructedSeg?.currentIssue || 'Road obstruction reported';
    statusSummary = `${obstructionCount} segment${obstructionCount > 1 ? 's' : ''} blocked/obstructed • ${openCount} open`;
  } else if (roadworkCount > 0) {
    overallRealtimeStatus = 'roadwork';
    overallLabel = 'Roadwork';
    badgeText = `🚧 Roadwork (${roadworkCount} ${roadworkCount === 1 ? 'Sec' : 'Secs'})`;
    const workSeg = segments.find((s) => s.realtimeStatusType === 'roadwork');
    headlineIssue = workSeg?.currentIssue || 'Ongoing road widening & construction';
    statusSummary = `${roadworkCount} segment${roadworkCount > 1 ? 's' : ''} in construction/widening • ${openCount} open`;
  } else if (cautionCount > 0) {
    overallRealtimeStatus = 'caution';
    overallLabel = 'Caution';
    badgeText = `⚠️ Caution (${cautionCount} ${cautionCount === 1 ? 'Sec' : 'Secs'})`;
    const cautionSeg = segments.find((s) => s.realtimeStatusType === 'caution');
    headlineIssue = cautionSeg?.currentIssue || 'Drive with caution';
    statusSummary = `${cautionCount} advisory segment${cautionCount > 1 ? 's' : ''} • ${openCount} open`;
  } else {
    overallRealtimeStatus = 'open';
    overallLabel = 'Open';
    badgeText = '✓ Open (Two-Way)';
    statusSummary = `All ${totalSegs} segments fully clear and open`;
  }

  const passabilityScore = totalSegs > 0 ? Math.round(((openCount + cautionCount * 0.7 + roadworkCount * 0.4) / totalSegs) * 100) : 100;

  // Theming presets
  const theme = {
    open: {
      badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-700/80',
      dotColor: 'bg-emerald-400',
      icon: '✓'
    },
    roadwork: {
      badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-700/80',
      dotColor: 'bg-amber-400',
      icon: '🚧'
    },
    obstruction: {
      badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-700/80',
      badgeText: 'text-rose-300',
      badgeBorder: 'border-rose-700/80',
      dotColor: 'bg-rose-500 animate-pulse',
      icon: '⛔'
    },
    caution: {
      badgeBg: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80',
      badgeText: 'text-yellow-300',
      badgeBorder: 'border-yellow-700/80',
      dotColor: 'bg-yellow-400',
      icon: '⚠️'
    },
    closed: {
      badgeBg: 'bg-red-950/90 text-red-200 border-red-700',
      badgeText: 'text-red-200',
      badgeBorder: 'border-red-700',
      dotColor: 'bg-red-500',
      icon: '✕'
    }
  }[overallRealtimeStatus];

  return {
    highwayId: highway.id || code.toLowerCase(),
    highwayCode: code,
    highwayName: name,
    realtimeStatus: overallRealtimeStatus,
    statusLabel: overallLabel,
    statusBadgeText: badgeText,
    statusSummary,
    passabilityScore,
    totalSegments: totalSegs,
    openSegmentsCount: openCount,
    roadworkSegmentsCount: roadworkCount,
    obstructionSegmentsCount: obstructionCount,
    cautionSegmentsCount: cautionCount,
    activeIncidentsCount: matchedIncidents.length + matchedReports.length,
    segments,
    headlineIssue,
    theme
  };
}
