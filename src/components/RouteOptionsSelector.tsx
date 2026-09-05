import React, { useState } from 'react';
import { RoutePlanResult, VehicleType, RoutePreference } from '../types';
import { RouteComparisonTable } from './RouteComparisonTable';
import { RouteComparisonView } from './RouteComparisonView';
import {
  Compass,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Mountain,
  Zap,
  Flame,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  MapPin,
  Car,
  Bike,
  Truck,
  LayoutGrid,
  Table,
  SlidersHorizontal,
  Scale,
} from 'lucide-react';

interface RouteOptionsSelectorProps {
  activePlan: RoutePlanResult;
  allOptions: RoutePlanResult[];
  selectedRouteId: string;
  vehicle: VehicleType;
  onSelectRoute: (route: RoutePlanResult) => void;
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
}

export const RouteOptionsSelector: React.FC<RouteOptionsSelectorProps> = ({
  activePlan,
  allOptions,
  selectedRouteId,
  vehicle,
  onSelectRoute,
  onViewOnMap,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'comparison' | 'table' | 'both'>('cards');
  const [showComparisonMatrix, setShowComparisonMatrix] = useState<boolean>(true);

  if (!allOptions || allOptions.length === 0) {
    return null;
  }

  // Find baseline fastest route for delta calculations
  const fastestPlan = allOptions.find((opt) => opt.preference === 'fastest') || allOptions[0];

  return (
    <div className="space-y-4">
      <div className="space-y-4 bg-slate-900/95 border border-slate-800 p-5 rounded-2xl shadow-xl">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md uppercase tracking-wider flex items-center space-x-1">
                <Layers className="w-3 h-3" />
                <span>Multi-Route Corridor Engine</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {allOptions.length} distinct {allOptions.length === 1 ? 'route' : 'routes'} available
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight mt-1 font-display">
              Compare &amp; Select Route Options
            </h3>
            <p className="text-xs text-slate-400">
              Evaluate fastest, shortest, safest, and scenic mountain corridors with real-time DoR data.
            </p>
          </div>

          {/* View Mode Switcher (Cards / Comparison View / Table / Both) */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0 shadow-sm">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                viewMode === 'cards' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                viewMode === 'comparison'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
              title="Comparison View highlighting Safety, Fuel Cost & Scenic differences"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Comparison View</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                viewMode === 'table' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Side-by-side comparative table"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Table Matrix</span>
            </button>
            <button
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                viewMode === 'both' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show both cards and comparative table"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>All</span>
            </button>
          </div>
        </div>

        {/* Route Selection Cards Grid */}
        {(viewMode === 'cards' || viewMode === 'both') && (
          <div
            className={`grid grid-cols-1 ${
              allOptions.length === 2 ? 'md:grid-cols-2' : allOptions.length >= 3 ? 'md:grid-cols-3' : 'grid-cols-1'
            } gap-3`}
          >
            {allOptions.map((option, idx) => {
              const isSelected = option.id === selectedRouteId || option.id === activePlan.id;
              const distDelta = option.totalDistanceKm - fastestPlan.totalDistanceKm;
              const timeDelta = option.estimatedTimeMinutes - fastestPlan.estimatedTimeMinutes;

              // Theme colors
              const cardColor = option.routeColor || '#38bdf8';
              const isFastest = option.preference === 'fastest';

              return (
                <div
                  key={option.id || idx}
                  onClick={() => onSelectRoute(option)}
                  className={`relative rounded-xl p-4 border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-950/90 shadow-lg ring-2'
                      : 'bg-slate-950/50 hover:bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                  style={{
                    borderColor: isSelected ? cardColor : undefined,
                    boxShadow: isSelected ? `0 0 20px ${cardColor}15` : undefined,
                  }}
                >
                  {/* Active Selection Pin Indicator */}
                  {isSelected && (
                    <div
                      className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-black text-slate-950 flex items-center space-x-1 shadow-md"
                      style={{ backgroundColor: cardColor }}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>ACTIVE ROUTE</span>
                    </div>
                  )}

                  {/* Card Header: Badge & Title */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                        style={{
                          backgroundColor: `${cardColor}15`,
                          color: cardColor,
                          borderColor: `${cardColor}40`,
                        }}
                      >
                        {option.routeBadge || `Option ${idx + 1}`}
                      </span>

                      {/* Scenic Stars */}
                      {option.scenicRating && (
                        <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-0.5">
                          <span>★</span>
                          <span>{option.scenicRating}</span>
                          <span className="text-[10px] text-slate-500 font-normal">scenic</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white mt-2 leading-snug">
                      {option.routeName || `Corridor Option ${idx + 1}`}
                    </h4>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {option.viaHighlights || option.alternateRouteSummary?.reason || 'Verified Highway Corridor'}
                    </p>
                  </div>

                  {/* Primary Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 my-3.5 pt-3 border-t border-slate-800/80">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <Compass className="w-3 h-3 text-emerald-400" />
                        <span>Distance</span>
                      </div>
                      <div className="text-base font-bold text-white mt-0.5 flex items-baseline space-x-1">
                        <span>{option.totalDistanceKm}</span>
                        <span className="text-[10px] text-slate-400 font-normal">km</span>
                      </div>
                      {!isFastest && distDelta !== 0 && (
                        <div
                          className={`text-[10px] font-medium ${
                            distDelta < 0 ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {distDelta < 0 ? `${distDelta} km shorter` : `+${distDelta} km`}
                        </div>
                      )}
                      {isFastest && <div className="text-[10px] text-cyan-400 font-medium">Standard baseline</div>}
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>Est. Time</span>
                      </div>
                      <div className="text-base font-bold text-cyan-400 mt-0.5">
                        {Math.floor(option.estimatedTimeMinutes / 60)}h {option.estimatedTimeMinutes % 60}m
                      </div>
                      {!isFastest && timeDelta !== 0 && (
                        <div
                          className={`text-[10px] font-medium ${
                            timeDelta < 0 ? 'text-cyan-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {timeDelta < 0 ? `${timeDelta}m faster` : `+${timeDelta}m longer`}
                        </div>
                      )}
                      {isFastest && <div className="text-[10px] text-emerald-400 font-medium">Fastest duration</div>}
                    </div>
                  </div>

                  {/* Secondary Specs: Road Quality & Elevation */}
                  <div className="space-y-1.5 text-[11px] border-t border-slate-800/60 pt-2 text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center space-x-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Safety Index:</span>
                      </span>
                      <span className="font-bold text-emerald-400">
                        {option.safetyIndex?.overallScore ?? option.roadConditionScore}/100
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Mountain className="w-3 h-3 text-purple-400" />
                        <span>Elevation Climb:</span>
                      </span>
                      <span className="text-purple-300 font-medium">
                        +{option.elevationGainM}m (Peak {option.maxElevationM}m)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center space-x-1">
                        {vehicle === 'electric_vehicle' ? (
                          <Zap className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <Flame className="w-3 h-3 text-amber-400" />
                        )}
                        <span>{vehicle === 'electric_vehicle' ? 'Energy Req:' : 'Est. Cost:'}</span>
                      </span>
                      <span className="text-amber-400 font-medium">
                        {vehicle === 'electric_vehicle'
                          ? `${option.evEstimate?.kwhRequired} kWh`
                          : `Rs. ${(option.fuelEstimate.costNpr + option.totalTollCostNpr).toLocaleString()}`}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-3.5 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRoute(option);
                      }}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          <span>Selected & Visualized</span>
                        </>
                      ) : (
                        <>
                          <span>Select & Switch Route</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Comparison View Module (Highlighting Safety, Fuel Cost & Scenic) */}
      {(viewMode === 'comparison' || viewMode === 'both') && (
        <RouteComparisonView
          activePlan={activePlan}
          allOptions={allOptions}
          selectedRouteId={selectedRouteId}
          vehicle={vehicle}
          onSelectRoute={onSelectRoute}
          onViewOnMap={onViewOnMap}
        />
      )}

      {/* Side-by-Side Comparative Table Matrix Component */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <RouteComparisonTable
          activePlan={activePlan}
          allOptions={allOptions}
          selectedRouteId={selectedRouteId}
          vehicle={vehicle}
          onSelectRoute={onSelectRoute}
          onViewOnMap={onViewOnMap}
        />
      )}
    </div>
  );
};

