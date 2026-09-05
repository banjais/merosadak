import {
  SafetyTier,
  AccidentRiskLevel,
  SegmentSafetyData,
  RouteSafetyIndex,
  KnownBlackspot,
  SurfaceType,
  RoadStatusType,
} from '../types';
import { NEPAL_HIGHWAY_BLACKSPOTS, CORRIDOR_SAFETY_PROFILES } from '../data/accidentBlackspotsData';

// Color Palette for Safety Index Tiers
export const SAFETY_TIER_COLORS: Record<SafetyTier, string> = {
  high: '#10b981', // Emerald Green (Score 80 - 100)
  moderate: '#f59e0b', // Amber Yellow (Score 60 - 79)
  elevated_risk: '#f97316', // Vibrant Orange (Score 40 - 59)
  high_hazard: '#ef4444', // Crimson Red (Score < 40)
};

export const SAFETY_TIER_BG_CLASSES: Record<SafetyTier, string> = {
  high: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  moderate: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  elevated_risk: 'bg-orange-500/15 border-orange-500/40 text-orange-300',
  high_hazard: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
};

export const SAFETY_TIER_LABELS: Record<SafetyTier, string> = {
  high: 'High Safety (Paved & Divided)',
  moderate: 'Moderate Caution (Hilly & Winding)',
  elevated_risk: 'Elevated Risk (Widening / Heavy Traffic)',
  high_hazard: 'High Hazard (Historical Blackspot / Cliff)',
};

/**
 * Calculates a single segment's Highway Safety Score (0-100), Tier, and Color
 */
export function calculateSegmentSafety(params: {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  highwayCode: string;
  highwayName: string;
  distanceKm: number;
  surface: SurfaceType;
  status: RoadStatusType;
  elevationGainM: number;
  coordinates: [number, number][];
}): SegmentSafetyData {
  const { fromId, toId, fromName, toName, highwayCode, highwayName, distanceKm, surface, status, elevationGainM, coordinates } = params;

  const edgeKey1 = `${fromId}-${toId}`;
  const edgeKey2 = `${toId}-${fromId}`;
  const profile = CORRIDOR_SAFETY_PROFILES[edgeKey1] || CORRIDOR_SAFETY_PROFILES[edgeKey2];

  // 1. Road Quality Score (0 - 100)
  let baseRoadQuality = 80;
  if (surface === 'asphalt_excellent') baseRoadQuality = 96;
  else if (surface === 'blacktopped_fair') baseRoadQuality = 78;
  else if (surface === 'under_construction') baseRoadQuality = 48;
  else if (surface === 'gravel') baseRoadQuality = 55;
  else if (surface === 'offroad_mud') baseRoadQuality = 32;

  // Status adjustment
  if (status === 'caution') baseRoadQuality *= 0.84;
  else if (status === 'obstructed') baseRoadQuality *= 0.55;
  else if (status === 'closed') baseRoadQuality *= 0.15;

  const roadQualityScore = profile?.roadQualityScore ? Math.round(profile.roadQualityScore * (status === 'caution' ? 0.9 : 1)) : Math.round(baseRoadQuality);

  // 2. Historical Accident Risk & Score
  let accidentRiskLevel: AccidentRiskLevel = profile?.baseAccidentRisk || 'moderate';
  let annualAccidentIncidents = profile?.annualIncidents || 35;

  let accidentSafetyComponent = 75;
  if (accidentRiskLevel === 'low') accidentSafetyComponent = 94;
  else if (accidentRiskLevel === 'moderate') accidentSafetyComponent = 74;
  else if (accidentRiskLevel === 'high') accidentSafetyComponent = 46;
  else if (accidentRiskLevel === 'critical') accidentSafetyComponent = 26;

  // Gradient & Terrain Penalty
  let terrainPenalty = 0;
  if (Math.abs(elevationGainM) > 400) {
    terrainPenalty = 8; // steep descent/climb increases braking and rollover risk
  }

  // Combined weighted safety score: 45% Road Quality + 45% Historical Accident Baseline - Terrain Penalty + 10% Status
  let rawSafetyScore = Math.round(
    roadQualityScore * 0.45 +
    accidentSafetyComponent * 0.45 +
    (status === 'clear' ? 10 : status === 'caution' ? 4 : 0) -
    terrainPenalty
  );

  const safetyScore = Math.max(15, Math.min(99, rawSafetyScore));

  // Determine Safety Tier
  let safetyTier: SafetyTier = 'high';
  if (safetyScore >= 80) safetyTier = 'high';
  else if (safetyScore >= 60) safetyTier = 'moderate';
  else if (safetyScore >= 42) safetyTier = 'elevated_risk';
  else safetyTier = 'high_hazard';

  // Find linked blackspot if any
  let blackspotName: string | undefined;
  if (profile?.blackspotId) {
    const bs = NEPAL_HIGHWAY_BLACKSPOTS.find((b) => b.id === profile.blackspotId);
    if (bs) blackspotName = bs.name;
  }

  // Extract hazard factors
  const hazardFactors = profile?.hazardFactors || [
    status === 'caution' ? 'Active single-lane highway caution' : 'General mountain highway gradient',
    surface === 'under_construction' ? 'Loose gravel & unpaved work zone' : 'Two-way single carriageway without median',
  ];

  const recommendedSpeedKmh = profile?.recommendedSpeedKmh || (safetyScore >= 80 ? 65 : safetyScore >= 60 ? 45 : 30);

  return {
    segmentId: `seg-${fromId}-${toId}-${highwayCode}`,
    fromName,
    toName,
    highwayCode,
    highwayName,
    distanceKm,
    safetyScore,
    safetyTier,
    color: SAFETY_TIER_COLORS[safetyTier],
    roadQualityScore,
    accidentRiskLevel,
    annualAccidentIncidents,
    hazardFactors,
    recommendedSpeedKmh,
    blackspotName,
    coordinates,
  };
}

/**
 * Calculates the comprehensive Route Highway Safety Index for a complete trip plan
 */
export function calculateRouteSafetyIndex(
  segmentsSafety: SegmentSafetyData[],
  totalDistanceKm: number
): RouteSafetyIndex {
  if (!segmentsSafety || segmentsSafety.length === 0 || totalDistanceKm <= 0) {
    return {
      overallScore: 80,
      safetyTier: 'high',
      tierLabel: 'Safe Corridor',
      color: SAFETY_TIER_COLORS.high,
      roadQualityAverage: 85,
      accidentRiskSummary: {
        safeKm: 0,
        moderateKm: 0,
        elevatedRiskKm: 0,
        highHazardKm: 0,
        safePercentage: 100,
      },
      totalHistoricalAnnualAccidents: 0,
      activeBlackspots: [],
      segmentBreakdown: [],
      keySafetyDirectives: ['Maintain safe following distance.'],
    };
  }

  let weightedSafetyScoreSum = 0;
  let weightedQualityScoreSum = 0;
  let totalHistoricalAnnualAccidents = 0;

  let safeKm = 0;
  let moderateKm = 0;
  let elevatedRiskKm = 0;
  let highHazardKm = 0;

  segmentsSafety.forEach((seg) => {
    weightedSafetyScoreSum += seg.safetyScore * seg.distanceKm;
    weightedQualityScoreSum += seg.roadQualityScore * seg.distanceKm;
    totalHistoricalAnnualAccidents += seg.annualAccidentIncidents;

    if (seg.safetyTier === 'high') safeKm += seg.distanceKm;
    else if (seg.safetyTier === 'moderate') moderateKm += seg.distanceKm;
    else if (seg.safetyTier === 'elevated_risk') elevatedRiskKm += seg.distanceKm;
    else highHazardKm += seg.distanceKm;
  });

  const overallScore = Math.round(weightedSafetyScoreSum / totalDistanceKm);
  const roadQualityAverage = Math.round(weightedQualityScoreSum / totalDistanceKm);
  const safePercentage = Math.round((safeKm / totalDistanceKm) * 100);

  let safetyTier: SafetyTier = 'high';
  let tierLabel = 'Optimal Safety & Well-Maintained';

  if (overallScore >= 80) {
    safetyTier = 'high';
    tierLabel = 'Safe Corridor (Divided / Low Accident Risk)';
  } else if (overallScore >= 60) {
    safetyTier = 'moderate';
    tierLabel = 'Moderate Caution (Mountain Slopes & Curves)';
  } else if (overallScore >= 42) {
    safetyTier = 'elevated_risk';
    tierLabel = 'Elevated Risk (Widening / Canyon Cliffs)';
  } else {
    safetyTier = 'high_hazard';
    tierLabel = 'High Hazard Corridor (Known Blackspots / Heavy Freight)';
  }

  // Identify active blackspots on this specific route
  const activeBlackspots: KnownBlackspot[] = [];
  const highwayCodesOnPath = Array.from(new Set(segmentsSafety.map((s) => s.highwayCode.split('/')[0])));

  NEPAL_HIGHWAY_BLACKSPOTS.forEach((bs) => {
    if (highwayCodesOnPath.some((c) => bs.highwayCode.includes(c))) {
      // Check if coordinates roughly match route bounding box or close to any segment
      activeBlackspots.push(bs);
    }
  });

  // Generate actionable key safety directives based on route metrics
  const keySafetyDirectives: string[] = [];

  if (highHazardKm > 0 || activeBlackspots.length > 0) {
    keySafetyDirectives.push('Sound horn before all blind canyon curves; avoid overtaking on unbanked switchbacks.');
  }
  if (elevatedRiskKm > 0) {
    keySafetyDirectives.push('Reduce speed by 15-20 km/h in gravel and active widening zones (Tanahun/Mugling corridor).');
  }
  keySafetyDirectives.push('Use engine braking (2nd/3rd gear) on steep descents to prevent brake shoe overheating.');
  if (totalHistoricalAnnualAccidents > 100) {
    keySafetyDirectives.push('High-density night commercial traffic corridor: keep low-beam fog lights on during dawn/dusk hours.');
  }

  return {
    overallScore,
    safetyTier,
    tierLabel,
    color: SAFETY_TIER_COLORS[safetyTier],
    roadQualityAverage,
    accidentRiskSummary: {
      safeKm,
      moderateKm,
      elevatedRiskKm,
      highHazardKm,
      safePercentage,
    },
    totalHistoricalAnnualAccidents,
    activeBlackspots,
    segmentBreakdown: segmentsSafety,
    keySafetyDirectives,
  };
}
