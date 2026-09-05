import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Brush,
} from 'recharts';
import { RoutePlanResult, VehicleType } from '../types';
import {
  Mountain,
  TrendingUp,
  TrendingDown,
  Info,
  Gauge,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Car,
  Truck,
  Zap,
  Bike,
  Flame,
  MapPin,
  Navigation,
  Compass,
  CheckCircle2,
  Activity,
  Maximize2,
  Minimize2,
  Sliders,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ScanLine,
} from 'lucide-react';
import { getDistanceKm } from '../utils/geoUtils';

export interface ElevationProfilePoint {
  distance: number; // km from origin
  elevation: number; // meters ASL
  grade: number; // slope gradient percentage (+ incline, - descent)
  stepIndex: number;
  instruction: string;
  highwayCode?: string;
  surface: string;
  roadStatus: string;
  lat: number;
  lng: number;
  isSummit?: boolean;
  isValley?: boolean;
  isSteepIncline: boolean; // >= steepThreshold (e.g. >8% incline)
  isExtremeIncline: boolean; // >= 10% incline
  isSteepDescent: boolean; // <= -steepThreshold
  landmarkLabel?: string;
  steepElevation?: number | null; // elevation value if steep, null otherwise for specialized overlays
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

export interface RouteElevationProfileChartProps {
  activeRoute?: RoutePlanResult | null;
  routePlan?: RoutePlanResult | null;
  vehicle?: VehicleType;
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
  steepThreshold?: number; // Incline gradient % threshold, default 8.0
}

// Vehicle metadata for quick selection
const VEHICLE_OPTIONS: Array<{
  type: VehicleType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortDesc: string;
}> = [
  { type: 'car', label: 'Car / Sedan', icon: Car, shortDesc: 'Standard engine & disc brakes' },
  { type: 'suv_4wd', label: '4WD SUV', icon: ShieldAlert, shortDesc: 'High torque & hill descent' },
  { type: 'electric_vehicle', label: 'Electric EV', icon: Zap, shortDesc: 'Regen recovery & battery drain' },
  { type: 'motorbike', label: 'Motorbike', icon: Bike, shortDesc: 'Traction & balance sensitive' },
  { type: 'bus_truck', label: 'Bus / Heavy Truck', icon: Truck, shortDesc: 'High GVW & brake fade risk' },
];

export const RouteElevationProfileChart: React.FC<RouteElevationProfileChartProps> = ({
  activeRoute,
  routePlan,
  vehicle: initialVehicleProp,
  onViewOnMap,
  steepThreshold = 8.0,
}) => {
  // Normalize route prop from activeRoute or routePlan
  const route = activeRoute || routePlan;

  const [hoveredPoint, setHoveredPoint] = useState<ElevationProfilePoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ElevationProfilePoint | null>(null);

  // Active vehicle for performance testing (defaults to route vehicle, user can switch)
  const [activeVehicle, setActiveVehicle] = useState<VehicleType>(
    initialVehicleProp || route?.vehicle || 'car'
  );

  // Synchronization with prop changes
  React.useEffect(() => {
    if (initialVehicleProp) {
      setActiveVehicle(initialVehicleProp);
    }
  }, [initialVehicleProp]);

  // Visualization option toggles
  const [showSummits, setShowSummits] = useState<boolean>(true);
  const [gradientFilter, setGradientFilter] = useState<'all' | 'steep' | 'extreme'>('all');
  const [showAltitudeZones, setShowAltitudeZones] = useState<boolean>(true);
  const [isExpandedView, setIsExpandedView] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'performance' | 'hazard_zones'>('performance');
  const [customSteepThreshold, setCustomSteepThreshold] = useState<number>(steepThreshold);

  // Zooming & Section Selection States
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [showBrush, setShowBrush] = useState<boolean>(false);
  const isDraggingZoomRef = useRef<boolean>(false);

  // Reset zoom on route change
  useEffect(() => {
    setZoomDomain(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setSelectedPoint(null);
    setHoveredPoint(null);
  }, [route?.id, route?.totalDistanceKm]);

  // Dynamically calculate elevation points based on activeRoute coordinates
  const {
    elevationPoints,
    stats,
    altitudeZones,
    steepHazardZones,
    steepPointsCount,
    steepInclineKm,
  } = useMemo(() => {
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
    const maxElev = route.maxElevationM ?? Math.max(originElev, destElev, 1480);
    const steps = route.steps || [];

    // Extract real polyline pathCoordinates
    const pathCoords: [number, number][] =
      route.pathCoordinates && route.pathCoordinates.length >= 2
        ? route.pathCoordinates
        : [
            [route.origin.lat, route.origin.lng],
            [route.destination.lat, route.destination.lng],
          ];

    // 1. Build step-based elevation checkpoints / milestones
    let currentStepDist = 0;
    let currentStepElev = originElev;

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

    steps.forEach((step, idx) => {
      const stepDist = step.distanceKm || 1;
      const stepElevChange = step.elevationChangeM || 0;
      currentStepDist += stepDist;
      currentStepElev += stepElevChange;

      // Realistic physical clamp
      currentStepElev = Math.max(60, Math.min(maxElev + 100, currentStepElev));

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

    // Anchor destination milestone
    if (milestones.length > 0) {
      milestones[milestones.length - 1].elevation = destElev;
      milestones[milestones.length - 1].distance = totalDist;
    }

    // 2. Measure cumulative distance along actual polyline coordinates
    const coordCumulativeKm: number[] = [0];
    let totalPathKm = 0;
    for (let i = 1; i < pathCoords.length; i++) {
      const segKm = getDistanceKm(
        pathCoords[i - 1][0],
        pathCoords[i - 1][1],
        pathCoords[i][0],
        pathCoords[i][1]
      );
      totalPathKm += segKm;
      coordCumulativeKm.push(totalPathKm);
    }

    // 3. Coordinate interpolation helper
    const getPointLatLng = (sampleDistKm: number): [number, number] => {
      if (pathCoords.length <= 1 || sampleDistKm <= 0) {
        return pathCoords[0];
      }
      if (totalPathKm <= 0) {
        const frac = totalDist > 0 ? Math.min(1, Math.max(0, sampleDistKm / totalDist)) : 0;
        return [
          route.origin.lat + (route.destination.lat - route.origin.lat) * frac,
          route.origin.lng + (route.destination.lng - route.origin.lng) * frac,
        ];
      }

      // Find segment along cumulative distance
      const normalizedPathDist = (sampleDistKm / totalDist) * totalPathKm;
      for (let i = 0; i < coordCumulativeKm.length - 1; i++) {
        if (
          normalizedPathDist >= coordCumulativeKm[i] &&
          normalizedPathDist <= coordCumulativeKm[i + 1]
        ) {
          const span = coordCumulativeKm[i + 1] - coordCumulativeKm[i] || 0.001;
          const segFrac = Math.max(0, Math.min(1, (normalizedPathDist - coordCumulativeKm[i]) / span));
          return [
            pathCoords[i][0] + (pathCoords[i + 1][0] - pathCoords[i][0]) * segFrac,
            pathCoords[i][1] + (pathCoords[i + 1][1] - pathCoords[i][1]) * segFrac,
          ];
        }
      }
      return pathCoords[pathCoords.length - 1];
    };

    // 4. Sample route points dynamically (adapting resolution to distance)
    const TARGET_SAMPLES = Math.max(45, Math.min(120, Math.round(totalDist * 1.5)));
    const rawPoints: ElevationProfilePoint[] = [];

    let highestElev = -Infinity;
    let lowestElev = Infinity;
    let peakIndex = 0;
    let valleyIndex = 0;

    for (let i = 0; i <= TARGET_SAMPLES; i++) {
      const sampleDist = (i / TARGET_SAMPLES) * totalDist;

      // Milestone segment lookup
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
      const t = Math.max(0, Math.min(1, (sampleDist - prevM.distance) / segmentSpan));

      // Cosine ease for natural topography
      const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
      let interpElev = prevM.elevation + (nextM.elevation - prevM.elevation) * smoothT;

      // Add gentle mountain undulation for long stretches
      if (segmentSpan > 12) {
        const ripple = Math.sin(t * Math.PI) * (Math.abs(nextM.elevation - prevM.elevation) * 0.06 + 8);
        interpElev += ripple;
      }

      interpElev = Math.round(Math.max(60, Math.min(maxElev, interpElev)));

      // Calculate slope grade percentage
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

      const isSteepIncline = grade >= customSteepThreshold; // Specifically >= steepThreshold (e.g. >8% incline)
      const isExtremeIncline = grade >= 10.0;
      const isSteepDescent = grade <= -customSteepThreshold;

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

    // Mark summit and valley milestones
    if (rawPoints[peakIndex]) {
      rawPoints[peakIndex].isSummit = true;
      rawPoints[peakIndex].landmarkLabel = `Summit Pass: ${rawPoints[peakIndex].elevation}m`;
    }
    if (rawPoints[valleyIndex] && valleyIndex !== 0 && valleyIndex !== rawPoints.length - 1) {
      rawPoints[valleyIndex].isValley = true;
      rawPoints[valleyIndex].landmarkLabel = `Valley Base: ${rawPoints[valleyIndex].elevation}m`;
    }

    if (rawPoints[0]) rawPoints[0].landmarkLabel = `Start: ${route.origin.name}`;
    if (rawPoints[rawPoints.length - 1])
      rawPoints[rawPoints.length - 1].landmarkLabel = `Destination: ${route.destination.name}`;

    // Compute aggregate climbing statistics
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
      if (pCurr.isExtremeIncline) {
        extremeDist += segDist;
      }
      if (pCurr.isSteepDescent) {
        steepDescentDist += segDist;
      }

      const avgElev = (pCurr.elevation + pPrev.elevation) / 2;
      if (avgElev < 500) lowlandDistKm += segDist;
      else if (avgElev <= 1500) midHillDistKm += segDist;
      else highPassDistKm += segDist;
    }

    // Group contiguous steep/extreme gradient segments into identified Steep Hazard Zones
    const identifiedZones: SteepHazardZone[] = [];
    let currentCluster: ElevationProfilePoint[] = [];

    rawPoints.forEach((pt) => {
      if (Math.abs(pt.grade) >= customSteepThreshold - 0.5) {
        currentCluster.push(pt);
      } else {
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

          const isExtreme = maxG >= 10.0;
          const direction = elevDiff >= 0 ? 'climb' : 'descent';

          let title = first.instruction || 'Mountain Pass Sector';
          if (title.length > 38) title = title.substring(0, 35) + '...';

          let vehicleAdvice = '';
          if (direction === 'climb') {
            vehicleAdvice = isExtreme
              ? 'Extreme climb (>10%): Shift to 1st/2nd gear. Monitor engine coolant and EV battery draw.'
              : `Steep climb (>${customSteepThreshold}%): Downshift to 2nd gear. Turn off AC if engine strains.`;
          } else {
            vehicleAdvice = isExtreme
              ? 'Critical descent: Severe risk of brake fluid boiling! Mandatory low-gear engine braking.'
              : 'Steep downhill: Downshift to engine brake. Avoid riding footbrake.';
          }

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
            vehicleAdvice,
          });
        }
        currentCluster = [];
      }
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
            (rawPoints.reduce((acc, p) => acc + Math.abs(p.grade), 0) / (rawPoints.length || 1)) * 10
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
  }, [route, customSteepThreshold]);

  // Vehicle-specific mechanical strain calculations
  const vehicleImpact = useMemo(() => {
    const hasExtreme = stats.extremeDistanceKm > 0.5;
    const hasSteep = stats.steepDistanceKm > 1.0;
    const highAltitudeBonus = Math.max(0, stats.maxElevation - 1200);
    const altitudePowerLossPercent = Math.round((highAltitudeBonus / 300) * 3);

    const vehicleMassKg: Record<VehicleType, number> = {
      car: 1400,
      suv_4wd: 2100,
      electric_vehicle: 1850,
      motorbike: 220,
      bus_truck: 9500,
    };
    const mass = vehicleMassKg[activeVehicle] || 1500;
    const potentialEnergyJoules = mass * 9.81 * stats.totalAscent;
    const rawClimbKwh = Math.round((potentialEnergyJoules / 3600000) * 10) / 10;
    const evClimbEnergyKwh = Math.round(rawClimbKwh * 1.25 * 10) / 10;
    const evRegenPotentialKwh = Math.round(((mass * 9.81 * stats.totalDescent) / 3600000) * 0.65 * 10) / 10;
    const evNetKwh = Math.round((evClimbEnergyKwh - evRegenPotentialKwh) * 10) / 10;

    switch (activeVehicle) {
      case 'electric_vehicle':
        return {
          suitability: hasExtreme ? 'Challenging (High Battery Drain)' : 'Excellent (High Regen)',
          ratingColor: hasExtreme
            ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
            : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
          engineLoad: hasExtreme ? 'High Continuous Discharge (65–80 kW)' : 'Normal Modulated EV Power',
          gearAdvice: 'Single-speed transmission; rely on One-Pedal Drive Mode / Max Regen',
          coolingWarning: 'Battery thermal management will activate cooling fans on sustained ascents',
          altitudePowerLoss: 0,
          brakeFadeRisk: 'Extremely Low (Electric Regenerative Braking absorbs 70% downhill momentum)',
          brakeAdvice: 'Set Regen Level to High / B-Mode. Mechanical friction brakes stay cool.',
          evClimbEnergyKwh,
          evRegenRecoveredKwh: evRegenPotentialKwh,
          evNetElevationDeltaKwh: evNetKwh,
          checklist: [
            `Extra climb energy required: +${evClimbEnergyKwh} kWh on mountain ascents`,
            `Downhill regen recovery: -${evRegenPotentialKwh} kWh restored to battery`,
            `Net elevation consumption: +${evNetKwh} kWh total delta`,
            'Zero atmospheric power loss (EV motor is unaffected by thin mountain air)',
          ],
        };

      case 'suv_4wd':
        return {
          suitability: 'High Capability (Optimal for Mountain Passes)',
          ratingColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
          engineLoad: 'High Torque Reserve (Low Gear Crawl available)',
          gearAdvice: hasExtreme ? 'Engage 4L / 1st Low on extreme loose hairpin grades' : '4H / 2nd gear on steep inclines',
          coolingWarning: 'Adequate cooling capacity; check transmission fluid temperature on loaded climbs',
          altitudePowerLoss: altitudePowerLossPercent,
          brakeFadeRisk: 'Low to Moderate with Hill Descent Control (HDC)',
          brakeAdvice: 'Activate Hill Descent Control (HDC) on steep downhill gravel passes',
          evClimbEnergyKwh: 0,
          evRegenRecoveredKwh: 0,
          evNetElevationDeltaKwh: 0,
          checklist: [
            `Engine loses ~${altitudePowerLossPercent}% combustion power at ${stats.maxElevation}m elevation`,
            'Engage 4WD High for hairpin traction on wet or gravel slopes',
            'Inspect front & rear differential breather caps before river crossings',
            'Test Hill Descent Control (HDC) system before descending',
          ],
        };

      case 'motorbike':
        return {
          suitability: hasExtreme ? 'Demanding (Hairpin Traction Risk)' : 'Agile Mountain Touring',
          ratingColor: hasExtreme ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-sky-400 border-sky-500/40 bg-sky-500/10',
          engineLoad: 'High Revs Required (Downshift to 1st/2nd)',
          gearAdvice: 'Keep RPM in peak torque band (1st-2nd on steep hairpin switchbacks)',
          coolingWarning: 'Air-cooled singles may overheat during slow uphill behind heavy trucks',
          altitudePowerLoss: Math.round(altitudePowerLossPercent * 1.2),
          brakeFadeRisk: 'Moderate (Rear drum/disc heating on long descent)',
          brakeAdvice: 'Balance 70% front brake / 30% rear brake with crisp downshifting rev matches',
          evClimbEnergyKwh: 0,
          evRegenRecoveredKwh: 0,
          evNetElevationDeltaKwh: 0,
          checklist: [
            `Single-cylinder bikes feel ~${Math.round(altitudePowerLossPercent * 1.2)}% power drop at high passes`,
            'Watch for loose gravel and diesel spills on steep uphill hairpins',
            'Check brake lever free-play and pad wear before mountain descent',
            'Dress in layers: temperature drops ~6.5°C per 1,000m elevation gain',
          ],
        };

      case 'bus_truck':
        return {
          suitability: hasExtreme ? 'Severe Hazard (Mandatory Caution)' : 'High Mechanical Strain',
          ratingColor: hasExtreme ? 'text-red-400 border-red-500/50 bg-red-500/20' : 'text-rose-400 border-rose-500/40 bg-rose-500/10',
          engineLoad: 'Severe (Heavy GVW Crawl <20 km/h)',
          gearAdvice: 'Mandatory Crawler 1st / 2nd gear. Never attempt high gears on >7% grade',
          coolingWarning: 'Radiator boilover hazard in slow uphill traffic jams',
          altitudePowerLoss: altitudePowerLossPercent,
          brakeFadeRisk: 'CRITICAL RUNAWAY DANGER (Fatal Brake Fade Risk)',
          brakeAdvice: 'MANDATORY EXHAUST BRAKE / RETARDER ENGAGEMENT. Continuous footbraking causes thermal brake failure. Speed limit 25 km/h on descents.',
          evClimbEnergyKwh: 0,
          evRegenRecoveredKwh: 0,
          evNetElevationDeltaKwh: 0,
          checklist: [
            'Test pneumatic air brake pressure seals and drain water from air tanks',
            'Mandatory wheel chocks required when stopping on steep incline sections',
            `Sustained descent of -${stats.totalDescent}m: pull over at cooling bays if drums smoke`,
            'Confirm exhaust brake (Jake brake) solenoid operation before departure',
          ],
        };

      case 'car':
      default:
        return {
          suitability: hasExtreme ? 'Moderate-High Stress' : hasSteep ? 'Normal Mountain Driving' : 'Easy Highway',
          ratingColor: hasExtreme ? 'text-rose-400 border-rose-500/40 bg-rose-500/10' : 'text-sky-400 border-sky-500/40 bg-sky-500/10',
          engineLoad: hasExtreme ? 'High (Downshift to 1st/2nd)' : 'Moderate',
          gearAdvice: hasSteep ? 'Shift to 2nd or Low (L) gear on switchback ascents' : 'Standard D / 3rd-4th',
          coolingWarning: 'Turn off air conditioning on steep climbs to prevent engine coolant boilover',
          altitudePowerLoss: altitudePowerLossPercent,
          brakeFadeRisk: stats.steepDescentDistanceKm > 4 ? 'High Brake Fluid Boil Risk' : 'Moderate',
          brakeAdvice: 'Shift to 2nd / Low (L) gear on descents to utilize engine braking. Avoid continuous footbrake pressure to prevent pad glazing.',
          evClimbEnergyKwh: 0,
          evRegenRecoveredKwh: 0,
          evNetElevationDeltaKwh: 0,
          checklist: [
            `Naturally aspirated engines lose ~${altitudePowerLossPercent}% power at ${stats.maxElevation}m altitude`,
            'Inspect brake pads and verify DOT 3/4 brake fluid boiling point',
            'Turn off AC when ascending steep mountain passes to maximize engine cooling',
            'Check coolant level and expansion tank cap pressure seal',
          ],
        };
    }
  }, [activeVehicle, stats]);

  // Custom Dot Renderer for Recharts Line:
  // SPECIFIC REQUIREMENT: Specifically marking points with steep gradients (e.g., >8% incline) in RED
  const renderCustomDot = useCallback(
    (dotProps: any) => {
      const { cx, cy, payload, index } = dotProps;
      if (!payload || cx == null || cy == null || isNaN(cx) || isNaN(cy)) return null;

      const isSteep = payload.grade >= customSteepThreshold; // >8% incline (or custom threshold)
      const isExtreme = payload.grade >= 10.0;
      const isSummit = payload.isSummit && showSummits;

      // Filter check
      if (gradientFilter === 'steep' && !isSteep) return null;
      if (gradientFilter === 'extreme' && !isExtreme) return null;

      // 1. Specifically Mark Steep Gradient Points in RED
      if (isSteep) {
        return (
          <g key={`steep-dot-${index}-${payload.distance}`} className="cursor-pointer">
            {/* Outer red glowing aura */}
            <circle
              cx={cx}
              cy={cy}
              r={isExtreme ? 9 : 7}
              fill="#ef4444"
              fillOpacity={0.25}
              stroke="#ef4444"
              strokeWidth={1.5}
            />
            {/* Inner red pinpoint */}
            <circle
              cx={cx}
              cy={cy}
              r={isExtreme ? 5 : 4}
              fill={isExtreme ? '#dc2626' : '#ef4444'}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          </g>
        );
      }

      // 2. Summit Pass Milestone Pins
      if (isSummit) {
        return (
          <g key={`summit-dot-${index}`} className="cursor-pointer">
            <circle cx={cx} cy={cy} r={8} fill="#f59e0b" fillOpacity={0.3} />
            <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
          </g>
        );
      }

      return null;
    },
    [customSteepThreshold, gradientFilter, showSummits]
  );

  // Active point for the floating telemetry / inspector
  const activeInspectionPoint = hoveredPoint || selectedPoint;

  // Custom Tooltip for Recharts
  const CustomElevationTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt: ElevationProfilePoint = payload[0].payload;
    if (!pt) return null;

    const isSteep = pt.grade >= customSteepThreshold;
    const isExtreme = pt.grade >= 10.0;
    const isSteepDown = pt.grade <= -customSteepThreshold;

    return (
      <div className="bg-slate-900/95 border border-slate-700 shadow-2xl rounded-xl p-3 text-xs backdrop-blur-md max-w-xs space-y-2 z-50 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
          <span className="font-bold text-sky-400 flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>KM {pt.distance} from Start</span>
          </span>

          {/* Steep Gradient Incline Marked in Red */}
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
              isExtreme
                ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                : isSteep
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : isSteepDown
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                : pt.grade > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            {pt.grade > 0 ? `+${pt.grade}% Incline` : pt.grade < 0 ? `${pt.grade}% Descent` : '0.0% Level'}
          </span>
        </div>

        {/* Highlight Banner if Steep Grade (>8% Incline) */}
        {isSteep && (
          <div className="bg-red-950/40 border border-red-500/50 rounded-lg p-2 text-red-200 flex items-start space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <span className="font-extrabold text-red-300">
                Steep Gradient ({pt.grade}% &gt; {customSteepThreshold}%):
              </span>{' '}
              High engine load and rollback risk. Shift to 1st/2nd gear.
            </div>
          </div>
        )}

        {isSteepDown && (
          <div className="bg-orange-950/40 border border-orange-500/40 rounded-lg p-2 text-orange-200 flex items-start space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <span className="font-extrabold text-orange-300">
                Steep Descent ({pt.grade}%):
              </span>{' '}
              High brake fade risk. Use low-gear engine braking; avoid continuous footbraking.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800">
          <div>
            <div className="text-slate-400 text-[10px]">Altitude ASL</div>
            <div className="text-white font-black text-sm font-mono mt-0.5">
              {pt.elevation.toLocaleString()}m
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px]">Remaining</div>
            <div className="text-cyan-300 font-black text-sm font-mono mt-0.5">
              {Math.max(0, Math.round(((route?.totalDistanceKm || 0) - pt.distance) * 10) / 10)} km
            </div>
          </div>
        </div>

        {pt.landmarkLabel && (
          <div className="text-[10px] font-bold text-amber-300 flex items-center space-x-1">
            <span>⛰️ {pt.landmarkLabel}</span>
          </div>
        )}

        <div className="text-[11px] text-slate-300 leading-snug line-clamp-2">{pt.instruction}</div>

        <div className="text-[9px] text-slate-500 font-mono">
          Coordinates: {pt.lat.toFixed(4)}°N, {pt.lng.toFixed(4)}°E
        </div>
      </div>
    );
  };

  if (!route) {
    return null;
  }

  // Total highway corridor distance in km
  const totalDistanceKm =
    route.totalDistanceKm ||
    (elevationPoints.length > 0 ? elevationPoints[elevationPoints.length - 1].distance : 10);

  // Standard Y-axis bounds
  const minElevVal = Math.max(0, Math.floor(stats.minElevation / 100) * 100 - 100);
  const maxElevVal = Math.ceil(stats.maxElevation / 100) * 100 + 150;

  // Zoom Handlers
  const handleResetZoom = useCallback(() => {
    setZoomDomain(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, []);

  const handleZoomToSection = useCallback(
    (startKm: number, endKm: number) => {
      const min = Math.max(0, Math.min(startKm, endKm));
      const max = Math.min(totalDistanceKm, Math.max(startKm, endKm));
      const span = max - min;
      const pad = span < 3 ? 0.8 : span * 0.05;
      const zStart = Math.max(0, Math.round((min - pad) * 10) / 10);
      const zEnd = Math.min(totalDistanceKm, Math.round((max + pad) * 10) / 10);
      setZoomDomain([zStart, zEnd]);
    },
    [totalDistanceKm]
  );

  const handleZoomIn = useCallback(() => {
    const currentStart = zoomDomain ? zoomDomain[0] : 0;
    const currentEnd = zoomDomain ? zoomDomain[1] : totalDistanceKm;
    const currentSpan = currentEnd - currentStart;
    if (currentSpan <= 2) return;
    const center = (currentStart + currentEnd) / 2;
    const newSpan = currentSpan * 0.65; // 35% zoom in
    const newStart = Math.max(0, Math.round((center - newSpan / 2) * 10) / 10);
    const newEnd = Math.min(totalDistanceKm, Math.round((center + newSpan / 2) * 10) / 10);
    setZoomDomain([newStart, newEnd]);
  }, [zoomDomain, totalDistanceKm]);

  const handleZoomOut = useCallback(() => {
    if (!zoomDomain) return;
    const currentStart = zoomDomain[0];
    const currentEnd = zoomDomain[1];
    const currentSpan = currentEnd - currentStart;
    const center = (currentStart + currentEnd) / 2;
    const newSpan = currentSpan * 1.5; // 50% zoom out
    const newStart = Math.max(0, Math.round((center - newSpan / 2) * 10) / 10);
    const newEnd = Math.min(totalDistanceKm, Math.round((center + newSpan / 2) * 10) / 10);
    if (newStart <= 0 && newEnd >= totalDistanceKm) {
      setZoomDomain(null);
    } else {
      setZoomDomain([newStart, newEnd]);
    }
  }, [zoomDomain, totalDistanceKm]);

  const handleZoomToPeakPass = useCallback(() => {
    const peakKm = stats.peakSummitKm || totalDistanceKm / 2;
    const start = Math.max(0, Math.round((peakKm - 7) * 10) / 10);
    const end = Math.min(totalDistanceKm, Math.round((peakKm + 7) * 10) / 10);
    setZoomDomain([start, end]);
  }, [stats.peakSummitKm, totalDistanceKm]);

  const handleZoomToSteepestZone = useCallback(() => {
    if (steepHazardZones.length > 0) {
      const sorted = [...steepHazardZones].sort((a, b) => b.maxGrade - a.maxGrade);
      const target = sorted[0];
      handleZoomToSection(target.startKm, target.endKm);
    } else {
      const steepPts = elevationPoints.filter((p) => p.isSteepIncline);
      if (steepPts.length > 0) {
        const topPt = [...steepPts].sort((a, b) => b.grade - a.grade)[0];
        handleZoomToSection(topPt.distance - 4, topPt.distance + 4);
      }
    }
  }, [steepHazardZones, elevationPoints, handleZoomToSection]);

  // Telemetry & metrics for the active zoomed section
  const zoomedData = useMemo(() => {
    if (!zoomDomain) {
      return {
        isZoomed: false,
        startKm: 0,
        endKm: totalDistanceKm,
        minElev: minElevVal,
        maxElev: maxElevVal,
        sectionLengthKm: totalDistanceKm,
        steepCount: steepPointsCount,
        maxGrade: stats.maxGrade,
        ascent: stats.totalAscent,
        descent: stats.totalDescent,
      };
    }

    const [zStart, zEnd] = zoomDomain;
    const inRange = elevationPoints.filter((p) => p.distance >= zStart && p.distance <= zEnd);

    if (inRange.length === 0) {
      return {
        isZoomed: true,
        startKm: zStart,
        endKm: zEnd,
        minElev: minElevVal,
        maxElev: maxElevVal,
        sectionLengthKm: Math.round((zEnd - zStart) * 10) / 10,
        steepCount: 0,
        maxGrade: 0,
        ascent: 0,
        descent: 0,
      };
    }

    const localMin = Math.min(...inRange.map((p) => p.elevation));
    const localMax = Math.max(...inRange.map((p) => p.elevation));
    const localMaxGrade = Math.max(...inRange.map((p) => p.grade));
    const localSteepCount = inRange.filter((p) => p.isSteepIncline).length;

    let localAscent = 0;
    let localDescent = 0;
    for (let i = 1; i < inRange.length; i++) {
      const diff = inRange[i].elevation - inRange[i - 1].elevation;
      if (diff > 0) localAscent += diff;
      else localDescent += Math.abs(diff);
    }

    // Adaptive Y-axis scale with padding for the zoomed mountain window
    const paddedMinY = Math.max(0, Math.floor(localMin / 50) * 50 - 50);
    const paddedMaxY = Math.ceil(localMax / 50) * 50 + 60;

    return {
      isZoomed: true,
      startKm: zStart,
      endKm: zEnd,
      minElev: paddedMinY,
      maxElev: paddedMaxY,
      sectionLengthKm: Math.round((zEnd - zStart) * 10) / 10,
      steepCount: localSteepCount,
      maxGrade: localMaxGrade,
      ascent: Math.round(localAscent),
      descent: Math.round(localDescent),
    };
  }, [
    zoomDomain,
    elevationPoints,
    minElevVal,
    maxElevVal,
    totalDistanceKm,
    steepPointsCount,
    stats,
  ]);

  return (
    <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 space-y-3.5 sm:space-y-4 shadow-xl text-slate-100 max-w-full overflow-hidden">
      {/* Header Bar with Altitude, Steep Warning, and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Mountain className="w-5 h-5 text-purple-400 shrink-0" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Route Elevation Profile &amp; Mountain Gradients
            </h3>
            {steepPointsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>
                  {steepPointsCount} Points &gt;{customSteepThreshold}% Grade in Red
                </span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Rendered with Recharts from active corridor coordinates • Altitude vs Chainage Distance
          </p>
        </div>

        {/* Action / View Toggles */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {/* Steep Threshold Selector */}
          <div className="flex items-center bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 space-x-1 text-[11px]">
            <Sliders className="w-3 h-3 text-red-400" />
            <span className="text-slate-400 font-semibold">Steep Incline:</span>
            <select
              value={customSteepThreshold}
              onChange={(e) => setCustomSteepThreshold(Number(e.target.value))}
              aria-label="Steep incline grade threshold"
              className="bg-slate-950 text-red-300 font-bold border border-red-500/30 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-red-500"
            >
              <option value={7.0}>&gt;7% Grade</option>
              <option value={8.0}>&gt;8% Grade (Standard)</option>
              <option value={9.0}>&gt;9% Grade</option>
              <option value={10.0}>&gt;10% Extreme</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowSummits(!showSummits)}
            className={`px-2.5 py-1.5 rounded-lg border font-semibold text-[11px] flex items-center space-x-1 transition ${
              showSummits
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle Summit & Valley Milestone Pins"
          >
            <span>⛰️ Passes</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAltitudeZones(!showAltitudeZones)}
            className={`px-2.5 py-1.5 rounded-lg border font-semibold text-[11px] flex items-center space-x-1 transition ${
              showAltitudeZones
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
            title="Show Altitude Reference Lines"
          >
            <span>🌐 Zones</span>
          </button>

          {/* Gradient Severity Filter */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setGradientFilter('all')}
              className={`px-2 py-1 rounded font-semibold transition ${
                gradientFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show all slopes"
            >
              All
            </button>
            <button
              onClick={() => setGradientFilter('steep')}
              className={`px-2 py-1 rounded font-semibold transition flex items-center space-x-1 ${
                gradientFilter === 'steep'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Highlight points >${customSteepThreshold}% incline in red`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>&gt;{customSteepThreshold}% (Red)</span>
            </button>
            <button
              onClick={() => setGradientFilter('extreme')}
              className={`px-2 py-1 rounded font-semibold transition flex items-center space-x-1 ${
                gradientFilter === 'extreme'
                  ? 'bg-red-700/30 text-red-200 border border-red-600/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Filter to extreme slopes (>10%)"
            >
              <span>&gt;10%</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpandedView(!isExpandedView)}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
            title={isExpandedView ? 'Standard Chart Height' : 'Expand Chart Height'}
          >
            {isExpandedView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 4-Stat Elevation Metric Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Ascent (Climb)</span>
          </div>
          <div className="text-lg font-black text-emerald-400 mt-1 font-display">
            +{stats.totalAscent.toLocaleString()} <span className="text-xs font-normal text-slate-400">m</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg Grade: {stats.avgGrade}%</div>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium flex items-center space-x-1">
            <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>Total Descent (Downhill)</span>
          </div>
          <div className="text-lg font-black text-cyan-400 mt-1 font-display">
            -{stats.totalDescent.toLocaleString()} <span className="text-xs font-normal text-slate-400">m</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Max Descent: {stats.minGrade}%</div>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium flex items-center space-x-1">
            <Mountain className="w-3.5 h-3.5 text-amber-400" />
            <span>Peak Summit Altitude</span>
          </div>
          <div className="text-lg font-black text-amber-400 mt-1 font-display">
            {stats.maxElevation.toLocaleString()} <span className="text-xs font-normal text-slate-400">m ASL</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {stats.peakSummitName} (KM {stats.peakSummitKm})
          </div>
        </div>

        {/* Steep Incline Metric Card */}
        <div className="bg-slate-900/80 p-3 rounded-xl border border-red-500/30">
          <div className="text-[11px] text-red-300 font-medium flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Steep Incline (&gt;{customSteepThreshold}%)</span>
          </div>
          <div className="text-lg font-black text-red-400 mt-1 font-display flex items-baseline space-x-1.5">
            <span>{stats.steepDistanceKm}</span>
            <span className="text-xs font-normal text-slate-400">km ({steepPointsCount} pts)</span>
          </div>
          <div className="text-[10px] text-red-400/80 mt-0.5 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span>Marked in RED on chart</span>
          </div>
        </div>
      </div>

      {/* Chart Legend, Zoom Toolbar & Drag-to-Zoom Controls */}
      <div className="space-y-2 pt-1 border-t border-slate-900">
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          {/* Elevation Indicators & Steep Red Point Legend */}
          <div className="flex items-center space-x-3 flex-wrap">
            <span className="flex items-center space-x-1.5 text-slate-300">
              <span className="w-3 h-1.5 rounded-full bg-sky-400" />
              <span>Elevation Profile (m ASL)</span>
            </span>
            <span className="flex items-center space-x-1.5 text-red-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-400/40 animate-pulse" />
              <span>🔴 Steep Gradients (&gt;{customSteepThreshold}% Incline in Red)</span>
            </span>
            <span className="flex items-center space-x-1.5 text-amber-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>⛰️ Summit Pass</span>
            </span>
          </div>

          {/* Drag Selection & Zoom Helper Notice */}
          <div className="flex items-center space-x-2 text-[11px]">
            <span className="text-sky-300/90 font-medium hidden sm:inline-flex items-center space-x-1">
              <ScanLine className="w-3.5 h-3.5 text-sky-400" />
              <span>Click &amp; drag on chart to zoom section</span>
            </span>
          </div>
        </div>

        {/* Dedicated Interactive Zoom Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-xs">
          {/* Left: Zoom in / Zoom out / Presets */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-slate-400 font-semibold flex items-center space-x-1 mr-1 text-[11px]">
              <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
              <span>Zoom Section:</span>
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-semibold flex items-center space-x-1 text-[11px] transition shadow-sm"
              title="Zoom in 35%"
            >
              <ZoomIn className="w-3 h-3 text-sky-400" />
              <span>In (+)</span>
            </button>

            <button
              type="button"
              onClick={handleZoomOut}
              disabled={!zoomDomain}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center space-x-1 text-[11px] transition ${
                zoomDomain
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 shadow-sm'
                  : 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed'
              }`}
              title="Zoom out 50%"
            >
              <ZoomOut className="w-3 h-3 text-slate-400" />
              <span>Out (-)</span>
            </button>

            {/* Quick Section Jump Presets */}
            <button
              type="button"
              onClick={handleResetZoom}
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition ${
                !zoomDomain
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Show entire route profile (100%)"
            >
              100% Full
            </button>

            {stats.peakSummitKm > 0 && (
              <button
                type="button"
                onClick={handleZoomToPeakPass}
                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition flex items-center space-x-1"
                title={`Zoom to Summit Pass at ${stats.maxElevation}m (KM ${stats.peakSummitKm})`}
              >
                <span>⛰️ Summit Zone</span>
              </button>
            )}

            {(steepHazardZones.length > 0 || steepPointsCount > 0) && (
              <button
                type="button"
                onClick={handleZoomToSteepestZone}
                className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-semibold transition flex items-center space-x-1"
                title="Zoom directly into the steepest gradient mountain sector"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>⚠️ Steepest Sector</span>
              </button>
            )}
          </div>

          {/* Right: Brush Navigator Toggle & Active State */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowBrush(!showBrush)}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center space-x-1 text-[11px] transition ${
                showBrush
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Toggle interactive corridor mini-map slider at bottom"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>{showBrush ? 'Hide Slider' : 'Corridor Slider'}</span>
            </button>

            {zoomDomain && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold flex items-center space-x-1 text-[11px] transition animate-pulse"
                title="Reset zoom to full route"
              >
                <RotateCcw className="w-3 h-3 text-rose-400" />
                <span>Reset Zoom</span>
              </button>
            )}
          </div>
        </div>

        {/* Zoomed Section Telemetry & Action Banner */}
        {zoomDomain && (
          <div className="bg-sky-950/40 border border-sky-500/40 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs animate-fadeIn shadow-lg">
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-sky-300">
                <ZoomIn className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Zoomed Section:</span>
                <span className="font-mono bg-sky-900/70 px-2 py-0.5 rounded border border-sky-500/40 text-white font-bold">
                  KM {zoomDomain[0]} ➔ KM {zoomDomain[1]} ({zoomedData.sectionLengthKm} km)
                </span>
              </div>

              <div className="text-slate-300 text-[11px] flex items-center space-x-2 flex-wrap">
                <span>
                  Altitude:{' '}
                  <strong className="text-white font-mono">{zoomedData.minElev}m</strong> –{' '}
                  <strong className="text-white font-mono">{zoomedData.maxElev}m</strong>
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span>
                  Climb: <strong className="text-emerald-400 font-mono">+{zoomedData.ascent}m</strong>
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span>
                  Max Grade: <strong className="text-amber-400 font-mono">{zoomedData.maxGrade}%</strong>
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-red-300 font-semibold">
                  Steep Incline Points: <strong className="font-mono text-red-400">{zoomedData.steepCount}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {onViewOnMap && (
                <button
                  type="button"
                  onClick={() => {
                    const inRange = elevationPoints.filter(
                      (p) => p.distance >= zoomDomain[0] && p.distance <= zoomDomain[1]
                    );
                    const midPt = inRange[Math.floor(inRange.length / 2)];
                    if (midPt) {
                      onViewOnMap({
                        lat: midPt.lat,
                        lng: midPt.lng,
                        title: `Corridor KM ${zoomDomain[0]}–${zoomDomain[1]}: ${zoomedData.sectionLengthKm}km (${zoomedData.steepCount} steep points)`,
                        zoom: zoomedData.sectionLengthKm < 20 ? 13 : zoomedData.sectionLengthKm < 50 ? 11 : 10,
                      });
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-semibold transition flex items-center space-x-1 text-[11px]"
                  title="Center interactive map onto this corridor section"
                >
                  <Navigation className="w-3 h-3 text-sky-400" />
                  <span>Map Sector</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition flex items-center space-x-1 text-[11px]"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                <span>Full Route</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECHARTS Dynamic Elevation Chart Container */}
      <div
        id="elevation-recharts-container"
        className={`relative w-full overflow-hidden bg-slate-950/80 rounded-xl border border-slate-900 p-2 transition-all duration-300 select-none min-h-[260px] ${
          isExpandedView ? 'h-96' : 'h-64 sm:h-72'
        }`}
      >
        <ResponsiveContainer width="100%" height="100%" minHeight={250}>
          <ComposedChart
            data={elevationPoints}
            margin={{ top: 20, right: 30, left: 10, bottom: showBrush ? 10 : 20 }}
            onMouseDown={(state: any) => {
              if (state && state.activeLabel != null) {
                const val = Number(state.activeLabel);
                if (!isNaN(val)) {
                  setRefAreaLeft(val);
                  setRefAreaRight(val);
                  isDraggingZoomRef.current = false;
                }
              }
            }}
            onMouseMove={(state: any) => {
              if (refAreaLeft != null && state && state.activeLabel != null) {
                const val = Number(state.activeLabel);
                if (!isNaN(val)) {
                  setRefAreaRight(val);
                  if (Math.abs(val - refAreaLeft) > 0.3) {
                    isDraggingZoomRef.current = true;
                  }
                }
              }
              if (state && state.activePayload && state.activePayload[0]) {
                setHoveredPoint(state.activePayload[0].payload);
              }
            }}
            onMouseUp={() => {
              if (refAreaLeft != null && refAreaRight != null) {
                const left = Math.min(refAreaLeft, refAreaRight);
                const right = Math.max(refAreaLeft, refAreaRight);
                if (right - left >= 0.5) {
                  const start = Math.max(0, Math.round(left * 10) / 10);
                  const end = Math.min(totalDistanceKm, Math.round(right * 10) / 10);
                  setZoomDomain([start, end]);
                }
              }
              setRefAreaLeft(null);
              setRefAreaRight(null);
              setTimeout(() => {
                isDraggingZoomRef.current = false;
              }, 100);
            }}
            onClick={(state: any) => {
              if (isDraggingZoomRef.current) return;
              if (state && state.activePayload && state.activePayload[0]) {
                setSelectedPoint(state.activePayload[0].payload);
                const pt = state.activePayload[0].payload;
                if (onViewOnMap && pt.lat && pt.lng) {
                  onViewOnMap({
                    lat: pt.lat,
                    lng: pt.lng,
                    title: `${pt.landmarkLabel || 'Elevation Point'}: ${pt.elevation}m ASL (${pt.grade > 0 ? '+' : ''}${pt.grade}%)`,
                    zoom: 13,
                  });
                }
              }
            }}
            onMouseLeave={() => {
              setHoveredPoint(null);
              if (refAreaLeft != null) {
                setRefAreaLeft(null);
                setRefAreaRight(null);
              }
            }}
          >
            <defs>
              {/* Rich Mountain Topography Gradient */}
              <linearGradient id="rechartsElevationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                <stop offset="45%" stopColor="#0284c7" stopOpacity={0.25} />
                <stop offset="85%" stopColor="#0369a1" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#0f172a" stopOpacity={0.01} />
              </linearGradient>

              {/* Glowing Red Pattern for Steep Gradient Hazard */}
              <linearGradient id="rechartsSteepInclineGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

            <XAxis
              dataKey="distance"
              type="number"
              domain={zoomDomain ? zoomDomain : [0, totalDistanceKm]}
              allowDataOverflow={true}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => `${Math.round(v * 10) / 10} km`}
              label={{
                value: zoomDomain
                  ? `Corridor Section: KM ${zoomDomain[0]} – ${zoomDomain[1]} (${zoomedData.sectionLengthKm} km)`
                  : 'Corridor Distance (km)',
                position: 'insideBottom',
                offset: -12,
                fill: '#64748b',
                fontSize: 10,
              }}
            />

            <YAxis
              domain={[zoomedData.minElev, zoomedData.maxElev]}
              allowDataOverflow={true}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => `${v}m`}
              label={{
                value: 'Altitude (m ASL)',
                angle: -90,
                position: 'insideLeft',
                offset: 5,
                fill: '#64748b',
                fontSize: 10,
              }}
            />

            <Tooltip content={<CustomElevationTooltip />} isAnimationActive={false} />

            {/* Altitude Reference Lines (Render only if within zoomed range) */}
            {showAltitudeZones &&
              1500 >= zoomedData.minElev &&
              1500 <= zoomedData.maxElev && (
                <ReferenceLine
                  y={1500}
                  stroke="#a855f7"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: 'High Pass (1,500m)',
                    fill: '#c084fc',
                    fontSize: 9,
                    position: 'insideTopRight',
                  }}
                />
              )}

            {showAltitudeZones &&
              500 >= zoomedData.minElev &&
              500 <= zoomedData.maxElev && (
                <ReferenceLine
                  y={500}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: 'Lowland Plains (500m)',
                    fill: '#34d399',
                    fontSize: 9,
                    position: 'insideBottomRight',
                  }}
                />
              )}

            {/* Peak Summit Reference Line */}
            {showSummits &&
              stats.maxElevation >= zoomedData.minElev &&
              stats.maxElevation <= zoomedData.maxElev && (
                <ReferenceLine
                  y={stats.maxElevation}
                  stroke="#f59e0b"
                  strokeDasharray="2 2"
                  strokeWidth={1.5}
                  label={{
                    value: `Peak: ${stats.maxElevation}m`,
                    fill: '#fbbf24',
                    fontSize: 10,
                    position: 'insideTopLeft',
                  }}
                />
              )}

            {/* Selection Drag Zooming Area Highlight */}
            {refAreaLeft != null && refAreaRight != null && (
              <ReferenceArea
                {...({
                  x1: refAreaLeft,
                  x2: refAreaRight,
                  stroke: '#38bdf8',
                  strokeOpacity: 0.9,
                  strokeWidth: 1.5,
                  fill: '#38bdf8',
                  fillOpacity: 0.25,
                } as any)}
              />
            )}

            {/* Base Mountain Area */}
            <Area
              type="monotone"
              dataKey="elevation"
              stroke="#38bdf8"
              strokeWidth={2}
              fill="url(#rechartsElevationGradient)"
              allowDataOverflow={true}
              isAnimationActive={false}
            />

            {/* Dedicated Line with Custom Dot Renderer:
                SPECIFICALLY MARKING POINTS WITH STEEP GRADIENTS (>8% INCLINE) IN RED */}
            <Line
              type="monotone"
              dataKey="elevation"
              stroke="#38bdf8"
              strokeWidth={2.2}
              dot={renderCustomDot}
              allowDataOverflow={true}
              activeDot={{
                r: 7,
                fill: '#38bdf8',
                stroke: '#ffffff',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />

            {/* Interactive Brush Corridor Slider */}
            {showBrush && (
              <Brush
                dataKey="distance"
                height={28}
                stroke="#38bdf8"
                fill="#0f172a"
                travellerWidth={10}
                tickFormatter={(v) => `${Math.round(v)}k`}
                onChange={(range) => {
                  if (range && range.startIndex != null && range.endIndex != null) {
                    const p1 = elevationPoints[range.startIndex];
                    const p2 = elevationPoints[range.endIndex];
                    if (p1 && p2) {
                      const s = Math.min(p1.distance, p2.distance);
                      const e = Math.max(p1.distance, p2.distance);
                      if (e - s >= 0.5) {
                        setZoomDomain([Math.round(s * 10) / 10, Math.round(e * 10) / 10]);
                      }
                    }
                  }
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Floating Telemetry Inspector Card (Displays on click or hover) */}
        {activeInspectionPoint && (
          <div className="absolute top-3 right-4 max-w-xs bg-slate-900/95 border border-sky-500/50 rounded-xl p-3 shadow-2xl text-xs space-y-2 backdrop-blur-md z-10 animate-fadeIn pointer-events-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-sky-400 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>KM {activeInspectionPoint.distance} from Origin</span>
              </span>
              <span
                className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  activeInspectionPoint.grade >= 10
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : activeInspectionPoint.grade >= customSteepThreshold
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : activeInspectionPoint.grade <= -customSteepThreshold
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : activeInspectionPoint.grade > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {activeInspectionPoint.grade > 0
                  ? `+${activeInspectionPoint.grade}% Incline`
                  : activeInspectionPoint.grade < 0
                  ? `${activeInspectionPoint.grade}% Descent`
                  : 'Level 0.0%'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <div>
                <div className="text-slate-400 text-[10px] font-semibold">Altitude ASL</div>
                <div className="text-white font-black text-sm font-mono mt-0.5">
                  {activeInspectionPoint.elevation.toLocaleString()}m
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] font-semibold">Remaining</div>
                <div className="text-cyan-300 font-black text-sm font-mono mt-0.5">
                  {Math.max(0, Math.round((route.totalDistanceKm - activeInspectionPoint.distance) * 10) / 10)} km
                </div>
              </div>
            </div>

            {activeInspectionPoint.landmarkLabel && (
              <div className="text-[10px] font-bold text-amber-300 flex items-center space-x-1">
                <span>⛰️ {activeInspectionPoint.landmarkLabel}</span>
              </div>
            )}

            <div className="text-[11px] text-slate-300 leading-snug line-clamp-2">
              {activeInspectionPoint.instruction}
            </div>

            {/* Vehicle Impact Note for this point */}
            <div className="text-[10px] bg-purple-950/30 border border-purple-800/40 p-2 rounded-lg text-purple-200">
              <span className="font-bold text-purple-300">Vehicle Action: </span>
              {activeInspectionPoint.grade >= customSteepThreshold ? (
                activeVehicle === 'electric_vehicle' ? (
                  <span>High kWh draw. Maintain smooth accelerator modulation.</span>
                ) : activeVehicle === 'bus_truck' ? (
                  <span>Extreme grade. Use 1st/2nd crawl gear.</span>
                ) : (
                  <span>Steep climb (&gt;{customSteepThreshold}%). Shift to 2nd/L gear; turn off AC if warm.</span>
                )
              ) : activeInspectionPoint.grade <= -customSteepThreshold ? (
                activeVehicle === 'electric_vehicle' ? (
                  <span>High regen recovery active. Battery is absorbing energy.</span>
                ) : activeVehicle === 'bus_truck' ? (
                  <span>Exhaust brake mandatory! Continuous footbraking causes fade.</span>
                ) : (
                  <span>Use engine braking (2nd gear). Do not ride brake pedal.</span>
                )
              ) : (
                <span>Cruising gradient. Standard powertrain load.</span>
              )}
            </div>

            {/* Sync to Map Button */}
            {onViewOnMap && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOnMap({
                    lat: activeInspectionPoint.lat,
                    lng: activeInspectionPoint.lng,
                    title: `${activeInspectionPoint.landmarkLabel || 'Route Point'}: ${activeInspectionPoint.elevation}m ASL`,
                    zoom: 13,
                  });
                }}
                className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1 shadow-sm"
              >
                <Navigation className="w-3 h-3" />
                <span>Focus Point on Map</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Altitude Distribution Ratio Bar */}
      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Altitude Terrain Distribution:</span>
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="flex items-center space-x-1 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Plains (&lt;500m): {altitudeZones.lowlandPercent}%</span>
            </span>
            <span className="flex items-center space-x-1 text-sky-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>Mid-Hills (500–1500m): {altitudeZones.midHillPercent}%</span>
            </span>
            <span className="flex items-center space-x-1 text-purple-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>High Passes (&gt;1500m): {altitudeZones.highPassPercent}%</span>
            </span>
          </div>
        </div>

        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${altitudeZones.lowlandPercent}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`Plains / Terai: ${altitudeZones.lowlandPercent}%`}
          />
          <div
            style={{ width: `${altitudeZones.midHillPercent}%` }}
            className="h-full bg-sky-500 transition-all duration-500"
            title={`Mid-Hills: ${altitudeZones.midHillPercent}%`}
          />
          <div
            style={{ width: `${altitudeZones.highPassPercent}%` }}
            className="h-full bg-purple-500 transition-all duration-500"
            title={`High Passes: ${altitudeZones.highPassPercent}%`}
          />
        </div>
      </div>

      {/* SECTION TABS: Vehicle Performance Impact vs Identified Steep Zones */}
      <div className="border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'performance'
                  ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Vehicle Performance Impact</span>
            </button>
            <button
              onClick={() => setActiveTab('hazard_zones')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'hazard_zones'
                  ? 'bg-red-600/30 text-red-200 border border-red-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>
                Steep Hazard Sectors ({steepHazardZones.length})
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Click chart point or hazard sector to inspect elevation &amp; synchronize map
          </div>
        </div>

        {/* TAB 1: VEHICLE PERFORMANCE IMPACT ANALYZER */}
        {activeTab === 'performance' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Vehicle Selector Pills */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                <span>Select Vehicle to Evaluate Mountain Gradient Strain:</span>
                <span className="text-[10px] text-purple-400">
                  Active Profile: {activeVehicle.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {VEHICLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = activeVehicle === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setActiveVehicle(opt.type)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500/60 shadow-md shadow-purple-950/40 ring-1 ring-purple-500/30'
                          : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-300' : 'text-slate-400'}`} />
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                        )}
                      </div>
                      <div className="mt-1.5">
                        <div className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {opt.label}
                        </div>
                        <div className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">
                          {opt.shortDesc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vehicle Suitability & Powertrain Stress Card */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-semibold">Terrain Suitability Rating:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${vehicleImpact.ratingColor}`}
                  >
                    {vehicleImpact.suitability}
                  </span>
                </div>

                {vehicleImpact.altitudePowerLoss > 0 && (
                  <div className="text-[11px] text-amber-400 flex items-center space-x-1">
                    <Flame className="w-3.5 h-3.5" />
                    <span>
                      ~{vehicleImpact.altitudePowerLoss}% combustion air power loss at {stats.maxElevation}m peak
                    </span>
                  </div>
                )}
              </div>

              {/* Specific Engineering Vectors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Engine & Gear Dynamics */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center space-x-2 text-xs font-bold text-white">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <span>Engine &amp; Climbing Transmission</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    <strong className="text-emerald-300">Gear Recommendation: </strong>
                    {vehicleImpact.gearAdvice}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <strong className="text-slate-300">Thermal Load: </strong>
                    {vehicleImpact.coolingWarning}
                  </div>
                </div>

                {/* 2. Downhill Braking & Thermal Fade Risk */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center space-x-2 text-xs font-bold text-white">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Downhill Braking &amp; Thermal Fade</span>
                  </div>
                  <div className="text-[11px] text-rose-300 font-semibold">
                    Risk Level: {vehicleImpact.brakeFadeRisk}
                  </div>
                  <div className="text-[11px] text-slate-300">{vehicleImpact.brakeAdvice}</div>
                </div>
              </div>

              {/* EV Energy Dynamics (Show if EV) */}
              {activeVehicle === 'electric_vehicle' && (
                <div className="bg-cyan-950/30 border border-cyan-800/40 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>EV Elevation Potential Energy Balance</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      Net Cost: +{vehicleImpact.evNetElevationDeltaKwh} kWh
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Ascent Consumption</div>
                      <div className="text-sm font-bold text-rose-400 mt-0.5 font-mono">
                        +{vehicleImpact.evClimbEnergyKwh} kWh
                      </div>
                    </div>
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Regen Recovery</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5 font-mono">
                        -{vehicleImpact.evRegenRecoveredKwh} kWh
                      </div>
                    </div>
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Net Elevation Delta</div>
                      <div className="text-sm font-bold text-cyan-300 mt-0.5 font-mono">
                        +{vehicleImpact.evNetElevationDeltaKwh} kWh
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actionable Driver Pre-Climb Checklist */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Key Driver Safety Directives for this Corridor:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-300">
                  {vehicleImpact.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2 bg-slate-950/60 p-2 rounded-lg border border-slate-900"
                    >
                      <span className="text-purple-400 font-bold shrink-0">•</span>
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IDENTIFIED STEEP GRADIENT HAZARD SECTORS */}
        {activeTab === 'hazard_zones' && (
          <div className="space-y-3 animate-fadeIn">
            {steepHazardZones.length === 0 ? (
              <div className="text-center py-8 bg-slate-900/50 border border-slate-800 rounded-2xl text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p>
                  No steep mountain grade sectors detected (&gt;{customSteepThreshold}%). Route has gentle or moderate highway slopes.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>
                    Detected {steepHazardZones.length} steep gradient hazard zones along your route:
                  </span>
                  <span className="text-[10px] text-red-400">
                    Click any sector to focus on map
                  </span>
                </div>

                {steepHazardZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-red-500/50 p-3.5 rounded-2xl shadow-lg transition space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            zone.severity === 'extreme'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {zone.severity} {zone.direction}
                        </span>
                        <h4 className="text-xs font-bold text-white">{zone.title}</h4>
                      </div>

                      <div className="flex items-center space-x-2 text-xs font-mono">
                        <span className="text-slate-400 font-sans text-[11px]">
                          KM {zone.startKm} ➔ {zone.endKm} ({zone.lengthKm} km)
                        </span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            zone.direction === 'climb'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          }`}
                        >
                          Max {zone.direction === 'climb' ? '+' : '-'}{zone.maxGrade}% (Avg {zone.avgGrade}%)
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-300 leading-snug">
                      <span className="text-purple-300 font-semibold">Vehicle Advice: </span>
                      {zone.vehicleAdvice}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                      <div>
                        Elev: {zone.startElevation}m ➔ {zone.endElevation}m ({zone.elevationDiff > 0 ? '+' : ''}
                        {zone.elevationDiff}m)
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleZoomToSection(zone.startKm, zone.endKm);
                            const chartEl = document.getElementById('elevation-recharts-container');
                            if (chartEl) {
                              chartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40 font-bold transition flex items-center space-x-1"
                          title="Zoom Recharts elevation profile to this specific mountain climb sector"
                        >
                          <ZoomIn className="w-3 h-3 text-sky-400" />
                          <span>Zoom Profile</span>
                        </button>

                        {onViewOnMap && (
                          <button
                            type="button"
                            onClick={() => {
                              onViewOnMap({
                                lat: zone.lat,
                                lng: zone.lng,
                                title: `${zone.title}: Max ${zone.maxGrade}% Grade`,
                                zoom: 13,
                              });
                            }}
                            className="px-2.5 py-1 rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 font-bold transition flex items-center space-x-1"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Focus Map</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Guidance & Elevation Reading Legend */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-900">
        <div className="flex items-center space-x-1.5 text-emerald-400">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            Hover over points on the Recharts curve to inspect steep gradients (&gt;{customSteepThreshold}%), altitude, and mechanical impact.
          </span>
        </div>
        <div className="text-slate-500 font-mono text-[10px]">
          Origin: {route.origin.elevationM}m • Destination: {route.destination.elevationM}m
        </div>
      </div>
    </div>
  );
};
