import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Mountain,
  Compass,
  Clock,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  X,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  Navigation,
  Crosshair,
  Flag,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { RoutePlanResult } from '../types';

interface ActiveRouteElevationCardProps {
  activeRoute: RoutePlanResult;
  onOpenPlanner: () => void;
  onClearRoute: () => void;
  onViewOnMap?: (target: { lat: number; lng: number; title: string; zoom?: number }) => void;
}

interface MiniElevationPoint {
  distance: number;
  elevation: number;
  grade: number;
  isSteep: boolean;
  lat: number;
  lng: number;
  landmark?: string;
  stepInstruction?: string;
}

/**
 * Animated SVG Navigation Progress Marker
 * Follows the elevation path curve to represent real-time navigation progress
 */
interface AnimatedMarkerProps {
  cx?: number;
  cy?: number;
  distance: number;
  elevation: number;
  grade: number;
  tiltAngle: number;
  progressPercent: number;
  isNavigating: boolean;
  landmark?: string;
  instruction?: string;
  chartBottomY?: number;
}

const AnimatedElevationProgressMarker: React.FC<AnimatedMarkerProps> = ({
  cx,
  cy,
  distance,
  elevation,
  grade,
  tiltAngle,
  progressPercent,
  isNavigating,
  landmark,
  chartBottomY = 155,
}) => {
  if (typeof cx !== 'number' || typeof cy !== 'number' || isNaN(cx) || isNaN(cy)) {
    return null;
  }

  // Ensure floating HUD stays within comfortable SVG viewport boundaries
  const clampedHudX = Math.max(56, Math.min(380, cx));
  const clampedHudY = Math.max(26, cy - 28);
  const isSteep = Math.abs(grade) >= 8.0;

  return (
    <g id="active-nav-elevation-marker" className="pointer-events-none select-none">
      <defs>
        {/* Glow drop shadow filter for marker */}
        <filter id="navPuckGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Headlight Cone Gradient */}
        <linearGradient id="navHeadlightBeam" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>

        {/* Vehicle Puck Gradient */}
        <linearGradient id="navPuckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {/* 1. Dotted Vertical Altitude Guide Line down to distance axis */}
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={chartBottomY}
        stroke="#38bdf8"
        strokeWidth={1.5}
        strokeDasharray="2,3"
        opacity={0.65}
      />

      {/* 2. Floating Telemetry HUD Badge above the marker */}
      <g transform={`translate(${clampedHudX}, ${clampedHudY})`}>
        {/* Sleek Dark Pill Container */}
        <rect
          x={-56}
          y={-22}
          width={112}
          height={22}
          rx={11}
          fill="#090d16"
          stroke={isNavigating ? '#38bdf8' : '#334155'}
          strokeWidth={1.2}
          filter="drop-shadow(0 3px 6px rgba(0,0,0,0.85))"
        />

        {/* Live GPS Navigation Pulse Status Indicator */}
        <circle
          cx={-44}
          cy={-11}
          r={3.5}
          fill={isNavigating ? '#10b981' : '#38bdf8'}
        >
          {isNavigating && (
            <animate
              attributeName="opacity"
              values="1;0.2;1"
              dur="1.2s"
              repeatCount="indefinite"
            />
          )}
        </circle>

        {/* Telemetry Text: Distance + Altitude */}
        <text
          x={-34}
          y={-7}
          fill="#f8fafc"
          fontSize={8.5}
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
        >
          KM {Math.round(distance * 10) / 10} • {Math.round(elevation)}m
        </text>

        {/* Slope Gradient Symbol */}
        <text
          x={42}
          y={-7}
          fill={isSteep ? '#ef4444' : grade > 0 ? '#38bdf8' : '#34d399'}
          fontSize={8}
          fontWeight="900"
        >
          {grade > 0 ? '▲' : '▼'}
        </text>
      </g>

      {/* 3. Concentric Radar Pulse Rings around current location */}
      <g transform={`translate(${cx}, ${cy})`}>
        {/* Outer Expanding Sonar Wave */}
        <circle
          r="8"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          className="animate-nav-ripple"
        >
          <animate
            attributeName="r"
            values="8;24"
            dur="1.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.9;0"
            dur="1.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values="2.5;0.5"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Secondary Delayed Ripple */}
        <circle
          r="6"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="1.5"
          className="animate-nav-ripple-delayed"
        >
          <animate
            attributeName="r"
            values="6;32"
            dur="2.4s"
            begin="0.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0"
            dur="2.4s"
            begin="0.6s"
            repeatCount="indefinite"
          />
        </circle>

        {/* 4. Directional Headlight Cone (Tilts along the terrain slope) */}
        <g transform={`rotate(${tiltAngle})`}>
          <polygon
            points="0,0 40,-11 40,11"
            fill="url(#navHeadlightBeam)"
            className="animate-nav-headlight"
          />
        </g>

        {/* 5. Center Navigation Vehicle Puck / Compass Core */}
        {/* High-contrast outer shell */}
        <circle
          r="10.5"
          fill="#090d16"
          stroke="#ffffff"
          strokeWidth="2.5"
          filter="url(#navPuckGlow)"
        />

        {/* Inner colored puck */}
        <circle
          r="7.5"
          fill="url(#navPuckGradient)"
        />

        {/* Directional vehicle / chevron arrow rotated dynamically to slope angle */}
        <g transform={`rotate(${tiltAngle})`}>
          <path
            d="M 4 0 L -3.5 -3.5 L -1.5 0 L -3.5 3.5 Z"
            fill="#ffffff"
            stroke="#0284c7"
            strokeWidth="0.5"
          />
        </g>

        {/* Center white core beacon */}
        <circle
          r="1.8"
          fill="#ffffff"
        />
      </g>
    </g>
  );
};

export const ActiveRouteElevationCard: React.FC<ActiveRouteElevationCardProps> = ({
  activeRoute,
  onOpenPlanner,
  onClearRoute,
  onViewOnMap,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<MiniElevationPoint | null>(null);

  // Navigation simulation & progress tracking
  const [navProgressKm, setNavProgressKm] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [navSpeed, setNavSpeed] = useState<number>(2); // 1x, 2x, 4x
  const [followOnMap, setFollowOnMap] = useState<boolean>(true);

  const lastMapSyncRef = useRef<number>(0);

  // Derive elevation points from active route path coordinates and steps
  const { elevationPoints, stats, steepPointsCount, peakPoint } = useMemo(() => {
    const coords = activeRoute.pathCoordinates || [];
    const totalDist = activeRoute.totalDistanceKm || 100;
    const originAlt = activeRoute.origin.elevationM || 1350;
    const destAlt = activeRoute.destination.elevationM || 820;
    const maxPass = activeRoute.maxElevationM || Math.max(originAlt, destAlt, 1500);

    const steps = activeRoute.steps || [];
    const points: MiniElevationPoint[] = [];

    const numPoints = Math.max(40, Math.min(100, coords.length || 60));

    let prevElev = originAlt;
    let totalClimb = 0;
    let steepCount = 0;
    let highestPoint = { distance: 0, elevation: originAlt, label: 'Summit Pass' };

    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);
      const distance = Math.round(progress * totalDist * 10) / 10;

      // Coordinate matching
      let lat = activeRoute.origin.lat + (activeRoute.destination.lat - activeRoute.origin.lat) * progress;
      let lng = activeRoute.origin.lng + (activeRoute.destination.lng - activeRoute.origin.lng) * progress;
      if (coords.length > 0) {
        const coordIdx = Math.min(coords.length - 1, Math.floor(progress * coords.length));
        lat = coords[coordIdx][0];
        lng = coords[coordIdx][1];
      }

      // Elevation estimation along Nepal mountain corridors
      const baseInterpolated = originAlt + (destAlt - originAlt) * progress;
      const ridgeOffset = Math.sin(progress * Math.PI) * (maxPass - Math.min(originAlt, destAlt));
      const valleyWave = Math.sin(progress * Math.PI * 4) * 85;
      const roughElev = Math.round(Math.max(120, baseInterpolated + ridgeOffset * 0.85 + valleyWave));

      // Calculate slope grade %
      let grade = 0;
      if (i > 0 && points.length > 0) {
        const distDiff = Math.max(0.2, distance - points[points.length - 1].distance);
        const elevDiff = roughElev - prevElev;
        grade = Math.round((elevDiff / (distDiff * 1000)) * 1000) / 10;
        if (elevDiff > 0) totalClimb += elevDiff;
      }

      const isSteep = Math.abs(grade) >= 8.0;
      if (isSteep) steepCount++;

      // Check if near key step instruction
      let landmark: string | undefined;
      const stepIdx = Math.min(steps.length - 1, Math.floor(progress * steps.length));
      if (steps[stepIdx]) {
        if (i === 0) landmark = activeRoute.origin.name;
        else if (i === numPoints - 1) landmark = activeRoute.destination.name;
        else if (roughElev > highestPoint.elevation) {
          highestPoint = { distance, elevation: roughElev, label: 'Summit Pass' };
          landmark = 'Peak Summit';
        }
      }

      points.push({
        distance,
        elevation: roughElev,
        grade,
        isSteep,
        lat,
        lng,
        landmark,
        stepInstruction: steps[stepIdx]?.instruction || `Highway chainage km ${distance}`,
      });

      prevElev = roughElev;
    }

    const minElev = Math.min(...points.map((p) => p.elevation));
    const maxElev = Math.max(...points.map((p) => p.elevation));

    return {
      elevationPoints: points,
      stats: {
        minElev,
        maxElev,
        totalClimb: Math.round(activeRoute.elevationGainM || totalClimb),
      },
      steepPointsCount: steepCount,
      peakPoint: highestPoint,
    };
  }, [activeRoute]);

  const totalDist = activeRoute.totalDistanceKm || 100;
  const yMin = Math.max(0, Math.floor(stats.minElev / 100) * 100 - 100);
  const yMax = Math.ceil(stats.maxElev / 100) * 100 + 100;

  // Initialize progress to a sensible starting position (e.g. 10% into the trip)
  useEffect(() => {
    if (navProgressKm === 0 && totalDist > 0) {
      setNavProgressKm(Math.round(totalDist * 0.12 * 10) / 10);
    }
  }, [totalDist]);

  // Current interpolated position for the navigation progress marker
  const currentNavPosition = useMemo(() => {
    if (!elevationPoints || elevationPoints.length === 0) {
      return {
        distance: 0,
        elevation: 1200,
        grade: 0,
        tiltAngle: 0,
        lat: activeRoute.origin.lat,
        lng: activeRoute.origin.lng,
        landmark: activeRoute.origin.name,
        stepInstruction: 'Starting journey',
      };
    }

    const clampedDist = Math.max(0, Math.min(totalDist, navProgressKm));

    // Find bounding points in elevationPoints
    let p0 = elevationPoints[0];
    let p1 = elevationPoints[elevationPoints.length - 1];

    for (let i = 0; i < elevationPoints.length - 1; i++) {
      if (elevationPoints[i].distance <= clampedDist && elevationPoints[i + 1].distance >= clampedDist) {
        p0 = elevationPoints[i];
        p1 = elevationPoints[i + 1];
        break;
      }
    }

    const segmentSpan = Math.max(0.001, p1.distance - p0.distance);
    const ratio = Math.max(0, Math.min(1, (clampedDist - p0.distance) / segmentSpan));

    const elevation = Math.round(p0.elevation + (p1.elevation - p0.elevation) * ratio);
    const grade = Math.round((p0.grade + (p1.grade - p0.grade) * ratio) * 10) / 10;
    const lat = p0.lat + (p1.lat - p0.lat) * ratio;
    const lng = p0.lng + (p1.lng - p0.lng) * ratio;

    // Tilt angle in degrees matching mountain grade (-25 deg downhill to +25 deg uphill)
    const tiltAngle = Math.max(-25, Math.min(25, -grade * 1.5));

    return {
      distance: clampedDist,
      elevation,
      grade,
      tiltAngle,
      lat,
      lng,
      landmark: p1.landmark || p0.landmark,
      stepInstruction: p1.stepInstruction || p0.stepInstruction,
    };
  }, [elevationPoints, navProgressKm, totalDist, activeRoute]);

  // Animated Navigation Loop: simulates vehicle progressing along the route
  useEffect(() => {
    if (!isNavigating) return;

    const interval = setInterval(() => {
      setNavProgressKm((prev) => {
        // Step size based on navSpeed (e.g. 0.35 km per 80ms tick)
        const step = 0.3 * navSpeed;
        const next = prev + step;
        if (next >= totalDist) {
          setIsNavigating(false);
          return totalDist;
        }
        return Math.round(next * 10) / 10;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [isNavigating, navSpeed, totalDist]);

  // Sync with interactive map when navigating with followOnMap enabled
  useEffect(() => {
    if (!followOnMap || !onViewOnMap) return;

    const now = Date.now();
    // Throttle map centering calls to avoid jitter (at most once every 900ms)
    if (now - lastMapSyncRef.current > 900) {
      lastMapSyncRef.current = now;
      onViewOnMap({
        lat: currentNavPosition.lat,
        lng: currentNavPosition.lng,
        title: `Navigation Progress: KM ${currentNavPosition.distance} (${currentNavPosition.elevation}m ASL)`,
        zoom: 13,
      });
    }
  }, [currentNavPosition, followOnMap, onViewOnMap]);

  const progressPercent = Math.round((navProgressKm / totalDist) * 100);

  return (
    <div
      id="active-route-elevation-card"
      className="fixed bottom-4 left-4 sm:bottom-5 sm:left-5 z-20 w-[calc(100vw-5.5rem)] sm:w-96 md:w-[460px] max-w-full bg-slate-950/95 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
    >
      {/* 1. Route Details Header */}
      <div className="p-3 sm:p-3.5 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center justify-between gap-2">
          {/* Origin -> Destination & Navigation Status */}
          <div className="flex items-center space-x-2 min-w-0">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isNavigating ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  {activeRoute.origin.name} ➔ {activeRoute.destination.name}
                </span>
                {activeRoute.routeBadge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 shrink-0">
                    {activeRoute.routeBadge}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {activeRoute.totalDistanceKm} km •{' '}
                {Math.floor(activeRoute.estimatedTimeMinutes / 60)}h{' '}
                {activeRoute.estimatedTimeMinutes % 60}m • +{stats.totalClimb}m climb
              </p>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isExpanded ? 'Collapse Elevation Profile' : 'Expand Elevation Profile'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={onOpenPlanner}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
              title="Open Full Route Planner"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClearRoute}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
              title="Clear Active Route"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Compact Route Detail Metrics */}
        <div className="grid grid-cols-4 gap-1.5 mt-2.5 pt-2 border-t border-slate-800/60 text-center">
          <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
              <Compass className="w-2.5 h-2.5 text-emerald-400" />
              <span>Dist</span>
            </div>
            <div className="text-xs font-black text-white font-mono mt-0.5">
              {activeRoute.totalDistanceKm} <span className="text-[9px] font-normal text-slate-400">km</span>
            </div>
          </div>

          <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
              <Clock className="w-2.5 h-2.5 text-cyan-400" />
              <span>Time</span>
            </div>
            <div className="text-xs font-black text-cyan-300 font-mono mt-0.5">
              {Math.floor(activeRoute.estimatedTimeMinutes / 60)}h {activeRoute.estimatedTimeMinutes % 60}m
            </div>
          </div>

          <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
              <Mountain className="w-2.5 h-2.5 text-purple-400" />
              <span>Peak</span>
            </div>
            <div className="text-xs font-black text-purple-300 font-mono mt-0.5">
              {stats.maxElev}m
            </div>
          </div>

          <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
              <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
              <span>Safety</span>
            </div>
            <div className="text-xs font-black text-emerald-400 font-mono mt-0.5">
              {activeRoute.roadConditionScore}/100
            </div>
          </div>
        </div>
      </div>

      {/* 2. Elevation Profile Visualization with Animated Progress Marker (Recharts) */}
      {isExpanded && (
        <div className="p-3 sm:p-3.5 space-y-2.5">
          {/* Header Row: Title & Navigation Badge */}
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5 font-bold text-slate-200">
              <Mountain className="w-3.5 h-3.5 text-sky-400" />
              <span>Mountain Elevation Profile</span>
            </div>

            <div className="flex items-center space-x-2">
              {steepPointsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span>{steepPointsCount} Steep &gt;8%</span>
                </span>
              )}
            </div>
          </div>

          {/* Recharts Chart Container with Animated Navigation Marker */}
          <div
            id="mini-elevation-recharts-container"
            className="w-full h-44 sm:h-48 bg-slate-900/80 rounded-xl border border-slate-800 p-1.5 relative select-none"
          >
            <ResponsiveContainer width="100%" height="100%" minHeight={160}>
              <ComposedChart
                data={elevationPoints}
                margin={{ top: 28, right: 12, left: -20, bottom: 0 }}
                onMouseMove={(state: any) => {
                  if (state && state.activePayload && state.activePayload[0]) {
                    setHoveredPoint(state.activePayload[0].payload);
                  }
                }}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload[0]) {
                    const pt: MiniElevationPoint = state.activePayload[0].payload;
                    setNavProgressKm(pt.distance);
                    if (onViewOnMap) {
                      onViewOnMap({
                        lat: pt.lat,
                        lng: pt.lng,
                        title: `${pt.landmark || 'Elevation Point'}: ${pt.elevation}m ASL (${pt.grade > 0 ? '+' : ''}${pt.grade}%)`,
                        zoom: 13,
                      });
                    }
                  }
                }}
              >
                <defs>
                  <linearGradient id="activeRouteElevationFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#0284c7" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="distance"
                  type="number"
                  domain={[0, totalDist]}
                  unit="km"
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  domain={[yMin, yMax]}
                  type="number"
                  unit="m"
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                />

                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt: MiniElevationPoint = payload[0].payload;
                    return (
                      <div className="bg-slate-900/95 border border-slate-700 shadow-xl rounded-lg p-2 text-xs backdrop-blur text-slate-200 space-y-1 max-w-[210px]">
                        <div className="flex items-center justify-between text-[10px] font-bold text-sky-400">
                          <span>KM {pt.distance}</span>
                          <span
                            className={
                              pt.isSteep
                                ? 'text-red-400 font-black'
                                : pt.grade > 0
                                ? 'text-amber-400'
                                : 'text-cyan-400'
                            }
                          >
                            {pt.grade > 0 ? `+${pt.grade}%` : `${pt.grade}%`} Grade
                          </span>
                        </div>
                        <div className="text-sm font-extrabold text-white font-mono">
                          {pt.elevation.toLocaleString()}m <span className="text-[10px] text-slate-400 font-normal">ASL</span>
                        </div>
                        {pt.landmark && (
                          <div className="text-[10px] font-semibold text-amber-300">
                            ⛰️ {pt.landmark}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-400 leading-tight line-clamp-2">
                          {pt.stepInstruction}
                        </div>
                        <div className="text-[8px] text-cyan-400/80 pt-0.5 border-t border-slate-800">
                          Click to set navigation progress here
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Summit Pass Reference Line */}
                <ReferenceLine
                  y={stats.maxElev}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{
                    value: `Peak ${stats.maxElev}m`,
                    fill: '#f59e0b',
                    fontSize: 9,
                    position: 'top',
                  }}
                />

                {/* Elevation Area Chart */}
                <Area
                  type="monotone"
                  dataKey="elevation"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="url(#activeRouteElevationFill)"
                  isAnimationActive={false}
                />

                {/* Red Dots for Steep Mountain Gradients (>8%) */}
                <Line
                  type="monotone"
                  dataKey="elevation"
                  stroke="transparent"
                  isAnimationActive={false}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload && payload.isSteep) {
                      return (
                        <circle
                          key={`steep-dot-${props.index}`}
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth={1}
                        />
                      );
                    }
                    return <circle key={`dot-${props.index}`} cx={cx} cy={cy} r={0} fill="transparent" />;
                  }}
                />

                {/* ANIMATED SVG MARKER: Follows the elevation profile path representing navigation progress */}
                <ReferenceDot
                  x={currentNavPosition.distance}
                  y={currentNavPosition.elevation}
                  r={8}
                  isFront={true}
                  shape={(props: any) => (
                    <AnimatedElevationProgressMarker
                      cx={props.cx}
                      cy={props.cy}
                      distance={currentNavPosition.distance}
                      elevation={currentNavPosition.elevation}
                      grade={currentNavPosition.grade}
                      tiltAngle={currentNavPosition.tiltAngle}
                      progressPercent={progressPercent}
                      isNavigating={isNavigating}
                      landmark={currentNavPosition.landmark}
                      instruction={currentNavPosition.stepInstruction}
                      chartBottomY={152}
                    />
                  )}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 3. Navigation Controls & Real-time Progress Bar */}
          <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 space-y-2">
            {/* Top row: Progress Scrubber & KM counter */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center space-x-1.5 min-w-0">
                <Navigation className={`w-3.5 h-3.5 ${isNavigating ? 'text-emerald-400 animate-bounce' : 'text-cyan-400'}`} />
                <span className="font-bold text-white font-mono text-xs">
                  KM {Math.round(currentNavPosition.distance * 10) / 10}
                </span>
                <span className="text-[10px] text-slate-400">
                  / {totalDist} km ({progressPercent}%)
                </span>
              </div>

              <div className="flex items-center space-x-1 text-[10px] text-slate-300 shrink-0 font-mono">
                <span className="text-cyan-300 font-bold">{currentNavPosition.elevation}m</span>
                <span
                  className={
                    Math.abs(currentNavPosition.grade) >= 8
                      ? 'text-red-400 font-bold'
                      : currentNavPosition.grade > 0
                      ? 'text-amber-400 font-bold'
                      : 'text-emerald-400 font-bold'
                  }
                >
                  ({currentNavPosition.grade > 0 ? '+' : ''}{currentNavPosition.grade}%)
                </span>
              </div>
            </div>

            {/* Interactive Progress Slider */}
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max={totalDist}
                step="0.1"
                value={navProgressKm}
                onChange={(e) => setNavProgressKm(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition"
                aria-label="Route navigation progress along elevation path"
              />
            </div>

            {/* Bottom Row: Simulation Play/Pause, Speed Toggle, Map Sync, & Summit Shortcut */}
            <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px]">
              {/* Playback Controls */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsNavigating(!isNavigating)}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-bold text-xs transition shadow-sm ${
                    isNavigating
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                  }`}
                  title={isNavigating ? 'Pause Navigation Simulation' : 'Start Navigation Simulation'}
                >
                  {isNavigating ? (
                    <>
                      <Pause className="w-3 h-3 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Drive</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setIsNavigating(false);
                    setNavProgressKm(0);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Reset to Route Start"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                {/* Speed Multiplier */}
                <button
                  onClick={() => setNavSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 font-mono font-bold transition text-[10px]"
                  title="Simulation Speed Multiplier"
                >
                  {navSpeed}x
                </button>
              </div>

              {/* Map Sync & Summit Shortcuts */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setFollowOnMap(!followOnMap)}
                  className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition ${
                    followOnMap
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-300 bg-slate-800/60'
                  }`}
                  title="Keep map centered on vehicle progress"
                >
                  <Crosshair className="w-2.5 h-2.5" />
                  <span>Map Sync</span>
                </button>

                {peakPoint && (
                  <button
                    onClick={() => setNavProgressKm(peakPoint.distance)}
                    className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition"
                    title={`Jump to Summit Pass (${peakPoint.elevation}m)`}
                  >
                    <Flag className="w-2.5 h-2.5" />
                    <span>Peak</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
