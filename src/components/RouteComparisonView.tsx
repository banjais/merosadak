import React, { useState, useMemo } from 'react';
import { RoutePlanResult, VehicleType } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Fuel,
  Zap,
  Mountain,
  Clock,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Eye,
  SlidersHorizontal,
  Info,
  Check,
  Gauge,
  Camera,
  Layers,
  Receipt,
  Scale,
  Car,
  Bike,
  Truck,
} from 'lucide-react';

interface RouteComparisonViewProps {
  activePlan: RoutePlanResult;
  allOptions: RoutePlanResult[];
  selectedRouteId: string;
  vehicle: VehicleType;
  onSelectRoute: (route: RoutePlanResult) => void;
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
  className?: string;
}

type DimensionCategory = 'all' | 'safety' | 'cost' | 'scenic' | 'time';

export const RouteComparisonView: React.FC<RouteComparisonViewProps> = ({
  activePlan,
  allOptions,
  selectedRouteId,
  vehicle,
  onSelectRoute,
  onViewOnMap,
  className = '',
}) => {
  const [activeDimension, setActiveDimension] = useState<DimensionCategory>('all');
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState<boolean>(true);

  // Guarantee we have options to compare
  const routeOptions = useMemo(() => {
    if (!allOptions || allOptions.length === 0) return [activePlan];
    return allOptions;
  }, [allOptions, activePlan]);

  // Designate the Primary Route (current active/selected route) and Alternative Routes
  const primaryRoute = useMemo(() => {
    return routeOptions.find((r) => r.id === selectedRouteId) || activePlan || routeOptions[0];
  }, [routeOptions, selectedRouteId, activePlan]);

  const alternativeRoutes = useMemo(() => {
    return routeOptions.filter((r) => r.id !== primaryRoute.id);
  }, [routeOptions, primaryRoute]);

  // Fuel price helper
  const isEV = vehicle === 'electric_vehicle';
  const isDiesel = vehicle === 'suv_4wd' || vehicle === 'bus_truck';
  const unitPrice = isEV ? 15 : isDiesel ? 158 : 175;

  const calculateCost = (route: RoutePlanResult) => {
    if (isEV) {
      const kwh = route.evEstimate?.kwhRequired || Math.round((route.totalDistanceKm / 6.2) * 10) / 10;
      return Math.round(kwh * 15) + (route.totalTollCostNpr || 0);
    }
    return route.fuelEstimate.costNpr + (route.totalTollCostNpr || 0);
  };

  const getSafetyScore = (route: RoutePlanResult) => {
    return route.safetyIndex?.overallScore ?? route.roadConditionScore;
  };

  // Best-in-class calculations across all routes
  const metricsOverview = useMemo(() => {
    const safest = [...routeOptions].sort((a, b) => getSafetyScore(b) - getSafetyScore(a))[0];
    const cheapest = [...routeOptions].sort((a, b) => calculateCost(a) - calculateCost(b))[0];
    const fastest = [...routeOptions].sort((a, b) => a.estimatedTimeMinutes - b.estimatedTimeMinutes)[0];
    const mostScenic = [...routeOptions].sort((a, b) => (b.scenicRating || 3) - (a.scenicRating || 3))[0];

    return {
      safestId: safest.id,
      cheapestId: cheapest.id,
      fastestId: fastest.id,
      mostScenicId: mostScenic.id,
    };
  }, [routeOptions, vehicle]);

  // Helper for formatting scenic descriptions based on highway segments
  const getScenicDetails = (route: RoutePlanResult) => {
    const rating = route.scenicRating || 3.8;
    let label = 'Moderate Valley Views';
    let highlights = ['Trisuli River Gorge', 'Mid-Hill Terraced Slopes'];

    if (rating >= 4.7) {
      label = 'World-Class Himalayan Panorama';
      highlights = ['Annapurna & Manaslu Range Vistas', 'Snow-Peak Lookout', 'Dramatic Alpine Passes'];
    } else if (rating >= 4.3) {
      label = 'High Scenic Ridge & Gorge';
      highlights = ['Deep River Canyons', 'Rhododendron Forest Ridges', 'Valley Viewpoints'];
    } else if (rating >= 4.0) {
      label = 'Scenic Hill Highway';
      highlights = ['Terraced Hill Farms', 'Mountain River Crossings', 'Cultural Junctions'];
    } else {
      label = 'Express Transit Highway';
      highlights = ['Flatland Terai Greenery', 'Urban Arteries', 'Highway Bridges'];
    }

    return { rating, label, highlights };
  };

  return (
    <div
      className={`bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5 ${className}`}
      id="route-comparison-view-container"
    >
      {/* 1. Header & Dimension Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[10px] font-black bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 rounded-md uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>Route Comparison &amp; Trade-off Engine</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Primary vs. {alternativeRoutes.length} Alternative{alternativeRoutes.length > 1 ? 's' : ''}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1 font-display flex items-center space-x-2">
            <span>Primary vs Alternative Route Comparison</span>
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl">
            Side-by-side analysis highlighting critical differences in <strong className="text-emerald-400 font-semibold">Safety</strong>,{' '}
            <strong className="text-amber-400 font-semibold">Fuel &amp; Transit Cost</strong>, and{' '}
            <strong className="text-purple-400 font-semibold">Scenic Value</strong>.
          </p>
        </div>

        {/* Dimension Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto shadow-inner text-xs">
          <button
            onClick={() => setActiveDimension('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
              activeDimension === 'all'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>All Differences</span>
          </button>
          <button
            onClick={() => setActiveDimension('safety')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
              activeDimension === 'safety'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Safety</span>
          </button>
          <button
            onClick={() => setActiveDimension('cost')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
              activeDimension === 'cost'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-900'
            }`}
          >
            <Fuel className="w-3.5 h-3.5 text-amber-400" />
            <span>Fuel Cost</span>
          </button>
          <button
            onClick={() => setActiveDimension('scenic')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
              activeDimension === 'scenic'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-purple-300 hover:bg-slate-900'
            }`}
          >
            <Mountain className="w-3.5 h-3.5 text-purple-400" />
            <span>Scenic Value</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Head-to-Head Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* PRIMARY ROUTE ANCHOR CARD */}
        <div className="lg:col-span-5 bg-slate-950/90 border-2 border-emerald-500/60 rounded-2xl p-4 sm:p-5 shadow-xl relative flex flex-col justify-between">
          <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 flex items-center space-x-1 shadow-md uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            <span>PRIMARY ROUTE (ACTIVE)</span>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {primaryRoute.routeBadge || 'Selected Corridor'}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {primaryRoute.origin.name} ➔ {primaryRoute.destination.name}
              </span>
            </div>

            <h4 className="text-base sm:text-lg font-black text-white mt-1.5 font-display">
              {primaryRoute.routeName}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              {primaryRoute.viaHighlights || primaryRoute.alternateRouteSummary?.reason || 'Main Highway Corridor'}
            </p>

            {/* Primary Key Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 my-4 pt-3 border-t border-slate-800/80">
              {/* Safety */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Safety</span>
                </div>
                <div className="text-base font-black text-emerald-400 mt-1">
                  {getSafetyScore(primaryRoute)}
                  <span className="text-[10px] font-normal text-slate-500">/100</span>
                </div>
                <div className="text-[9px] text-slate-400">
                  {primaryRoute.safetyIndex?.activeBlackspots?.length || 0} blackspots
                </div>
              </div>

              {/* Fuel Cost */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Fuel className="w-3 h-3 text-amber-400" />
                  <span>Cost</span>
                </div>
                <div className="text-base font-black text-amber-300 mt-1">
                  NPR {calculateCost(primaryRoute).toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-400">
                  {isEV ? `${primaryRoute.evEstimate?.kwhRequired} kWh` : `${primaryRoute.fuelEstimate.liters} L`}
                </div>
              </div>

              {/* Scenic Rating */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Mountain className="w-3 h-3 text-purple-400" />
                  <span>Scenic</span>
                </div>
                <div className="text-base font-black text-purple-300 mt-1">
                  ★ {primaryRoute.scenicRating || 3.8}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {getScenicDetails(primaryRoute).label.split(' ')[0]}
                </div>
              </div>
            </div>

            {/* Travel Time & Distance */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-white">
                  {Math.floor(primaryRoute.estimatedTimeMinutes / 60)}h {primaryRoute.estimatedTimeMinutes % 60}m
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white">{primaryRoute.totalDistanceKm} km</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>Current Baseline for Comparison</span>
            </span>
            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap()}
                className="text-slate-400 hover:text-white underline flex items-center space-x-1"
              >
                <Eye className="w-3 h-3" />
                <span>Show on map</span>
              </button>
            )}
          </div>
        </div>

        {/* ALTERNATIVE ROUTES COMPARISON CARDS */}
        <div className="lg:col-span-7 space-y-3">
          {alternativeRoutes.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 space-y-2">
              <Compass className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-white">Single Viable Highway Corridor</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No alternative paved bypass exists for this specific origin and destination pair in the current Nepal road network.
              </p>
            </div>
          ) : (
            alternativeRoutes.map((alt, idx) => {
              // Deltas vs Primary
              const safetyDelta = getSafetyScore(alt) - getSafetyScore(primaryRoute);
              const costDelta = calculateCost(alt) - calculateCost(primaryRoute);
              const scenicDelta = Math.round(((alt.scenicRating || 3.8) - (primaryRoute.scenicRating || 3.8)) * 10) / 10;
              const timeDelta = alt.estimatedTimeMinutes - primaryRoute.estimatedTimeMinutes;
              const distDelta = alt.totalDistanceKm - primaryRoute.totalDistanceKm;

              const altColor = alt.routeColor || '#a855f7';
              const isSafest = metricsOverview.safestId === alt.id;
              const isCheapest = metricsOverview.cheapestId === alt.id;
              const isScenic = metricsOverview.mostScenicId === alt.id;
              const isFastest = metricsOverview.fastestId === alt.id;

              return (
                <div
                  key={alt.id || idx}
                  className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition shadow-lg space-y-3.5 group"
                >
                  {/* Card Header & Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-extrabold border"
                        style={{
                          backgroundColor: `${altColor}20`,
                          color: altColor,
                          borderColor: `${altColor}40`,
                        }}
                      >
                        {alt.routeBadge || `Alternative ${idx + 1}`}
                      </span>

                      {isSafest && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>TOP SAFETY</span>
                        </span>
                      )}
                      {isCheapest && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                          <Fuel className="w-2.5 h-2.5" />
                          <span>LOWEST COST</span>
                        </span>
                      )}
                      {isScenic && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center space-x-1">
                          <Mountain className="w-2.5 h-2.5" />
                          <span>TOP SCENIC</span>
                        </span>
                      )}
                    </div>

                    {/* Quick Switch Button */}
                    <button
                      onClick={() => onSelectRoute(alt)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 self-start sm:self-auto border border-slate-700 shadow-sm"
                    >
                      <span>Switch to this Route</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Title & Corridor Summary */}
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-white">{alt.routeName}</h4>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {alt.viaHighlights || alt.alternateRouteSummary?.reason || 'Verified corridor bypass'}
                    </p>
                  </div>

                  {/* 3 HIGHLIGHT DIFFERENCE BARS (SAFETY, FUEL COST, SCENIC VALUE) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {/* DIFFERENCE 1: SAFETY */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        safetyDelta > 0
                          ? 'bg-emerald-950/40 border-emerald-500/40'
                          : safetyDelta < 0
                          ? 'bg-rose-950/30 border-rose-500/30'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                        <span className="flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>Safety Diff</span>
                        </span>
                        <span
                          className={`font-mono font-extrabold ${
                            safetyDelta > 0
                              ? 'text-emerald-400'
                              : safetyDelta < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {safetyDelta > 0 ? `+${safetyDelta}` : safetyDelta === 0 ? 'Equal' : `${safetyDelta}`} pts
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white mt-1 flex items-baseline space-x-1">
                        <span>{getSafetyScore(alt)}/100</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          vs {getSafetyScore(primaryRoute)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {safetyDelta > 0 ? (
                          <span className="text-emerald-300 font-medium">✓ Smoother asphalt &amp; safer</span>
                        ) : safetyDelta < 0 ? (
                          <span className="text-rose-300 font-medium">⚠ More caution zones</span>
                        ) : (
                          'Identical safety profile'
                        )}
                      </div>
                    </div>

                    {/* DIFFERENCE 2: FUEL COST */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        costDelta < 0
                          ? 'bg-emerald-950/40 border-emerald-500/40'
                          : costDelta > 0
                          ? 'bg-amber-950/30 border-amber-500/30'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                        <span className="flex items-center space-x-1">
                          <Fuel className="w-3 h-3 text-amber-400" />
                          <span>Cost Diff</span>
                        </span>
                        <span
                          className={`font-mono font-extrabold ${
                            costDelta < 0
                              ? 'text-emerald-400'
                              : costDelta > 0
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {costDelta < 0
                            ? `Saves Rs ${Math.abs(costDelta).toLocaleString()}`
                            : costDelta > 0
                            ? `+Rs ${costDelta.toLocaleString()}`
                            : 'Same Cost'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white mt-1 flex items-baseline space-x-1">
                        <span>NPR {calculateCost(alt).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          vs {calculateCost(primaryRoute).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isEV
                          ? `~${alt.evEstimate?.kwhRequired} kWh required`
                          : `${alt.fuelEstimate.liters} L fuel required`}
                      </div>
                    </div>

                    {/* DIFFERENCE 3: SCENIC VALUE */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        scenicDelta > 0
                          ? 'bg-purple-950/40 border-purple-500/40'
                          : scenicDelta < 0
                          ? 'bg-slate-900/60 border-slate-800'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                        <span className="flex items-center space-x-1">
                          <Mountain className="w-3 h-3 text-purple-400" />
                          <span>Scenic Diff</span>
                        </span>
                        <span
                          className={`font-mono font-extrabold ${
                            scenicDelta > 0 ? 'text-purple-400' : 'text-slate-400'
                          }`}
                        >
                          {scenicDelta > 0 ? `+${scenicDelta}★ Boost` : `${scenicDelta}★`}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-purple-300 mt-1 flex items-baseline space-x-1">
                        <span>★ {alt.scenicRating || 3.8}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          vs ★ {primaryRoute.scenicRating || 3.8}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {getScenicDetails(alt).label}
                      </div>
                    </div>
                  </div>

                  {/* Time & Distance Delta Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-[11px] text-slate-400">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>
                          {Math.floor(alt.estimatedTimeMinutes / 60)}h {alt.estimatedTimeMinutes % 60}m{' '}
                          {timeDelta !== 0 && (
                            <strong className={timeDelta < 0 ? 'text-emerald-400' : 'text-slate-400'}>
                              ({timeDelta > 0 ? `+${timeDelta}m` : `${timeDelta}m`})
                            </strong>
                          )}
                        </span>
                      </span>

                      <span className="flex items-center space-x-1">
                        <Compass className="w-3 h-3 text-emerald-400" />
                        <span>
                          {alt.totalDistanceKm} km{' '}
                          {distDelta !== 0 && (
                            <strong className={distDelta < 0 ? 'text-emerald-400' : 'text-slate-400'}>
                              ({distDelta > 0 ? `+${distDelta}km` : `${distDelta}km`})
                            </strong>
                          )}
                        </span>
                      </span>
                    </div>

                    <div className="text-emerald-400 font-semibold text-[11px]">
                      {safetyDelta >= 5 && scenicDelta > 0
                        ? '✨ Scenic & Safer Choice'
                        : costDelta < 0
                        ? '💰 Economical Choice'
                        : timeDelta < 0
                        ? '⚡ Fastest Expressway'
                        : 'Alternative Corridor'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. DEEP-DIVE DIFFERENTIAL BREAKDOWN BY DIMENSION */}
      <div className="space-y-4 pt-2">
        {/* Toggle Detailed Breakdown Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>
              Detailed Metric Breakdown: {activeDimension === 'all' ? 'All Dimensions' : `${activeDimension.toUpperCase()} Comparison`}
            </span>
          </div>
          <button
            onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
            className="text-xs text-slate-400 hover:text-white transition underline"
          >
            {showDetailedBreakdown ? 'Collapse Breakdown' : 'Expand Breakdown'}
          </button>
        </div>

        {showDetailedBreakdown && (
          <div className="space-y-4">
            {/* DIMENSION SECTION 1: SAFETY DIFFERENCES */}
            {(activeDimension === 'all' || activeDimension === 'safety') && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">1. Safety &amp; Risk Differences</h4>
                      <p className="text-[11px] text-slate-400">
                        Comparing road condition scores, pavement quality, accident blackspots, and mountain hazards.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                    DoR &amp; Police Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {routeOptions.map((opt, i) => {
                    const isPrimary = opt.id === primaryRoute.id;
                    const score = getSafetyScore(opt);
                    const blackspots = opt.safetyIndex?.activeBlackspots || [];
                    const roadQuality = opt.safetyIndex?.roadQualityAverage || opt.roadConditionScore;
                    const clearKm = opt.statusSummary?.clearKm || 0;
                    const cautionKm = opt.statusSummary?.cautionKm || 0;

                    return (
                      <div
                        key={opt.id || i}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                          isPrimary
                            ? 'bg-slate-900 border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : 'bg-slate-900/50 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold">{isPrimary ? 'PRIMARY' : `ALT ${i}`}</span>
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold"
                              style={{ color: opt.routeColor || '#38bdf8' }}
                            >
                              {opt.routeBadge}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white mt-1 truncate">{opt.routeName}</div>

                          {/* Safety Gauge Progress Bar */}
                          <div className="my-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[11px] text-slate-400">Safety Index:</span>
                              <span className="font-black text-emerald-400">{score}/100</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 80 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>

                          {/* Blackspots Count & Pavement */}
                          <div className="space-y-1 text-[11px] pt-2 border-t border-slate-800/80">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Blackspots:</span>
                              <span
                                className={`font-semibold ${
                                  blackspots.length === 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {blackspots.length === 0 ? '0 (Safe)' : `${blackspots.length} high-risk`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Clear Asphalt:</span>
                              <span className="text-slate-200 font-semibold">{clearKm} km ({Math.round((clearKm / opt.totalDistanceKm) * 100)}%)</span>
                            </div>

                            {cautionKm > 0 && (
                              <div className="flex items-center justify-between text-amber-400">
                                <span>Caution/Work:</span>
                                <span>{cautionKm} km</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {!isPrimary && (
                          <button
                            onClick={() => onSelectRoute(opt)}
                            className="mt-3 w-full py-1 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1"
                          >
                            <span>Choose for Safety</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DIMENSION SECTION 2: FUEL COST & TRANSIT OUTLAY DIFFERENCES */}
            {(activeDimension === 'all' || activeDimension === 'cost') && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Fuel className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">2. Fuel &amp; Transit Cost Differences</h4>
                      <p className="text-[11px] text-slate-400">
                        Detailed breakdown of fuel liters / EV energy, NOC prices, highway tolls, and running costs.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                    {isEV ? 'NEA EV Rate (Rs 15/kWh)' : isDiesel ? 'NOC Diesel (Rs 158/L)' : 'NOC Petrol (Rs 175/L)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {routeOptions.map((opt, i) => {
                    const isPrimary = opt.id === primaryRoute.id;
                    const totalCost = calculateCost(opt);
                    const baselineCost = calculateCost(primaryRoute);
                    const diffNpr = totalCost - baselineCost;
                    const costPerKm = (totalCost / Math.max(1, opt.totalDistanceKm)).toFixed(1);

                    return (
                      <div
                        key={opt.id || i}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                          isPrimary
                            ? 'bg-slate-900 border-amber-500/60 ring-1 ring-amber-500/30'
                            : 'bg-slate-900/50 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold">{isPrimary ? 'PRIMARY' : `ALT ${i}`}</span>
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold"
                              style={{ color: opt.routeColor || '#38bdf8' }}
                            >
                              {opt.routeBadge}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white mt-1 truncate">{opt.routeName}</div>

                          {/* Total Cost Display */}
                          <div className="my-2">
                            <div className="text-lg font-black text-amber-300 font-display">
                              NPR {totalCost.toLocaleString()}
                            </div>
                            {!isPrimary && (
                              <div className="text-[10px] font-semibold mt-0.5">
                                {diffNpr < 0 ? (
                                  <span className="text-emerald-400 font-bold">
                                    ▼ Saves NPR {Math.abs(diffNpr).toLocaleString()}
                                  </span>
                                ) : diffNpr > 0 ? (
                                  <span className="text-amber-400">
                                    ▲ +NPR {diffNpr.toLocaleString()} ({Math.round((diffNpr / baselineCost) * 100)}% more)
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Equal cost</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Itemized Fuel Specs */}
                          <div className="space-y-1 text-[11px] pt-2 border-t border-slate-800/80">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-400">Quantity:</span>
                              <span className="font-semibold">
                                {isEV ? `${opt.evEstimate?.kwhRequired} kWh` : `${opt.fuelEstimate.liters} Liters`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-400">Cost / km:</span>
                              <span className="font-mono text-slate-200 font-semibold">Rs {costPerKm}/km</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-400">Tolls / Taxes:</span>
                              <span className={opt.totalTollCostNpr > 0 ? 'text-white font-bold' : 'text-emerald-400'}>
                                {opt.totalTollCostNpr > 0 ? `Rs. ${opt.totalTollCostNpr}` : 'Free'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-400 text-[10px]">
                              <span>Climb factor:</span>
                              <span>+{opt.elevationGainM}m elevation</span>
                            </div>
                          </div>
                        </div>

                        {!isPrimary && (
                          <button
                            onClick={() => onSelectRoute(opt)}
                            className="mt-3 w-full py-1 bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1"
                          >
                            <span>Choose for Cost</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DIMENSION SECTION 3: SCENIC VALUE & TOURISM EXPERIENCE */}
            {(activeDimension === 'all' || activeDimension === 'scenic') && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Mountain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">3. Scenic Value &amp; Himalayan Vistas</h4>
                      <p className="text-[11px] text-slate-400">
                        Evaluating scenic ratings, photographic mountain vistas, river gorge panoramas, and high-altitude lookouts.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                    Sightseeing &amp; Vistas
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {routeOptions.map((opt, i) => {
                    const isPrimary = opt.id === primaryRoute.id;
                    const scenicInfo = getScenicDetails(opt);
                    const isScenicTop = metricsOverview.mostScenicId === opt.id;

                    return (
                      <div
                        key={opt.id || i}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                          isPrimary
                            ? 'bg-slate-900 border-purple-500/60 ring-1 ring-purple-500/30'
                            : 'bg-slate-900/50 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold">{isPrimary ? 'PRIMARY' : `ALT ${i}`}</span>
                            {isScenicTop && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                ★ TOP PICK
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-white mt-1 truncate">{opt.routeName}</div>

                          {/* Star Rating Display */}
                          <div className="my-2">
                            <div className="text-base font-black text-purple-300 flex items-center space-x-1">
                              <span>★ {scenicInfo.rating.toFixed(1)}</span>
                              <span className="text-[11px] font-normal text-slate-400">/ 5.0</span>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                              {scenicInfo.label}
                            </div>
                          </div>

                          {/* Scenic Highlights Bullet Points */}
                          <div className="space-y-1 text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
                            {scenicInfo.highlights.slice(0, 2).map((hl, hlIdx) => (
                              <div key={hlIdx} className="flex items-start space-x-1 text-slate-300">
                                <Camera className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                                <span>{hl}</span>
                              </div>
                            ))}

                            <div className="text-slate-500 pt-1 flex items-center justify-between text-[9px]">
                              <span>Summit Peak:</span>
                              <span className="text-slate-400 font-mono">{opt.maxElevationM}m ASL</span>
                            </div>
                          </div>
                        </div>

                        {!isPrimary && (
                          <button
                            onClick={() => onSelectRoute(opt)}
                            className="mt-3 w-full py-1 bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1"
                          >
                            <span>Choose for Scenery</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Smart Decision Recommendation Summary */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start space-x-2.5 text-slate-300">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">Route Decision Recommender: </span>
            <span>
              {alternativeRoutes.length > 0 ? (
                <>
                  Primary route offers a balanced travel time of{' '}
                  <strong className="text-cyan-300">
                    {Math.floor(primaryRoute.estimatedTimeMinutes / 60)}h {primaryRoute.estimatedTimeMinutes % 60}m
                  </strong>{' '}
                  with safety score of <strong className="text-emerald-300">{getSafetyScore(primaryRoute)}/100</strong>.
                  {alternativeRoutes.some((r) => getSafetyScore(r) > getSafetyScore(primaryRoute)) && (
                    <span className="text-emerald-300">
                      {' '}
                      You can upgrade to an alternative with higher road safety score (+
                      {Math.max(...alternativeRoutes.map((r) => getSafetyScore(r) - getSafetyScore(primaryRoute)))}{' '}
                      pts).
                    </span>
                  )}
                </>
              ) : (
                'Current calculated corridor is optimal for this journey.'
              )}
            </span>
          </div>
        </div>

        {onViewOnMap && (
          <button
            onClick={() => onViewOnMap()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-lg font-bold transition flex items-center space-x-1.5 shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View All on Map</span>
          </button>
        )}
      </div>
    </div>
  );
};
