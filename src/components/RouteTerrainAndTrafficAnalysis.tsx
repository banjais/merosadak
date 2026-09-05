import React, { useState, useMemo } from 'react';
import { RoutePlanResult, VehicleType } from '../types';
import {
  Mountain,
  TrendingUp,
  TrendingDown,
  Gauge,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Clock,
  Timer,
  Percent,
  Activity,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Flame,
  Info,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';

interface RouteTerrainAndTrafficAnalysisProps {
  routePlan: RoutePlanResult;
  vehicle: VehicleType;
}

export type TimeOfDaySlot = 'early_morning' | 'midday' | 'evening_peak' | 'night';

interface TimeOfDayConfig {
  id: TimeOfDaySlot;
  label: string;
  timeRange: string;
  icon: React.ComponentType<{ className?: string }>;
  multiplier: number;
  trafficLevel: 'Light' | 'Moderate' | 'Heavy' | 'Caution / Freight';
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  advisory: string;
}

export const TIME_OF_DAY_CONFIGS: TimeOfDayConfig[] = [
  {
    id: 'early_morning',
    label: 'Early Morning',
    timeRange: '05:00 - 08:00',
    icon: Sunrise,
    multiplier: 0.88, // 12% faster
    trafficLevel: 'Light',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400',
    advisory: 'Optimal departure window. Clear mountain passes before freight truck queues build up.',
  },
  {
    id: 'midday',
    label: 'Midday / Afternoon',
    timeRange: '08:00 - 15:00',
    icon: Sun,
    multiplier: 1.0, // baseline
    trafficLevel: 'Moderate',
    color: 'cyan',
    badgeBg: 'bg-cyan-500/10',
    badgeBorder: 'border-cyan-500/30',
    badgeText: 'text-cyan-400',
    advisory: 'Standard intercity bus & microbus flow. Regular speeds with occasional road widening stops.',
  },
  {
    id: 'evening_peak',
    label: 'Evening Rush',
    timeRange: '15:00 - 19:00',
    icon: Sunset,
    multiplier: 1.24, // 24% slower
    trafficLevel: 'Heavy',
    color: 'amber',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
    advisory: 'Heavy junction bottlenecks near valley checkpoints (Nagdhunga, Narayanghat, Butwal).',
  },
  {
    id: 'night',
    label: 'Night Drive',
    timeRange: '19:00 - 05:00',
    icon: Moon,
    multiplier: 1.15, // 15% caution delay
    trafficLevel: 'Caution / Freight',
    color: 'purple',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
    advisory: 'Long-haul freight trucks active. Reduced visibility on unlit river canyons and sharp bends.',
  },
];

export const RouteTerrainAndTrafficAnalysis: React.FC<RouteTerrainAndTrafficAnalysisProps> = ({
  routePlan,
  vehicle,
}) => {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeOfDaySlot>('early_morning');

  // Compute terrain gradient, difficulty index, and climb metrics
  const terrainMetrics = useMemo(() => {
    const totalDistMeters = Math.max(1, routePlan.totalDistanceKm * 1000);
    const elevationGain = routePlan.elevationGainM || 0;
    const originAlt = routePlan.origin.elevationM;
    const destAlt = routePlan.destination.elevationM;
    const maxAlt = routePlan.maxElevationM || Math.max(originAlt, destAlt);
    const netAltDiff = destAlt - originAlt;

    // Approximate total descent based on ascent & net change
    const elevationLoss = Math.max(0, elevationGain - netAltDiff);

    // Average climb gradient across ascending sections
    const avgClimbGradePercent = Math.min(
      15,
      Math.max(0.5, (elevationGain / totalDistMeters) * 100 * 2.2)
    );

    // Max gradient estimation based on corridor terrain
    let maxGradientPercent = 5.2;
    let difficultyTier: 'Grade I - Lowland Plain' | 'Grade II - Rolling Hill' | 'Grade III - Steep Canyon' | 'Grade IV - High Alpine Pass' =
      'Grade II - Rolling Hill';
    let difficultyScore = 50; // out of 100
    let difficultyColor = 'amber';
    let terrainIcon = Mountain;

    if (maxAlt > 2200 || elevationGain > 2000) {
      difficultyTier = 'Grade IV - High Alpine Pass';
      maxGradientPercent = 8.8;
      difficultyScore = 92;
      difficultyColor = 'rose';
    } else if (maxAlt > 1400 || elevationGain > 1100) {
      difficultyTier = 'Grade III - Steep Canyon';
      maxGradientPercent = 7.4;
      difficultyScore = 74;
      difficultyColor = 'amber';
    } else if (elevationGain > 400) {
      difficultyTier = 'Grade II - Rolling Hill';
      maxGradientPercent = 5.5;
      difficultyScore = 52;
      difficultyColor = 'cyan';
    } else {
      difficultyTier = 'Grade I - Lowland Plain';
      maxGradientPercent = 3.2;
      difficultyScore = 28;
      difficultyColor = 'emerald';
    }

    return {
      avgClimbGradePercent: Math.round(avgClimbGradePercent * 10) / 10,
      maxGradientPercent: Math.round(maxGradientPercent * 10) / 10,
      elevationGain,
      elevationLoss,
      originAlt,
      destAlt,
      maxAlt,
      netAltDiff,
      difficultyTier,
      difficultyScore,
      difficultyColor,
      terrainIcon,
    };
  }, [routePlan]);

  // Active time-of-day traffic calculation
  const activeTimeConfig = useMemo(() => {
    return TIME_OF_DAY_CONFIGS.find((c) => c.id === selectedTimeSlot) || TIME_OF_DAY_CONFIGS[0];
  }, [selectedTimeSlot]);

  const adjustedDurationMinutes = useMemo(() => {
    return Math.round(routePlan.estimatedTimeMinutes * activeTimeConfig.multiplier);
  }, [routePlan.estimatedTimeMinutes, activeTimeConfig]);

  const diffMinutes = adjustedDurationMinutes - routePlan.estimatedTimeMinutes;

  return (
    <div
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
      id="route-terrain-traffic-analysis"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight font-display">
              Terrain Difficulty, Gradient & Traffic Dynamics
            </h3>
            <p className="text-[11px] text-slate-400">
              Topographic climb metrics & time-of-day highway bottleneck adjustments
            </p>
          </div>
        </div>

        {/* Difficulty Tier Pill */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Terrain Index:</span>
          <span
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center space-x-1.5 ${
              terrainMetrics.difficultyColor === 'rose'
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                : terrainMetrics.difficultyColor === 'amber'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : terrainMetrics.difficultyColor === 'cyan'
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>{terrainMetrics.difficultyTier}</span>
          </span>
        </div>
      </div>

      {/* Grid: 3 Interactive Feature Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Terrain Difficulty & Road Curvature Index */}
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center space-x-1">
                <Mountain className="w-3.5 h-3.5 text-purple-400" />
                <span>Terrain Difficulty</span>
              </span>
              <span className="font-bold text-purple-400">{terrainMetrics.difficultyScore}/100</span>
            </div>

            {/* Visual Difficulty Progress Bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  terrainMetrics.difficultyColor === 'rose'
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : terrainMetrics.difficultyColor === 'amber'
                    ? 'bg-gradient-to-r from-cyan-500 to-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                }`}
                style={{ width: `${terrainMetrics.difficultyScore}%` }}
              />
            </div>

            <div className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Altitude Span:</span>
                <span className="font-semibold text-white">
                  {terrainMetrics.originAlt}m ➔ {terrainMetrics.destAlt}m
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Peak Summit:</span>
                <span className="font-semibold text-purple-300">{terrainMetrics.maxAlt}m ASL</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Hairpins & Bends:</span>
                <span className="font-semibold text-amber-300">
                  {terrainMetrics.difficultyScore > 70
                    ? 'High Switchback Density'
                    : terrainMetrics.difficultyScore > 40
                    ? 'Moderate River Meanders'
                    : 'Gentle Highway Curves'}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Terrain Tip */}
          <div className="bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-300 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">
              {vehicle === 'electric_vehicle'
                ? 'Regen braking active on downhills (+15% charge recovery)'
                : vehicle === 'motorbike'
                ? 'Use wet-grip tires for river canyon hairpin bends'
                : 'Recommended: Engine braking (Gear 2/3) on steep descents'}
            </span>
          </div>
        </div>

        {/* Card 2: Estimated Climb Percentage & Incline Profile */}
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Estimated Climb Grade</span>
              </span>
              <span className="flex items-center space-x-0.5 font-bold text-emerald-400">
                <Percent className="w-3 h-3" />
                <span>Gradient</span>
              </span>
            </div>

            {/* Gradient Numbers */}
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-white font-display">
                {terrainMetrics.avgClimbGradePercent}%
              </span>
              <span className="text-xs text-slate-400 font-medium">avg ascending grade</span>
            </div>

            <div className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 flex items-center space-x-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  <span>Total Ascent:</span>
                </span>
                <span className="font-semibold text-emerald-400">+{terrainMetrics.elevationGain} m</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 flex items-center space-x-1">
                  <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                  <span>Total Descent:</span>
                </span>
                <span className="font-semibold text-cyan-400">-{terrainMetrics.elevationLoss} m</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-amber-400" />
                  <span>Max Peak Incline:</span>
                </span>
                <span className="font-semibold text-amber-300">~{terrainMetrics.maxGradientPercent}% grade</span>
              </div>
            </div>
          </div>

          {/* Elevation Bar Graphic */}
          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>{routePlan.origin.name} ({terrainMetrics.originAlt}m)</span>
              <span>{routePlan.destination.name} ({terrainMetrics.destAlt}m)</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div className="bg-emerald-400" style={{ width: '35%' }} title="Mild Incline" />
              <div className="bg-amber-400" style={{ width: '40%' }} title="Mountain Ghats" />
              <div className="bg-cyan-400" style={{ width: '25%' }} title="Valley Descent" />
            </div>
          </div>
        </div>

        {/* Card 3: Time-of-Day Traffic Adjustments & Live Simulator */}
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center space-x-1">
                <Timer className="w-3.5 h-3.5 text-cyan-400" />
                <span>Time-of-Day Traffic</span>
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${activeTimeConfig.badgeBg} ${activeTimeConfig.badgeBorder} ${activeTimeConfig.badgeText}`}>
                {activeTimeConfig.trafficLevel}
              </span>
            </div>

            {/* Time Adjuster Quick Selector */}
            <div className="grid grid-cols-4 gap-1 mt-2">
              {TIME_OF_DAY_CONFIGS.map((slot) => {
                const Icon = slot.icon;
                const isSelected = selectedTimeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedTimeSlot(slot.id)}
                    className={`py-1.5 px-1 rounded-lg border text-center transition flex flex-col items-center justify-center space-y-0.5 ${
                      isSelected
                        ? `${slot.badgeBg} ${slot.badgeBorder} ${slot.badgeText} font-bold shadow-sm ring-1 ring-white/10`
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    title={`${slot.label} (${slot.timeRange})`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="text-[9px] truncate max-w-full">{slot.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Adjusted Travel Time Display */}
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <div className="text-[10px] text-slate-400">Adjusted Duration:</div>
                <div className="text-lg font-black text-white font-display">
                  {Math.floor(adjustedDurationMinutes / 60)}h {adjustedDurationMinutes % 60}m
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                    diffMinutes < 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : diffMinutes > 0
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {diffMinutes < 0
                    ? `${diffMinutes}m faster`
                    : diffMinutes > 0
                    ? `+${diffMinutes}m delay`
                    : 'Standard baseline'}
                </span>
              </div>
            </div>
          </div>

          {/* Time Window Advisory Note */}
          <div className="bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-300 flex items-start space-x-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span className="leading-tight text-slate-300">{activeTimeConfig.advisory}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
