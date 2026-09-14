import React, { useState, useEffect, useRef } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, calculateDirectDistanceKm } from '../utils/routeOptimizer';
import { CityNode } from '../types';
import { loadExpandedCities, getNearestRoutingCity } from '../utils/cityDataLoader';
import { filterCities } from '../utils/citySearch';
import { Calculator, ArrowRight, ArrowUpDown, Search, ArrowLeft } from 'lucide-react';

interface DistanceCalculatorPageProps {
  onBack?: () => void;
  onPlanFullRoute?: (originId: string, destId: string) => void;
}

export const DistanceCalculatorPage: React.FC<DistanceCalculatorPageProps> = ({ onBack, onPlanFullRoute }) => {
  const [originId, setOriginId] = useState<string>('ktm');
  const [destId, setDestId] = useState<string>('pkr');
  const [matrixFilter, setMatrixFilter] = useState<string>('');
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [originSearch, setOriginSearch] = useState<string>(CITIES_AND_JUNCTIONS.find((city) => city.id === 'ktm')?.name || '');
  const [destSearch, setDestSearch] = useState<string>(CITIES_AND_JUNCTIONS.find((city) => city.id === 'pkr')?.name || '');
  const [allCities, setAllCities] = useState<CityNode[]>(CITIES_AND_JUNCTIONS);
  const originSearchRef = useRef<HTMLDivElement>(null);
  const destSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadExpandedCities()
      .then((cities) => setAllCities(cities.length > 0 ? cities : CITIES_AND_JUNCTIONS))
      .catch(() => setAllCities(CITIES_AND_JUNCTIONS));
  }, []);

  const origin = allCities.find((c) => c.id === originId) || allCities[0];
  const destination = allCities.find((c) => c.id === destId) || allCities[1];

  useEffect(() => {
    function handleCloseOnOutsideClick(event: MouseEvent) {
      if (originSearchRef.current && !originSearchRef.current.contains(event.target as Node)) {
        setOriginDropdownOpen(false);
        setOriginSearch(origin.name);
      }
      if (destSearchRef.current && !destSearchRef.current.contains(event.target as Node)) {
        setDestDropdownOpen(false);
        setDestSearch(destination.name);
      }
    }

    document.addEventListener('mousedown', handleCloseOnOutsideClick);
    return () => document.removeEventListener('mousedown', handleCloseOnOutsideClick);
  }, [origin.name, destination.name]);

  const filteredOriginCities = filterCities(allCities, originSearch);
  const filteredDestCities = filterCities(allCities, destSearch);

  const swapCities = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
    setOriginSearch(destination.name);
    setDestSearch(origin.name);
  };

  const originRouting = getNearestRoutingCity(origin);
  const destRouting = getNearestRoutingCity(destination);

  const routeResult = originId !== destId ? findOptimizedRoute(originRouting.id, destRouting.id, 'fastest', 'car') : null;
  const aerialDistance = calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);

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

  const handleMatrixCellClick = (rowId: string, colId: string) => {
    const rowCity = allCities.find((city) => city.id === rowId);
    const colCity = allCities.find((city) => city.id === colId);
    setOriginId(rowId);
    setDestId(colId);
    setOriginSearch(rowCity?.name || '');
    setDestSearch(colCity?.name || '');
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
                    value={originSearch || origin.name}
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
                              {city.name}{city.nepaliName ? <span className="text-[11px] font-normal text-slate-400"> ({city.nepaliName})</span> : ''}
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
                    type="text"
                    value={destSearch || destination.name}
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
                    <span className="text-lg font-bold text-white">{origin.name}</span>
                    <ArrowRight className="w-5 h-5 text-emerald-400" />
                    <span className="text-lg font-bold text-white">{destination.name}</span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Road Driving Distance</div>
                    <div className="text-2xl font-black text-emerald-400 mt-0.5 font-display">
                      {routeResult.totalDistanceKm} <span className="text-sm font-normal text-slate-400">km</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Aerial: {aerialDistance} km straight-line</div>
                  </div>

                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Elevation Delta</div>
                    <div className="text-2xl font-black text-purple-400 mt-0.5 font-display flex items-baseline space-x-1">
                      <span>{destination.elevationM - origin.elevationM > 0 ? `+${destination.elevationM - origin.elevationM}` : destination.elevationM - origin.elevationM}</span>
                      <span className="text-sm font-normal text-slate-400">m</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{origin.elevationM}m ➔ {destination.elevationM}m</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                  <span>Source:</span>
                  <span className="font-medium text-slate-400">{routeResult.dataSource}</span>
                </div>

                {/* Step summary of highways traversed */}
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Corridors Traversed:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {routeResult.steps.map((st, i) => (
                      <div key={i} className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                          {i + 1}
                        </span>
                        <span className="text-slate-200 font-medium">{st.instruction}</span>
                        <span className="text-slate-500 font-semibold">({st.distanceKm} km)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                Please choose different origin and destination locations.
              </div>
            )}
          </div>

          {/* Full Distance Matrix Table */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Nepal Full Distance Matrix (km)</h3>
                  <p className="text-xs text-slate-400">All {CITIES_AND_JUNCTIONS.length} cities and junctions. Click any cell to calculate that route.</p>
                </div>
                <input
                  type="text"
                  placeholder="Filter cities..."
                  value={matrixFilter}
                  onChange={(e) => setMatrixFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-center text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 text-left bg-slate-900 sticky left-0 z-10 border-r border-slate-800">City</th>
                      {CITIES_AND_JUNCTIONS
                        .filter((h) => h.name.toLowerCase().includes(matrixFilter.toLowerCase()))
                        .map((hub) => (
                          <th key={hub.id} className="py-2.5 px-3 whitespace-nowrap">
                            {hub.name.split(' ')[0]}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {CITIES_AND_JUNCTIONS
                      .filter((h) => h.name.toLowerCase().includes(matrixFilter.toLowerCase()))
                      .map((rowHub) => (
                        <tr key={rowHub.id} className="hover:bg-slate-850/40 transition">
                          <td className="py-2.5 px-3 text-left font-bold text-white bg-slate-900/95 sticky left-0 z-10 border-r border-slate-800 whitespace-nowrap">
                            {rowHub.name.split(' ')[0]} <span className="text-[10px] text-slate-500 font-normal">({rowHub.elevationM}m)</span>
                          </td>
                          {CITIES_AND_JUNCTIONS
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
                                  onClick={() => handleMatrixCellClick(rowHub.id, colHub.id)}
                                  className="py-2.5 px-3 font-semibold text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-300 cursor-pointer transition"
                                  title={`${rowHub.name} to ${colHub.name}`}
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
      </main>
    </div>
  );
};