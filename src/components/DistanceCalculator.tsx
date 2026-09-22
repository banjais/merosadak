import React, { useState } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, calculateDirectDistanceKm } from '../utils/routeOptimizer';
import { CityNode } from '../types';
import { ArrowRight, ArrowUpDown, MapPin, ChevronDown, Award, Route, Database, Clock, ExternalLink } from 'lucide-react';

interface DistanceCalculatorProps {
  onPlanFullRoute?: (originId: string, destId: string) => void;
}

export const DistanceCalculator: React.FC<DistanceCalculatorProps> = ({ onPlanFullRoute }) => {
  const [originId, setOriginId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [matrixFilter, setMatrixFilter] = useState<string>('');
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [originSearch, setOriginSearch] = useState<string>('');
  const [destSearch, setDestSearch] = useState<string>('');
  // Distance Calculator = DoR highway graph only (verified nodes).
  // Trip planner may use expanded / mixed places; this tool does not.
  const verifiedCities = CITIES_AND_JUNCTIONS;
  const allCities = verifiedCities;

  const origin = originId ? allCities.find((c) => c.id === originId) : undefined;
  const destination = destId ? allCities.find((c) => c.id === destId) : undefined;

  const normalizedOriginSearch = originSearch.trim().toLowerCase();
  const normalizedDestSearch = destSearch.trim().toLowerCase();
  const filterVerified = (q: string, raw: string) =>
    q
      ? allCities
          .filter(
            (city) =>
              city.name.toLowerCase().includes(q) ||
              city.district.toLowerCase().includes(q) ||
              city.nepaliName.includes(raw)
          )
          .slice(0, 25)
      : [];
  const filteredOriginCities = filterVerified(normalizedOriginSearch, originSearch.trim());
  const filteredDestCities = filterVerified(normalizedDestSearch, destSearch.trim());

  const swapCities = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
  };

  const routeResult = originId && destId && originId !== destId ? (() => {
    const originCity = allCities.find((c) => c.id === originId);
    const destCity = allCities.find((c) => c.id === destId);
    if (!originCity || !destCity) return null;
    const result = findOptimizedRoute(
      originCity.id,
      destCity.id,
      'fastest',
      'car',
      {},
      originCity,
      destCity
    );
    // Verified only: reject aerial / non-network approximations
    if (!result) return null;
    const certified = result.roadTierBreakdown?.certifiedPercent ?? 0;
    const isAerial =
      result.routeBadge?.includes('Approximate') ||
      result.routeName?.toLowerCase().includes('aerial') ||
      certified <= 0;
    if (isAerial) return null;
    return result;
  })() : null;
  const verifiedPairMissing =
    !!(originId && destId && originId !== destId && origin && destination && !routeResult);
  const aerialDistance = origin && destination ? calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng) : 0;

  const keyHubs = CITIES_AND_JUNCTIONS.filter((c) => c.isMajorHub);

  return (
    <div className="space-y-6">
      {/* Interactive Pair Calculator Card */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 font-bold text-emerald-300">
            DoR verified only
          </span>
          <span className="text-slate-400">
            {allCities.length} highway nodes · road length from official network graph
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Origin Selector - Dropdown Button */}
          <div className="md:col-span-5 space-y-1.5 relative">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Origin Location</span>
            </label>
            <div className="relative">
              <button
                onClick={() => {
                  if (!originDropdownOpen) setOriginSearch('');
                  setOriginDropdownOpen(!originDropdownOpen);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition flex items-center justify-between"
                aria-expanded={originDropdownOpen}
              >
                <span>{origin ? `${origin.name} (${origin.district} - ${origin.elevationM}m)` : 'Select origin...'}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${originDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {originDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                  <div className="sticky top-0 z-10 p-2 bg-slate-950 border-b border-slate-800">
                    <input
                      type="text"
                      value={originSearch}
                      onChange={(e) => setOriginSearch(e.target.value)}
                      placeholder="Type to search..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredOriginCities.length > 0 ? (
                      filteredOriginCities.map((city) => (
                            <button
                            key={city.id}
                            onClick={() => { setOriginId(city.id); setOriginSearch(''); setOriginDropdownOpen(false); }}
                            className={`w-full px-3.5 py-2.5 text-left text-sm font-medium transition flex items-center justify-between ${
                              originId === city.id
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'text-slate-100 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="truncate">{city.name}</span>
                              {city.cityType && (
                                <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 align-middle">
                                  {city.cityType}
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500 font-normal text-xs whitespace-nowrap">
                              ({city.district} - {city.elevationM}m)
                            </span>
                          </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-slate-500">
                        No matching locations found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-2 flex justify-center pt-4 md:pt-0">
            <button
              onClick={swapCities}
              title="Swap origin and destination"
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition shadow-md active:scale-95"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

          {/* Destination Selector - Dropdown Button */}
          <div className="md:col-span-5 space-y-1.5 relative">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Destination Location</span>
            </label>
            <div className="relative">
              <button
                onClick={() => {
                  if (!destDropdownOpen) setDestSearch('');
                  setDestDropdownOpen(!destDropdownOpen);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition flex items-center justify-between"
                aria-expanded={destDropdownOpen}
              >
                <span>{destination ? `${destination.name} (${destination.district} - ${destination.elevationM}m)` : 'Select destination...'}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${destDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {destDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                  <div className="sticky top-0 z-10 p-2 bg-slate-950 border-b border-slate-800">
                    <input
                      type="text"
                      value={destSearch}
                      onChange={(e) => setDestSearch(e.target.value)}
                      placeholder="Type to search..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredDestCities.length > 0 ? (
                      filteredDestCities.map((city) => (
                            <button
                            key={city.id}
                            onClick={() => { setDestId(city.id); setDestSearch(''); setDestDropdownOpen(false); }}
                            className={`w-full px-3.5 py-2.5 text-left text-sm font-medium transition flex items-center justify-between ${
                              destId === city.id
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'text-slate-100 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="truncate">{city.name}</span>
                              {city.cityType && (
                                <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 align-middle">
                                  {city.cityType}
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500 font-normal text-xs whitespace-nowrap">
                              ({city.district} - {city.elevationM}m)
                            </span>
                          </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-slate-500">
                        No matching locations found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calculation Result Display */}
        {verifiedPairMissing && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-bold">No verified highway route</p>
            <p className="mt-1 text-xs text-amber-200/90">
              These two points are not linked on the DoR network graph used here.
              Use <span className="font-semibold">Trip planner</span> for mixed places, or pick another pair from the verified list.
            </p>
          </div>
        )}
        {routeResult ? (
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <span className="text-lg font-bold text-white">{origin.name}</span>
                <ArrowRight className="w-5 h-5 text-emerald-400" />
                <span className="text-lg font-bold text-white">{destination.name}</span>
              </div>
              {onPlanFullRoute && (
                <button
                  type="button"
                  onClick={() => onPlanFullRoute(originId, destId)}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 self-start sm:self-auto"
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Open in Route Planner</span>
                </button>
              )}
            </div>

            {/* 4-Card Multi-Metric Grid (International Standard) */}
            {(() => {
              const detourPercent = aerialDistance > 0
                ? Math.round(((routeResult.totalDistanceKm - aerialDistance) / aerialDistance) * 100)
                : 0;
              const circuityRatio = routeResult.circuityFactor
                ? routeResult.circuityFactor.toFixed(2)
                : aerialDistance > 0
                ? (routeResult.totalDistanceKm / aerialDistance).toFixed(2)
                : '1.00';

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Card 1: Road Driving Distance (Primary Hero) */}
                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>Road Driving Distance</span>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Primary</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-1 font-display">
                      {routeResult.totalDistanceKm} <span className="text-sm font-normal text-slate-400">km</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                      <span>⏱️ ~{Math.floor(routeResult.estimatedTimeMinutes / 60)}h {routeResult.estimatedTimeMinutes % 60}m driving</span>
                    </div>
                  </div>

                  {/* Card 2: Direct Aerial Distance */}
                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>Direct (Aerial) Line</span>
                      <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">Line-of-Sight</span>
                    </div>
                    <div className="text-2xl font-black text-cyan-400 mt-1 font-display">
                      {aerialDistance} <span className="text-sm font-normal text-slate-400">km</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      As the crow flies (geodesic)
                    </div>
                  </div>

                  {/* Card 3: Mountain Circuity / Detour Factor */}
                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>Mountain Detour Ratio</span>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Circuity</span>
                    </div>
                    <div className="text-2xl font-black text-amber-400 mt-1 font-display">
                      +{detourPercent}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {circuityRatio}× terrain winding index
                    </div>
                  </div>

                  {/* Card 4: Elevation Delta */}
                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>Elevation Delta</span>
                      <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">ASL</span>
                    </div>
                    <div className="text-2xl font-black text-purple-400 mt-1 font-display flex items-baseline space-x-1">
                      <span>{destination.elevationM - origin.elevationM > 0 ? `+${destination.elevationM - origin.elevationM}` : destination.elevationM - origin.elevationM}</span>
                      <span className="text-sm font-normal text-slate-400">m</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {origin.elevationM}m ➔ {destination.elevationM}m
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Road Network Composition & Multi-Tier Classification */}
            {routeResult.roadTierBreakdown && (
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Road Network Certification Composition</span>
                  </span>
                  <span className="text-emerald-400 font-bold text-[11px]">
                    {routeResult.roadTierBreakdown.certifiedPercent}% DoR Certified Highway
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${routeResult.roadTierBreakdown.certifiedPercent}%` }}
                    title={`DoR Certified: ${routeResult.roadTierBreakdown.highwayKm} km`}
                  />
                  {routeResult.roadTierBreakdown.certifiedPercent < 100 && (
                    <div
                      className="bg-cyan-500 h-full transition-all"
                      style={{ width: `${100 - routeResult.roadTierBreakdown.certifiedPercent}%` }}
                      title={`Provincial / Palika / Link Roads: ${routeResult.roadTierBreakdown.localKm + routeResult.roadTierBreakdown.provincialKm + routeResult.roadTierBreakdown.communityKm} km`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Federal Highway: <strong>{routeResult.roadTierBreakdown.highwayKm} km</strong></span>
                  </span>
                  {(routeResult.roadTierBreakdown.provincialKm > 0 || routeResult.roadTierBreakdown.localKm > 0) && (
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Local / Palika Links: <strong>{routeResult.roadTierBreakdown.provincialKm + routeResult.roadTierBreakdown.localKm} km</strong></span>
                    </span>
                  )}
                  {routeResult.roadTierBreakdown.communityKm > 0 && (
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      <span>Unpaved Track: <strong>{routeResult.roadTierBreakdown.communityKm} km</strong></span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Step summary of highways traversed with Certification Badges */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Corridors Traversed & Road Tiers:
              </div>
              <div className="flex flex-wrap gap-2">
                {routeResult.steps.map((st, i) => (
                  <div key={i} className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    <span className="text-slate-200 font-medium">{st.instruction}</span>
                    <span className="text-slate-500 font-semibold">({st.distanceKm} km)</span>
                    {st.certificationBadge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        st.roadClassification === 'national_highway'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : st.roadClassification === 'provincial_feeder'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : st.roadClassification === 'community_track'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {st.certificationBadge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Unified Data Source & Road Network Certification Footer */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-3 space-y-2">
              {/* Road Network Certification Composition */}
              {routeResult.roadTierBreakdown && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center space-x-1.5">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Road Network Certification Composition</span>
                    </span>
                    <span className="text-emerald-400 font-bold text-[11px]">
                      {routeResult.roadTierBreakdown.certifiedPercent}% DoR Certified Highway
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${routeResult.roadTierBreakdown.certifiedPercent}%` }}
                      title={`DoR Certified: ${routeResult.roadTierBreakdown.highwayKm} km`}
                    />
                    {routeResult.roadTierBreakdown.certifiedPercent < 100 && (
                      <div
                        className="bg-cyan-500 h-full transition-all"
                        style={{ width: `${100 - routeResult.roadTierBreakdown.certifiedPercent}%` }}
                        title={`Provincial / Palika / Link Roads: ${routeResult.roadTierBreakdown.localKm + routeResult.roadTierBreakdown.provincialKm + routeResult.roadTierBreakdown.communityKm} km`}
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      <span>Federal Highway: <strong>{routeResult.roadTierBreakdown.highwayKm} km</strong></span>
                    </span>
                    {(routeResult.roadTierBreakdown.provincialKm > 0 || routeResult.roadTierBreakdown.localKm > 0) && (
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                        <span>Local / Palika Links: <strong>{routeResult.roadTierBreakdown.provincialKm + routeResult.roadTierBreakdown.localKm} km</strong></span>
                      </span>
                    )}
                    {routeResult.roadTierBreakdown.communityKm > 0 && (
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                        <span>Unpaved Track: <strong>{routeResult.roadTierBreakdown.communityKm} km</strong></span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Data Source & Provenance */}
              <div className="pt-2 border-t border-slate-800/50">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Database className="w-3.5 h-3.5 text-cyan-500/80 shrink-0" />
                    <span className="text-slate-500">Data source</span>
                    <span className="font-bold text-slate-200">{routeResult.dataProvenance?.source || 'Department of Roads (DoR Nepal) GIS Network'}</span>
                  </span>
                  {(() => {
                    const raw = routeResult.dataProvenance?.updatedAt || '2026-03-01';
                    const t = Date.parse(raw);
                    if (!Number.isNaN(t)) {
                      try {
                        return (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                            <Clock className="w-3 h-3 shrink-0" />
                            Updated {new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        );
                      } catch {
                        return (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                            <Clock className="w-3 h-3 shrink-0" />
                            Updated {raw}
                          </span>
                        );
                      }
                    }
                    return (
                      <span className="inline-flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                        <Clock className="w-3 h-3 shrink-0" />
                        Updated {raw}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                  <span>Official statutory road distances certified along surveyed national highway centerlines (NH01–NH80). Direct aerial distance computed via Geodesic Great Circle.</span>
                  <a
                    href="https://dor.gov.np"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-cyan-500/90 hover:text-cyan-400 font-medium"
                  >
                    View official source <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs italic">
            Please choose different origin and destination locations.
          </div>
        )}
      </div>

      {/* Comprehensive City-to-City Distance Matrix Table */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Nepal Major Hubs Distance Matrix (km)</h3>
            <p className="text-xs text-slate-400">DoR nodes only. Click a cell to load into the calculator.</p>
          </div>
          <input
            type="text"
            placeholder="Filter matrix hubs..."
            value={matrixFilter}
            onChange={(e) => setMatrixFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-center text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-left bg-slate-900 sticky left-0 z-10 border-r border-slate-800">City Hub</th>
                {keyHubs
                  .filter((h) => h.name.toLowerCase().includes(matrixFilter.toLowerCase()))
                  .map((hub) => (
                    <th key={hub.id} className="py-2.5 px-3 whitespace-nowrap">
                      {hub.name.split(' ')[0]}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {keyHubs
                .filter((h) => h.name.toLowerCase().includes(matrixFilter.toLowerCase()))
                .map((rowHub) => (
                  <tr key={rowHub.id} className="hover:bg-slate-850/40 transition">
                    <td className="py-2.5 px-3 text-left font-bold text-white bg-slate-900/95 sticky left-0 z-10 border-r border-slate-800 whitespace-nowrap">
                      {rowHub.name.split(' ')[0]} <span className="text-[10px] text-slate-500 font-normal">({rowHub.elevationM}m)</span>
                    </td>
                    {keyHubs
                      .filter((h) => h.name.toLowerCase().includes(matrixFilter.toLowerCase()))
                      .map((colHub) => {
                        if (rowHub.id === colHub.id) {
                          return (
                            <td key={colHub.id} className="py-2.5 px-3 text-slate-600 bg-slate-950/40">
                              -
                            </td>
                          );
                        }
                        const dist = findOptimizedRoute(rowHub.id, colHub.id, 'fastest', 'car')?.totalDistanceKm || calculateDirectDistanceKm(rowHub.lat, rowHub.lng, colHub.lat, colHub.lng);
                        return (
                          <td
                            key={colHub.id}
                            onClick={() => {
                              setOriginId(rowHub.id);
                              setDestId(colHub.id);
                            }}
                            className="py-2.5 px-3 font-semibold text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-300 cursor-pointer transition"
                            title={`Calculate ${rowHub.name} to ${colHub.name}`}
                          >
                            {dist}
                          </td>
                        );
                      })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
