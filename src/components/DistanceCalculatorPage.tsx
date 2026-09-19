import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, calculateDirectDistanceKm } from '../utils/routeOptimizer';
import { preloadRoadGraph } from '../utils/roadGraphRouter';
import { CityNode } from '../types';
import { loadExpandedCities, getNearestRoutingCity } from '../utils/cityDataLoader';
import { filterCities } from '../utils/citySearch';
import { formatDistanceKm } from '../utils/formatDistance';
import { Calculator, ArrowRight, ArrowUpDown, Search, ArrowLeft, Route, Award } from 'lucide-react';
import { DataAttribution } from './DataAttribution';

interface DistanceCalculatorPageProps {
  onBack?: () => void;
  onPlanFullRoute?: (originId: string, destId: string) => void;
}

export const DistanceCalculatorPage: React.FC<DistanceCalculatorPageProps> = ({ onBack, onPlanFullRoute }) => {
  const [originId, setOriginId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [originSearch, setOriginSearch] = useState<string>('');
  const [destSearch, setDestSearch] = useState<string>('');
  const [allCities, setAllCities] = useState<CityNode[]>(CITIES_AND_JUNCTIONS);
  const originSearchRef = useRef<HTMLDivElement>(null);
  const destSearchRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExpandedCities()
      .then((cities) => setAllCities(cities.length > 0 ? cities : CITIES_AND_JUNCTIONS))
      .catch(() => setAllCities(CITIES_AND_JUNCTIONS));
  }, []);

  // Auto-focus destination input after origin is selected
  const prevOriginId = useRef<string>('');
  useEffect(() => {
    if (originId && prevOriginId.current === '') {
      prevOriginId.current = originId;
      setTimeout(() => {
        destInputRef.current?.focus();
      }, 100);
    } else if (originId) {
      prevOriginId.current = originId;
    }
  }, [originId]);

  const origin = originId ? allCities.find((c) => c.id === originId) : undefined;
  const destination = destId ? allCities.find((c) => c.id === destId) : undefined;

  useEffect(() => {
    function handleCloseOnOutsideClick(event: MouseEvent) {
      if (originSearchRef.current && !originSearchRef.current.contains(event.target as Node)) {
        setOriginDropdownOpen(false);
        setOriginSearch(origin?.name ?? '');
      }
      if (destSearchRef.current && !destSearchRef.current.contains(event.target as Node)) {
        setDestDropdownOpen(false);
        setDestSearch(destination?.name ?? '');
      }
    }

    document.addEventListener('mousedown', handleCloseOnOutsideClick);
    return () => document.removeEventListener('mousedown', handleCloseOnOutsideClick);
  }, [origin?.name, destination?.name]);

  // Preload the road graph so the route optimizer can resolve real road distances.
  // The full distance matrix reference lives on its own screen (DistanceMatrixReference)
  // and is intentionally kept separate from this From/To calculator.
  const roadGraphLoadedRef = useRef(false);
  const [roadGraphVersion, setRoadGraphVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    preloadRoadGraph().then(() => {
      if (cancelled) return;
      if (!roadGraphLoadedRef.current) {
        roadGraphLoadedRef.current = true;
        setRoadGraphVersion((version) => version + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOriginCities = filterCities(allCities, originSearch);
  const filteredDestCities = filterCities(allCities, destSearch);

  const swapCities = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
    setOriginSearch(destination?.name ?? '');
    setDestSearch(origin?.name ?? '');
  };

  const routeResult = useMemo(
    () => originId && destId && originId !== destId && origin && destination
      ? findOptimizedRoute(originId, destId, 'fastest', 'car', {}, origin, destination)
      : null,
    [originId, destId, roadGraphVersion, origin, destination]
  );
  const aerialDistance = useMemo(
    () => origin && destination
      ? calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng)
      : 0,
    [origin, destination]
  );

  const handleSelectOrigin = (cityId: string) => {
    const city = allCities.find((candidate) => candidate.id === cityId);
    setOriginId(cityId);
    setOriginSearch(city?.name || '');
    setOriginDropdownOpen(false);
  };

  const handleSelectDest = (cityId: string) => {
    const city = allCities.find((candidate) => candidate.id === cityId);
    setDestId(cityId);
    setDestSearch(city?.name || '');
    setDestDropdownOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Page Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition"
                title="Back to Main App"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md shadow-emerald-500/10">
                <Calculator className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-white font-display">
                  Distance Calculator
                </h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Nepal Inter-City Distance & Elevation
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Interactive Pair Calculator Card */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 overflow-y-auto">
        <div className="space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-5 space-y-1.5 relative" ref={originSearchRef}>
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-400" />
                  <span>From (Origin)</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={originSearch || (origin?.name ?? '')}
                    onChange={(event) => {
                      setOriginSearch(event.target.value);
                      setOriginDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setOriginSearch('');
                      setOriginDropdownOpen(true);
                    }}
                    placeholder="Search origin..."
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                  />
                </div>
                {originDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto space-y-1">
                    {filteredOriginCities.length > 0 ? (
                      filteredOriginCities.map((city) => (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => handleSelectOrigin(city.id)}
                          className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                              {city.name}
                              {city.cityType && (
                                <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block align-middle">
                                  {city.cityType}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {city.district} District • {city.province} Province
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                            {city.elevationM}m ASL
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-slate-500">
                        No matching locations found
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex justify-center pt-1 md:pt-4">
                <button
                  onClick={swapCities}
                  title="Swap origin and destination"
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition shadow-md active:scale-95"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>

              <div className="md:col-span-5 space-y-1.5 relative" ref={destSearchRef}>
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                  <span>To (Destination)</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    ref={destInputRef}
                    type="text"
                    value={destSearch || (destination?.name ?? '')}
                    onChange={(event) => {
                      setDestSearch(event.target.value);
                      setDestDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setDestSearch('');
                      setDestDropdownOpen(true);
                    }}
                    placeholder="Search destination..."
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                  />
                </div>
                {destDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto space-y-1">
                    {filteredDestCities.length > 0 ? (
                      filteredDestCities.map((city) => (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => handleSelectDest(city.id)}
                          className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition flex items-center justify-between group"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                              {city.name}{city.nepaliName ? <span className="text-[11px] font-normal text-slate-400"> ({city.nepaliName})</span> : ''}
                              {city.cityType && (
                                <span className="ml-1.5 text-[9px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block align-middle">
                                  {city.cityType}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {city.district} District • {city.province} Province
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                            {city.elevationM}m ASL
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-slate-500">
                        No matching locations found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

        {/* Calculation Result Display */}
            {routeResult ? (
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-bold text-white">{origin?.name ?? 'Select origin'}</span>
                    <ArrowRight className="w-5 h-5 text-emerald-400" />
                    <span className="text-lg font-bold text-white">{destination?.name ?? 'Select destination'}</span>
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
                          {formatDistanceKm(routeResult.totalDistanceKm)} <span className="text-sm font-normal text-slate-400">km</span>
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
                          {formatDistanceKm(aerialDistance)} <span className="text-sm font-normal text-slate-400">km</span>
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
                        title={`DoR Certified: ${formatDistanceKm(routeResult.roadTierBreakdown.highwayKm)} km`}
                      />
                      {routeResult.roadTierBreakdown.certifiedPercent < 100 && (
                        <div
                          className="bg-cyan-500 h-full transition-all"
                          style={{ width: `${100 - routeResult.roadTierBreakdown.certifiedPercent}%` }}
                          title={`Provincial / Palika / Link Roads: ${formatDistanceKm(routeResult.roadTierBreakdown.localKm + routeResult.roadTierBreakdown.provincialKm + routeResult.roadTierBreakdown.communityKm)} km`}
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        <span>Federal Highway: <strong>{formatDistanceKm(routeResult.roadTierBreakdown.highwayKm)} km</strong></span>
                      </span>
                      {(routeResult.roadTierBreakdown.provincialKm > 0 || routeResult.roadTierBreakdown.localKm > 0) && (
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                          <span>Local / Palika Links: <strong>{formatDistanceKm(routeResult.roadTierBreakdown.provincialKm + routeResult.roadTierBreakdown.localKm)} km</strong></span>
                        </span>
                      )}
                      {routeResult.roadTierBreakdown.communityKm > 0 && (
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                          <span>Unpaved Track: <strong>{formatDistanceKm(routeResult.roadTierBreakdown.communityKm)} km</strong></span>
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
                        <span className="text-slate-500 font-semibold">({formatDistanceKm(st.distanceKm)} km)</span>
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

                {/* Official Source of Truth & Provenance Footer */}
                <DataAttribution
                  source={routeResult.dataProvenance?.source || 'Department of Roads (DoR Nepal) GIS Network'}
                  updatedAt={routeResult.dataProvenance?.updatedAt || '2026-03-01'}
                  note="Official statutory road distances certified along surveyed national highway centerlines (NH01–NH80). Direct aerial distance computed via Geodesic Great Circle."
                  href="https://dor.gov.np"
                />
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                Please choose different origin and destination locations.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
