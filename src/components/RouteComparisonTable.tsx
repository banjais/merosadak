import React, { useState, useMemo } from 'react';
import { RoutePlanResult, VehicleType } from '../types';
import {
  Clock,
  Zap,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Mountain,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Trophy,
  DollarSign,
  Gauge,
  SlidersHorizontal,
  Info,
  Check,
  Eye,
  Percent,
} from 'lucide-react';

interface RouteComparisonTableProps {
  activePlan: RoutePlanResult;
  allOptions: RoutePlanResult[];
  selectedRouteId: string;
  vehicle: VehicleType;
  onSelectRoute: (route: RoutePlanResult) => void;
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
  className?: string;
}

type MetricCategory = 'all' | 'time' | 'cost' | 'safety' | 'terrain';

export const RouteComparisonTable: React.FC<RouteComparisonTableProps> = ({
  activePlan,
  allOptions,
  selectedRouteId,
  vehicle,
  onSelectRoute,
  onViewOnMap,
  className = '',
}) => {
  const [filterCategory, setFilterCategory] = useState<MetricCategory>('all');
  const [highlightBest, setHighlightBest] = useState<boolean>(true);

  // Calculate Best-in-Class winners for highlighting and decision pills
  const winners = useMemo(() => {
    if (!allOptions || allOptions.length === 0) return null;

    // 1. Fastest: lowest estimatedTimeMinutes
    const fastest = [...allOptions].sort((a, b) => a.estimatedTimeMinutes - b.estimatedTimeMinutes)[0];
    const slowest = [...allOptions].sort((a, b) => b.estimatedTimeMinutes - a.estimatedTimeMinutes)[0];
    const timeSavedMinutes = slowest.estimatedTimeMinutes - fastest.estimatedTimeMinutes;

    // 2. Cheapest: lowest total trip cost (fuel/energy + toll)
    const getTripCost = (opt: RoutePlanResult) => {
      if (vehicle === 'electric_vehicle') {
        // Average commercial DC fast charging rate ~Rs 12/kWh in Nepal
        const evCost = (opt.evEstimate?.kwhRequired || (opt.totalDistanceKm * 0.18)) * 12;
        return evCost + opt.totalTollCostNpr;
      }
      return opt.fuelEstimate.costNpr + opt.totalTollCostNpr;
    };

    const cheapest = [...allOptions].sort((a, b) => getTripCost(a) - getTripCost(b))[0];
    const mostExpensive = [...allOptions].sort((a, b) => getTripCost(b) - getTripCost(a))[0];
    const costSavedNpr = Math.round(getTripCost(mostExpensive) - getTripCost(cheapest));

    // 3. Safest: highest safety index score (or road condition score) and lowest blackspots
    const getSafetyScore = (opt: RoutePlanResult) => opt.safetyIndex?.overallScore ?? opt.roadConditionScore;
    const safest = [...allOptions].sort((a, b) => {
      const scoreDiff = getSafetyScore(b) - getSafetyScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      const bSpots = b.safetyIndex?.activeBlackspots?.length || 0;
      const aSpots = a.safetyIndex?.activeBlackspots?.length || 0;
      return aSpots - bSpots;
    })[0];

    // 4. Shortest Distance
    const shortest = [...allOptions].sort((a, b) => a.totalDistanceKm - b.totalDistanceKm)[0];

    // 5. Most Scenic
    const mostScenic = [...allOptions].sort((a, b) => (b.scenicRating || 3) - (a.scenicRating || 3))[0];

    // Max values for calculating relative visual progress bars
    const maxTime = Math.max(...allOptions.map((o) => o.estimatedTimeMinutes));
    const minTime = Math.min(...allOptions.map((o) => o.estimatedTimeMinutes));

    const maxCost = Math.max(...allOptions.map((o) => getTripCost(o)));
    const minCost = Math.min(...allOptions.map((o) => getTripCost(o)));

    return {
      fastestId: fastest.id,
      fastestTime: fastest.estimatedTimeMinutes,
      timeSavedMinutes,
      cheapestId: cheapest.id,
      cheapestCost: getTripCost(cheapest),
      costSavedNpr,
      safestId: safest.id,
      safestScore: getSafetyScore(safest),
      shortestId: shortest.id,
      mostScenicId: mostScenic.id,
      maxTime,
      minTime,
      maxCost,
      minCost,
      getTripCost,
      getSafetyScore,
    };
  }, [allOptions, vehicle]);

  if (!allOptions || allOptions.length === 0 || !winners) {
    return null;
  }

  return (
    <div className={`bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 ${className}`} id="route-comparative-decision-table">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[10px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-md uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Side-by-Side Evaluation</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Comparing {allOptions.length} corridor alternatives
            </span>
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight mt-1 font-display flex items-center space-x-2">
            <span>Route Decision & Trade-off Matrix</span>
          </h3>
          <p className="text-xs text-slate-400">
            Compare time, expense, road surface, and crash safety scores side-by-side to choose the optimal Nepal highway corridor.
          </p>
        </div>

        {/* Filter Category & Highlight Best Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Tabs */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center space-x-1 text-xs">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterCategory === 'all' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Metrics
            </button>
            <button
              onClick={() => setFilterCategory('time')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                filterCategory === 'time' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Time</span>
            </button>
            <button
              onClick={() => setFilterCategory('cost')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                filterCategory === 'cost' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>Cost</span>
            </button>
            <button
              onClick={() => setFilterCategory('safety')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                filterCategory === 'safety' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Safety</span>
            </button>
          </div>

          {/* Winner Highlights Toggle */}
          <button
            onClick={() => setHighlightBest(!highlightBest)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
              highlightBest
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle best-in-class green/gold highlights"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Highlight Top Picks</span>
          </button>
        </div>
      </div>

      {/* Decision Summary Highlights (Key Takeaways) */}
      {winners && allOptions.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Fastest Winner Card */}
          <div
            onClick={() => {
              const opt = allOptions.find((o) => o.id === winners.fastestId);
              if (opt) onSelectRoute(opt);
            }}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              winners.fastestId === selectedRouteId
                ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30'
                : 'bg-slate-950/60 hover:bg-slate-950/90 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-extrabold text-cyan-400 tracking-wider flex items-center space-x-1">
                  <span>⚡ FASTEST TIME</span>
                  {winners.fastestId === selectedRouteId && <Check className="w-3 h-3 text-cyan-400" />}
                </div>
                <div className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[160px]">
                  {allOptions.find((o) => o.id === winners.fastestId)?.routeName}
                </div>
                <div className="text-[11px] text-slate-400">
                  {Math.floor(winners.fastestTime / 60)}h {winners.fastestTime % 60}m
                  {winners.timeSavedMinutes > 0 && (
                    <span className="text-emerald-400 font-bold ml-1">
                      (saves {winners.timeSavedMinutes >= 60 ? `${Math.floor(winners.timeSavedMinutes / 60)}h ${winners.timeSavedMinutes % 60}m` : `${winners.timeSavedMinutes}m`})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </div>

          {/* Cheapest Winner Card */}
          <div
            onClick={() => {
              const opt = allOptions.find((o) => o.id === winners.cheapestId);
              if (opt) onSelectRoute(opt);
            }}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              winners.cheapestId === selectedRouteId
                ? 'bg-amber-950/40 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                : 'bg-slate-950/60 hover:bg-slate-950/90 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider flex items-center space-x-1">
                  <span>💰 LOWEST COST</span>
                  {winners.cheapestId === selectedRouteId && <Check className="w-3 h-3 text-amber-400" />}
                </div>
                <div className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[160px]">
                  {allOptions.find((o) => o.id === winners.cheapestId)?.routeName}
                </div>
                <div className="text-[11px] text-slate-400">
                  {vehicle === 'electric_vehicle'
                    ? `~${allOptions.find((o) => o.id === winners.cheapestId)?.evEstimate?.kwhRequired} kWh`
                    : `Rs. ${winners.cheapestCost.toLocaleString()}`}
                  {winners.costSavedNpr > 0 && vehicle !== 'electric_vehicle' && (
                    <span className="text-emerald-400 font-bold ml-1">(saves Rs. {winners.costSavedNpr.toLocaleString()})</span>
                  )}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </div>

          {/* Safest Winner Card */}
          <div
            onClick={() => {
              const opt = allOptions.find((o) => o.id === winners.safestId);
              if (opt) onSelectRoute(opt);
            }}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              winners.safestId === selectedRouteId
                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                : 'bg-slate-950/60 hover:bg-slate-950/90 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider flex items-center space-x-1">
                  <span>🛡️ SAFEST CORRIDOR</span>
                  {winners.safestId === selectedRouteId && <Check className="w-3 h-3 text-emerald-400" />}
                </div>
                <div className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[160px]">
                  {allOptions.find((o) => o.id === winners.safestId)?.routeName}
                </div>
                <div className="text-[11px] text-slate-400">
                  Safety Index: <strong className="text-emerald-400 font-bold">{winners.safestScore}/100</strong>
                  <span className="text-slate-500 ml-1">
                    ({allOptions.find((o) => o.id === winners.safestId)?.safetyIndex?.activeBlackspots?.length || 0} blackspots)
                  </span>
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </div>
        </div>
      )}

      {/* Main Comparative Side-by-Side Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 shadow-inner">
        <table className="w-full text-left text-xs border-collapse min-w-[620px]">
          {/* Table Header: Corridor Profiles & Selection Triggers */}
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950">
              <th className="p-3.5 font-bold text-slate-300 w-[190px] sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Evaluation Matrix</span>
                </div>
              </th>

              {allOptions.map((opt, idx) => {
                const isSelected = opt.id === selectedRouteId || opt.id === activePlan.id;
                const cardColor = opt.routeColor || '#38bdf8';

                return (
                  <th
                    key={opt.id || idx}
                    className={`p-3.5 font-bold transition ${
                      isSelected ? 'bg-slate-900/90 border-t-2' : 'hover:bg-slate-900/40'
                    }`}
                    style={{ borderTopColor: isSelected ? cardColor : 'transparent' }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-extrabold border"
                          style={{
                            backgroundColor: `${cardColor}20`,
                            color: cardColor,
                            borderColor: `${cardColor}50`,
                          }}
                        >
                          {opt.routeBadge || `Option ${idx + 1}`}
                        </span>

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-slate-950 flex items-center space-x-0.5 shadow-sm">
                            <Check className="w-2.5 h-2.5" />
                            <span>ACTIVE</span>
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-black text-white leading-tight">
                        {opt.routeName || `Option ${idx + 1}`}
                      </div>

                      <div className="text-[10px] text-slate-400 font-normal line-clamp-1">
                        {opt.viaHighlights || opt.alternateRouteSummary?.reason || 'Verified Corridor'}
                      </div>

                      {/* Select & Switch Button */}
                      <button
                        onClick={() => onSelectRoute(opt)}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 shadow-sm ${
                          isSelected
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-white" />
                            <span>Selected</span>
                          </>
                        ) : (
                          <>
                            <span>Select Route</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                          </>
                        )}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body: Segmented Metrics */}
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {/* SECTION 1: TIME & SPEED METRICS */}
            {(filterCategory === 'all' || filterCategory === 'time') && (
              <>
                <tr className="bg-slate-900/60">
                  <td
                    colSpan={allOptions.length + 1}
                    className="py-2 px-3 text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Time & Speed Performance</span>
                  </td>
                </tr>

                {/* Metric: Estimated Drive Time */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center space-x-1.5">
                      <span>Estimated Drive Time</span>
                    </div>
                    <div className="text-[10px] text-slate-500">Live congestion adjusted</div>
                  </td>
                  {allOptions.map((opt, i) => {
                    const isFastest = winners?.fastestId === opt.id;
                    const delta = opt.estimatedTimeMinutes - (winners?.fastestTime || 0);

                    return (
                      <td key={i} className="p-3 font-semibold">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-black ${isFastest ? 'text-cyan-300' : 'text-white'}`}>
                            {Math.floor(opt.estimatedTimeMinutes / 60)}h {opt.estimatedTimeMinutes % 60}m
                          </span>
                          {highlightBest && isFastest && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              ⚡ FASTEST
                            </span>
                          )}
                        </div>

                        {/* Relative Time Delta */}
                        {!isFastest && delta > 0 && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                            +{delta >= 60 ? `${Math.floor(delta / 60)}h ${delta % 60}m` : `${delta}m`} longer
                          </div>
                        )}

                        {/* Visual Time Bar */}
                        {winners && (
                          <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isFastest ? 'bg-cyan-400' : 'bg-slate-600'}`}
                              style={{
                                width: `${Math.max(20, Math.min(100, (winners.minTime / opt.estimatedTimeMinutes) * 100))}%`,
                              }}
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Metric: Average Transit Speed */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Average Travel Speed</span>
                    <div className="text-[10px] text-slate-500">Distance ÷ Duration</div>
                  </td>
                  {allOptions.map((opt, i) => {
                    const avgSpeed = Math.round(opt.totalDistanceKm / (opt.estimatedTimeMinutes / 60));
                    return (
                      <td key={i} className="p-3 font-semibold text-slate-200">
                        <div className="flex items-center space-x-1.5">
                          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{avgSpeed} km/h</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Metric: Road Obstructions & Incidents */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Active Incident Delays</span>
                    <div className="text-[10px] text-slate-500">Live DoR advisories</div>
                  </td>
                  {allOptions.map((opt, i) => (
                    <td key={i} className="p-3">
                      {opt.incidentsOnRoute.length > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>{opt.incidentsOnRoute.length} notice(s)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Clear / Free flowing</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* SECTION 2: COST, FUEL & TOLL CHARGES */}
            {(filterCategory === 'all' || filterCategory === 'cost') && (
              <>
                <tr className="bg-slate-900/60">
                  <td
                    colSpan={allOptions.length + 1}
                    className="py-2 px-3 text-[11px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cost, Fuel & Highway Tolls</span>
                  </td>
                </tr>

                {/* Metric: Total Estimated Trip Cost */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Total Trip Cost</span>
                    <div className="text-[10px] text-slate-500">
                      {vehicle === 'electric_vehicle' ? 'Energy + Tolls' : 'Fuel + Tolls'}
                    </div>
                  </td>
                  {allOptions.map((opt, i) => {
                    const cost = winners?.getTripCost(opt) || 0;
                    const isCheapest = winners?.cheapestId === opt.id;
                    const deltaCost = Math.round(cost - (winners?.cheapestCost || 0));

                    return (
                      <td key={i} className="p-3 font-semibold">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-black ${isCheapest ? 'text-amber-300' : 'text-white'}`}>
                            {vehicle === 'electric_vehicle' ? `~${opt.evEstimate?.kwhRequired} kWh` : `Rs. ${cost.toLocaleString()}`}
                          </span>
                          {highlightBest && isCheapest && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              💰 CHEAPEST
                            </span>
                          )}
                        </div>

                        {!isCheapest && deltaCost > 0 && vehicle !== 'electric_vehicle' && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                            +Rs. {deltaCost.toLocaleString()} ({Math.round((deltaCost / (winners?.cheapestCost || 1)) * 100)}% more)
                          </div>
                        )}

                        {/* Visual Cost Bar */}
                        {winners && (
                          <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isCheapest ? 'bg-amber-400' : 'bg-slate-600'}`}
                              style={{
                                width: `${Math.max(20, Math.min(100, (winners.minCost / cost) * 100))}%`,
                              }}
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Metric: Fuel Consumption (Liters) or EV kWh */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>{vehicle === 'electric_vehicle' ? 'Energy Requirement' : 'Fuel Consumption'}</span>
                    <div className="text-[10px] text-slate-500">
                      {vehicle === 'electric_vehicle' ? 'Battery & elevation adjusted' : `Est. ${optMileage(vehicle)} km/L`}
                    </div>
                  </td>
                  {allOptions.map((opt, i) => (
                    <td key={i} className="p-3 text-slate-300 font-medium">
                      {vehicle === 'electric_vehicle' ? (
                        <div className="flex items-center space-x-1.5 text-cyan-300">
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{opt.evEstimate?.kwhRequired || Math.round(opt.totalDistanceKm * 0.18)} kWh</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {opt.fuelEstimate.liters} L <span className="text-[10px] text-slate-500 font-normal">(Rs. {opt.fuelEstimate.costNpr.toLocaleString()})</span>
                          </span>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Metric: Toll Plazas & Road Taxes */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Road Tolls & Charges</span>
                    <div className="text-[10px] text-slate-500">Fast-track / highway booths</div>
                  </td>
                  {allOptions.map((opt, i) => (
                    <td key={i} className="p-3 text-slate-300">
                      {opt.totalTollCostNpr > 0 ? (
                        <span className="font-semibold text-white">Rs. {opt.totalTollCostNpr}</span>
                      ) : (
                        <span className="text-emerald-400 font-medium">Free (No Tolls)</span>
                      )}
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* SECTION 3: SAFETY INDEX & RISK ASSESSMENT */}
            {(filterCategory === 'all' || filterCategory === 'safety') && (
              <>
                <tr className="bg-slate-900/60">
                  <td
                    colSpan={allOptions.length + 1}
                    className="py-2 px-3 text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Highway Safety Index & Road Quality</span>
                  </td>
                </tr>

                {/* Metric: Highway Safety Index Score */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Highway Safety Score</span>
                    <div className="text-[10px] text-slate-500">Pavement + Crash History (0-100)</div>
                  </td>
                  {allOptions.map((opt, i) => {
                    const score = winners?.getSafetyScore(opt) || opt.roadConditionScore;
                    const isSafest = winners?.safestId === opt.id;
                    const color =
                      score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

                    return (
                      <td key={i} className="p-3 font-semibold">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-black" style={{ color }}>
                            {score} / 100
                          </span>
                          {highlightBest && isSafest && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              🛡️ SAFEST
                            </span>
                          )}
                        </div>

                        {/* Safety Tier Pill */}
                        <div className="text-[10px] font-medium text-slate-400 capitalize mt-0.5">
                          {opt.safetyIndex?.tierLabel || (score >= 80 ? 'High Safety' : score >= 60 ? 'Moderate Caution' : 'Elevated Risk')}
                        </div>

                        {/* Visual Safety Bar */}
                        <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: color,
                              width: `${score}%`,
                            }}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Metric: Road Surface Quality Score */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Road Surface Quality</span>
                    <div className="text-[10px] text-slate-500">Pavement smoothness (0-100)</div>
                  </td>
                  {allOptions.map((opt, i) => (
                    <td key={i} className="p-3 font-semibold text-slate-200">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-emerald-400 font-bold">{opt.safetyIndex?.roadQualityAverage || opt.roadConditionScore}/100</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {opt.statusSummary?.clearKm || 0} km clear asphalt
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Metric: Known Accident Blackspots along Route */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Active Blackspot Zones</span>
                    <div className="text-[10px] text-slate-500">Nepal Police & DoR verified</div>
                  </td>
                  {allOptions.map((opt, i) => {
                    const blackspots = opt.safetyIndex?.activeBlackspots || [];
                    const count = blackspots.length;

                    return (
                      <td key={i} className="p-3">
                        {count === 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>0 Blackspots (Safe)</span>
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 inline-flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>{count} Blackspot{count > 1 ? 's' : ''}</span>
                            </span>
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {blackspots.map((b) => b.name).join(', ')}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* SECTION 4: DISTANCE, ELEVATION & SCENIC */}
            {(filterCategory === 'all' || filterCategory === 'terrain') && (
              <>
                <tr className="bg-slate-900/60">
                  <td
                    colSpan={allOptions.length + 1}
                    className="py-2 px-3 text-[11px] font-extrabold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5"
                  >
                    <Mountain className="w-3.5 h-3.5 text-purple-400" />
                    <span>Distance & Mountain Geography</span>
                  </td>
                </tr>

                {/* Metric: Total Distance */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Total Distance</span>
                    <div className="text-[10px] text-slate-500">Kilometers</div>
                  </td>
                  {allOptions.map((opt, i) => {
                    const isShortest = winners?.shortestId === opt.id;
                    return (
                      <td key={i} className="p-3 font-semibold text-white">
                        <div className="flex items-center space-x-1.5">
                          <Compass className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{opt.totalDistanceKm} km</span>
                          {highlightBest && isShortest && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              SHORTEST
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Metric: Elevation Climb & Peak */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Climb & Summit Peak</span>
                    <div className="text-[10px] text-slate-500">Total vertical elevation</div>
                  </td>
                  {allOptions.map((opt, i) => (
                    <td key={i} className="p-3 font-medium text-purple-300">
                      <div>+{opt.elevationGainM} m climb</div>
                      <div className="text-[10px] text-slate-400">Peak: {opt.maxElevationM} m ASL</div>
                    </td>
                  ))}
                </tr>

                {/* Metric: Scenic Rating */}
                <tr className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-400 font-medium sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <span>Scenic & Panorama Rating</span>
                    <div className="text-[10px] text-slate-500">Himalayan vistas & rivers</div>
                  </td>
                  {allOptions.map((opt, i) => {
                    const isScenicWinner = winners?.mostScenicId === opt.id;
                    return (
                      <td key={i} className="p-3 font-bold text-amber-400">
                        <div className="flex items-center space-x-1">
                          <span>★ {opt.scenicRating || 4.0} / 5.0</span>
                          {highlightBest && isScenicWinner && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              TOP SCENIC
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* ACTION ROW: SELECT CORRIDOR */}
            <tr className="bg-slate-950">
              <td className="p-3 text-slate-400 font-bold sticky left-0 bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                <span>Select & Activate</span>
              </td>
              {allOptions.map((opt, i) => {
                const isSelected = opt.id === selectedRouteId || opt.id === activePlan.id;
                return (
                  <td key={i} className="p-3">
                    <button
                      onClick={() => onSelectRoute(opt)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md ${
                        isSelected
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          <span>Active Route</span>
                        </>
                      ) : (
                        <>
                          <span>Choose Option</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Interactive Helper Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
        <div className="flex items-center space-x-2">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            Safety scores are dynamically calculated using DoR pavement condition metrics (45%), historic accident density (45%), and live weather/hazard feeds (10%).
          </span>
        </div>

        {onViewOnMap && (
          <button
            onClick={() => onViewOnMap()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 rounded-lg font-semibold transition flex items-center space-x-1 shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Focus on Map</span>
          </button>
        )}
      </div>
    </div>
  );
};

function optMileage(vehicle: VehicleType): number {
  switch (vehicle) {
    case 'motorbike':
      return 35;
    case 'car':
      return 14;
    case 'suv_4wd':
      return 9.5;
    case 'bus_truck':
      return 4.2;
    default:
      return 14;
  }
}
