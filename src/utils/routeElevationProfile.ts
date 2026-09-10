import { RoutePlanResult } from '../types';
import { getDistanceKm } from './geoUtils';

export interface RouteElevationProfilePoint {
  distance: number;
  elevation: number;
  grade: number;
  stepIndex: number;
  instruction: string;
  highwayCode?: string;
  surface: string;
  roadStatus: string;
  lat: number;
  lng: number;
  isSummit?: boolean;
  isValley?: boolean;
  isSteepIncline: boolean;
  isExtremeIncline: boolean;
  isSteepDescent: boolean;
  landmarkLabel?: string;
  steepElevation?: number | null;
}

export interface SteepHazardZone {
  id: string;
  title: string;
  highwayCode?: string;
  startKm: number;
  endKm: number;
  lengthKm: number;
  startElevation: number;
  endElevation: number;
  elevationDiff: number;
  avgGrade: number;
  maxGrade: number;
  direction: 'climb' | 'descent';
  severity: 'steep' | 'extreme';
  lat: number;
  lng: number;
  vehicleAdvice: string;
}

export interface RouteElevationProfileStats {
  totalAscent: number;
  totalDescent: number;
  maxElevation: number;
  minElevation: number;
  peakSummitName: string;
  peakSummitKm: number;
  maxGrade: number;
  minGrade: number;
  avgGrade: number;
  steepDistanceKm: number;
  extremeDistanceKm: number;
  steepDescentDistanceKm: number;
}

export interface RouteElevationProfileResult {
  elevationPoints: RouteElevationProfilePoint[];
  stats: RouteElevationProfileStats;
  altitudeZones: {
    lowlandDistKm: number;
    midHillDistKm: number;
    highPassDistKm: number;
    lowlandPercent: number;
    midHillPercent: number;
    highPassPercent: number;
  };
  steepHazardZones: SteepHazardZone[];
  steepPointsCount: number;
  steepInclineKm: number;
}

export interface RouteMapPosition {
  lat: number;
  lng: number;
  distance: number;
}

export interface RouteElevationPosition extends RouteMapPosition {
  elevation: number;
  grade: number;
  landmark?: string;
  stepInstruction?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function buildRouteElevationProfile(
  route: RoutePlanResult | null | undefined,
  steepThreshold = 8
): RouteElevationProfileResult {
  if (!route) {
    return {
      elevationPoints: [],
      stats: {
        totalAscent: 0,
        totalDescent: 0,
        maxElevation: 0,
        minElevation: 0,
        peakSummitName: 'N/A',
        peakSummitKm: 0,
        maxGrade: 0,
        minGrade: 0,
        avgGrade: 0,
        steepDistanceKm: 0,
        extremeDistanceKm: 0,
        steepDescentDistanceKm: 0,
      },
      altitudeZones: {
        lowlandDistKm: 0,
        midHillDistKm: 0,
        highPassDistKm: 0,
        lowlandPercent: 0,
        midHillPercent: 0,
        highPassPercent: 0,
      },
      steepHazardZones: [],
      steepPointsCount: 0,
      steepInclineKm: 0,
    };
  }

  const totalDist = route.totalDistanceKm || 10;
  const originElev = route.origin?.elevationM ?? 1350;
  const destElev = route.destination?.elevationM ?? 822;
  const maxElev = Math.max(
    originElev,
    destElev,
    route.maxElevationM ?? Math.max(originElev, destElev, 1480)
  );
  const steps = route.steps || [];
  const pathCoords: [number, number][] =
    route.pathCoordinates && route.pathCoordinates.length >= 2
      ? route.pathCoordinates
      : [
          [route.origin.lat, route.origin.lng],
          [route.destination.lat, route.destination.lng],
        ];

  interface Milestone {
    distance: number;
    elevation: number;
    stepIndex: number;
    instruction: string;
    highwayCode?: string;
    surface: string;
    roadStatus: string;
  }

  const milestones: Milestone[] = [
    {
      distance: 0,
      elevation: originElev,
      stepIndex: 0,
      instruction: `Departure: ${route.origin.name}`,
      highwayCode: steps[0]?.highwayCode,
      surface: steps[0]?.surface || 'asphalt_excellent',
      roadStatus: steps[0]?.roadStatus || 'clear',
    },
  ];

  let currentStepDist = 0;
  let currentStepElev = originElev;
  steps.forEach((step, idx) => {
    const stepDist = step.distanceKm || 1;
    const stepElevChange = step.elevationChangeM || 0;
    currentStepDist += stepDist;
    currentStepElev = clamp(
      currentStepElev + stepElevChange,
      60,
      maxElev + 100
    );
    milestones.push({
      distance: Math.min(totalDist, Math.round(currentStepDist * 10) / 10),
      elevation: Math.round(currentStepElev),
      stepIndex: idx,
      instruction: step.instruction,
      highwayCode: step.highwayCode,
      surface: step.surface,
      roadStatus: step.roadStatus,
    });
  });

  if (steps.length > 0 && milestones.length > 0) {
    milestones[milestones.length - 1].elevation = destElev;
    milestones[milestones.length - 1].distance = totalDist;
  } else {
    milestones.push({
      distance: totalDist,
      elevation: destElev,
      stepIndex: Math.max(0, steps.length - 1),
      instruction: `Arrival: ${route.destination.name}`,
      highwayCode: steps[steps.length - 1]?.highwayCode,
      surface: steps[steps.length - 1]?.surface || 'asphalt_excellent',
      roadStatus: steps[steps.length - 1]?.roadStatus || 'clear',
    });
  }

  const coordCumulativeKm: number[] = [0];
  let totalPathKm = 0;
  for (let i = 1; i < pathCoords.length; i++) {
    totalPathKm += getDistanceKm(
      pathCoords[i - 1][0],
      pathCoords[i - 1][1],
      pathCoords[i][0],
      pathCoords[i][1]
    );
    coordCumulativeKm.push(totalPathKm);
  }

  const getPointLatLng = (sampleDistKm: number): [number, number] => {
    if (pathCoords.length <= 1 || sampleDistKm <= 0) {
      return pathCoords[0];
    }
    if (totalPathKm <= 0) {
      const frac = clamp(sampleDistKm / totalDist, 0, 1);
      return [
        route.origin.lat + (route.destination.lat - route.origin.lat) * frac,
        route.origin.lng + (route.destination.lng - route.origin.lng) * frac,
      ];
    }

    const normalizedPathDist = clamp(sampleDistKm / totalDist, 0, 1) * totalPathKm;
    for (let i = 0; i < coordCumulativeKm.length - 1; i++) {
      if (
        normalizedPathDist >= coordCumulativeKm[i] &&
        normalizedPathDist <= coordCumulativeKm[i + 1]
      ) {
        const span = coordCumulativeKm[i + 1] - coordCumulativeKm[i] || 0.001;
        const segFrac = clamp(
          (normalizedPathDist - coordCumulativeKm[i]) / span,
          0,
          1
        );
        return [
          pathCoords[i][0] + (pathCoords[i + 1][0] - pathCoords[i][0]) * segFrac,
          pathCoords[i][1] + (pathCoords[i + 1][1] - pathCoords[i][1]) * segFrac,
        ];
      }
    }
    return pathCoords[pathCoords.length - 1];
  };

  const targetSamples = Math.max(45, Math.min(120, Math.round(totalDist * 1.5)));
  const rawPoints: RouteElevationProfilePoint[] = [];
  let highestElev = -Infinity;
  let lowestElev = Infinity;
  let peakIndex = 0;
  let valleyIndex = 0;

  for (let i = 0; i <= targetSamples; i++) {
    const sampleDist = (i / targetSamples) * totalDist;
    let prevM = milestones[0];
    let nextM = milestones[milestones.length - 1];

    for (let m = 0; m < milestones.length - 1; m++) {
      if (sampleDist >= milestones[m].distance && sampleDist <= milestones[m + 1].distance) {
        prevM = milestones[m];
        nextM = milestones[m + 1];
        break;
      }
    }

    const segmentSpan = nextM.distance - prevM.distance || 0.001;
    const t = clamp((sampleDist - prevM.distance) / segmentSpan, 0, 1);
    const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
    let interpElev = prevM.elevation + (nextM.elevation - prevM.elevation) * smoothT;

    if (segmentSpan > 12) {
      interpElev +=
        Math.sin(t * Math.PI) *
        (Math.abs(nextM.elevation - prevM.elevation) * 0.06 + 8);
    }

    interpElev = Math.round(clamp(interpElev, 60, maxElev));

    let grade = 0;
    if (rawPoints.length > 0) {
      const prevP = rawPoints[rawPoints.length - 1];
      const dDistKm = sampleDist - prevP.distance;
      const dElevM = interpElev - prevP.elevation;
      if (dDistKm > 0) {
        grade = Math.round((dElevM / (dDistKm * 1000)) * 100 * 10) / 10;
      }
    }

    if (interpElev > highestElev) {
      highestElev = interpElev;
      peakIndex = i;
    }
    if (interpElev < lowestElev) {
      lowestElev = interpElev;
      valleyIndex = i;
    }

    const [pLat, pLng] = getPointLatLng(sampleDist);
    const isSteepIncline = grade >= steepThreshold;
    const isExtremeIncline = grade >= 10;
    const isSteepDescent = grade <= -steepThreshold;

    rawPoints.push({
      distance: Math.round(sampleDist * 10) / 10,
      elevation: interpElev,
      grade,
      stepIndex: prevM.stepIndex,
      instruction: prevM.instruction,
      highwayCode: prevM.highwayCode,
      surface: prevM.surface,
      roadStatus: prevM.roadStatus,
      lat: pLat,
      lng: pLng,
      isSteepIncline,
      isExtremeIncline,
      isSteepDescent,
      steepElevation: isSteepIncline ? interpElev : null,
    });
  }

  if (rawPoints[peakIndex]) {
    rawPoints[peakIndex].isSummit = true;
    rawPoints[peakIndex].landmarkLabel = `Summit Pass: ${rawPoints[peakIndex].elevation}m`;
  }
  if (rawPoints[valleyIndex] && valleyIndex !== 0 && valleyIndex !== rawPoints.length - 1) {
    rawPoints[valleyIndex].isValley = true;
    rawPoints[valleyIndex].landmarkLabel = `Valley Base: ${rawPoints[valleyIndex].elevation}m`;
  }
  if (rawPoints[0]) rawPoints[0].landmarkLabel = `Start: ${route.origin.name}`;
  if (rawPoints[rawPoints.length - 1]) {
    rawPoints[rawPoints.length - 1].landmarkLabel = `Destination: ${route.destination.name}`;
  }

  let totalAscent = 0;
  let totalDescent = 0;
  let maxPositiveGrade = 0;
  let maxNegativeGrade = 0;
  let steepDist = 0;
  let extremeDist = 0;
  let steepDescentDist = 0;
  let countSteep = 0;
  let lowlandDistKm = 0;
  let midHillDistKm = 0;
  let highPassDistKm = 0;

  for (let i = 1; i < rawPoints.length; i++) {
    const pPrev = rawPoints[i - 1];
    const pCurr = rawPoints[i];
    const segDist = pCurr.distance - pPrev.distance;
    const dElev = pCurr.elevation - pPrev.elevation;

    if (dElev > 0) totalAscent += dElev;
    else totalDescent += Math.abs(dElev);

    if (pCurr.grade > maxPositiveGrade) maxPositiveGrade = pCurr.grade;
    if (pCurr.grade < maxNegativeGrade) maxNegativeGrade = pCurr.grade;

    if (pCurr.isSteepIncline) {
      steepDist += segDist;
      countSteep++;
    }
    if (pCurr.isExtremeIncline) extremeDist += segDist;
    if (pCurr.isSteepDescent) steepDescentDist += segDist;

    const avgElev = (pCurr.elevation + pPrev.elevation) / 2;
    if (avgElev < 500) lowlandDistKm += segDist;
    else if (avgElev <= 1500) midHillDistKm += segDist;
    else highPassDistKm += segDist;
  }

  const identifiedZones: SteepHazardZone[] = [];
  let currentCluster: RouteElevationProfilePoint[] = [];
  rawPoints.forEach((pt) => {
    if (Math.abs(pt.grade) >= steepThreshold - 0.5) {
      currentCluster.push(pt);
      return;
    }

    if (currentCluster.length >= 2) {
      const first = currentCluster[0];
      const last = currentCluster[currentCluster.length - 1];
      const lengthKm = Math.round((last.distance - first.distance) * 10) / 10;
      const elevDiff = last.elevation - first.elevation;
      const maxG = Math.max(...currentCluster.map((p) => Math.abs(p.grade)));
      const avgG =
        Math.round(
          (currentCluster.reduce((acc, p) => acc + p.grade, 0) / currentCluster.length) * 10
        ) / 10;
      const midPt = currentCluster[Math.floor(currentCluster.length / 2)];
      const isExtreme = maxG >= 10;
      const direction = elevDiff >= 0 ? 'climb' : 'descent';
      let title = first.instruction || 'Mountain Pass Sector';
      if (title.length > 38) title = title.substring(0, 35) + '...';

      identifiedZones.push({
        id: `zone-${first.distance}-${last.distance}`,
        title,
        highwayCode: first.highwayCode,
        startKm: first.distance,
        endKm: last.distance,
        lengthKm: Math.max(0.5, lengthKm),
        startElevation: first.elevation,
        endElevation: last.elevation,
        elevationDiff: Math.round(elevDiff),
        avgGrade: Math.abs(avgG),
        maxGrade: Math.round(maxG * 10) / 10,
        direction,
        severity: isExtreme ? 'extreme' : 'steep',
        lat: midPt.lat,
        lng: midPt.lng,
        vehicleAdvice:
          direction === 'climb'
            ? isExtreme
              ? 'Extreme climb (>10%): Shift to 1st/2nd gear. Monitor engine coolant and EV battery draw.'
              : `Steep climb (>${steepThreshold}%): Downshift to 2nd gear. Turn off AC if engine strains.`
            : isExtreme
              ? 'Critical descent: Severe risk of brake fluid boiling! Mandatory low-gear engine braking.'
              : 'Steep downhill: Downshift to engine brake. Avoid riding footbrake.',
      });
    }
    currentCluster = [];
  });

  const totalAltitudeDist = lowlandDistKm + midHillDistKm + highPassDistKm || 1;
  return {
    elevationPoints: rawPoints,
    stats: {
      totalAscent: Math.round(totalAscent),
      totalDescent: Math.round(totalDescent),
      maxElevation: highestElev === -Infinity ? maxElev : highestElev,
      minElevation: lowestElev === Infinity ? 0 : lowestElev,
      peakSummitName: rawPoints[peakIndex]?.landmarkLabel || 'Mountain Pass Summit',
      peakSummitKm: rawPoints[peakIndex]?.distance || 0,
      maxGrade: maxPositiveGrade,
      minGrade: maxNegativeGrade,
      avgGrade:
        Math.round(
          (rawPoints.reduce((acc, p) => acc + Math.abs(p.grade), 0) / (rawPoints.length || 1)) *
            10
        ) / 10,
      steepDistanceKm: Math.round(steepDist * 10) / 10,
      extremeDistanceKm: Math.round(extremeDist * 10) / 10,
      steepDescentDistanceKm: Math.round(steepDescentDist * 10) / 10,
    },
    altitudeZones: {
      lowlandDistKm: Math.round(lowlandDistKm * 10) / 10,
      midHillDistKm: Math.round(midHillDistKm * 10) / 10,
      highPassDistKm: Math.round(highPassDistKm * 10) / 10,
      lowlandPercent: Math.round((lowlandDistKm / totalAltitudeDist) * 100),
      midHillPercent: Math.round((midHillDistKm / totalAltitudeDist) * 100),
      highPassPercent: Math.round((highPassDistKm / totalAltitudeDist) * 100),
    },
    steepHazardZones: identifiedZones,
    steepPointsCount: countSteep,
    steepInclineKm: Math.round(steepDist * 10) / 10,
  };
}

export function getRoutePointAtDistance(
  route: RoutePlanResult,
  distanceKm: number
): RouteMapPosition {
  const totalDist = route.totalDistanceKm || 1;
  const pathCoords: [number, number][] =
    route.pathCoordinates && route.pathCoordinates.length >= 2
      ? route.pathCoordinates
      : [
          [route.origin.lat, route.origin.lng],
          [route.destination.lat, route.destination.lng],
        ];
  const cumulative: number[] = [0];
  let totalPathKm = 0;
  for (let i = 1; i < pathCoords.length; i++) {
    totalPathKm += getDistanceKm(
      pathCoords[i - 1][0],
      pathCoords[i - 1][1],
      pathCoords[i][0],
      pathCoords[i][1]
    );
    cumulative.push(totalPathKm);
  }

  const distance = clamp(distanceKm, 0, totalDist);
  if (pathCoords.length <= 1 || totalPathKm <= 0) {
    const frac = clamp(distance / totalDist, 0, 1);
    return {
      lat: route.origin.lat + (route.destination.lat - route.origin.lat) * frac,
      lng: route.origin.lng + (route.destination.lng - route.origin.lng) * frac,
      distance,
    };
  }

  const targetPathDistance = clamp(distance / totalDist, 0, 1) * totalPathKm;
  for (let i = 0; i < cumulative.length - 1; i++) {
    if (targetPathDistance >= cumulative[i] && targetPathDistance <= cumulative[i + 1]) {
      const span = cumulative[i + 1] - cumulative[i] || 0.001;
      const frac = clamp((targetPathDistance - cumulative[i]) / span, 0, 1);
      return {
        lat: pathCoords[i][0] + (pathCoords[i + 1][0] - pathCoords[i][0]) * frac,
        lng: pathCoords[i][1] + (pathCoords[i + 1][1] - pathCoords[i][1]) * frac,
        distance,
      };
    }
  }

  const last = pathCoords[pathCoords.length - 1];
  return { lat: last[0], lng: last[1], distance };
}

export function getRouteElevationPosition(
  points: RouteElevationProfilePoint[],
  distanceKm: number,
  fallbackRoute: RoutePlanResult
): RouteElevationPosition {
  if (points.length === 0) {
    return {
      lat: fallbackRoute.origin.lat,
      lng: fallbackRoute.origin.lng,
      distance: 0,
      elevation: fallbackRoute.origin.elevationM,
      grade: 0,
      landmark: fallbackRoute.origin.name,
      stepInstruction: 'Starting journey',
    };
  }

  const totalDistance = fallbackRoute.totalDistanceKm || points[points.length - 1].distance || 1;
  const distance = clamp(distanceKm, 0, totalDistance);
  let p0 = points[0];
  let p1 = points[points.length - 1];

  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].distance <= distance && points[i + 1].distance >= distance) {
      p0 = points[i];
      p1 = points[i + 1];
      break;
    }
  }

  const span = Math.max(0.001, p1.distance - p0.distance);
  const ratio = clamp((distance - p0.distance) / span, 0, 1);
  return {
    lat: p0.lat + (p1.lat - p0.lat) * ratio,
    lng: p0.lng + (p1.lng - p0.lng) * ratio,
    distance,
    elevation: Math.round(p0.elevation + (p1.elevation - p0.elevation) * ratio),
    grade: Math.round((p0.grade + (p1.grade - p0.grade) * ratio) * 10) / 10,
    landmark: p1.landmarkLabel || p0.landmarkLabel,
    stepInstruction: p1.instruction || p0.instruction,
  };
}
