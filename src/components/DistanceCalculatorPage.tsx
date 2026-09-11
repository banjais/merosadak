import React, { useState } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, calculateDirectDistanceKm } from '../utils/routeOptimizer';
import { CityNode } from '../types';
import { Calculator, ArrowRight, ArrowUpDown, MapPin, ChevronDown, ArrowLeft } from 'lucide-react';

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

  const origin = CITIES_AND_JUNCTIONS.find((c) => c.id === originId) || CITIES_AND_JUNCTIONS[0];
  const destination = CITIES_AND_JUNCTIONS.find((c) => c.id === destId) || CITIES_AND_JUNCTIONS[1];

  const swapCities = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
  };

  const routeResult = originId !== destId ? findOptimizedRoute(originId, destId, 'fastest', 'car') : null;
  const aerialDistance = calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);

  const handleSelectOrigin = (cityId: string) => {
    setOriginId(cityId);
    setOriginDropdownOpen(false);
  };

  const handleSelectDest = (cityId: string) => {
    setDestId(cityId);
    setDestDropdownOpen(false);
  };

  const handleMatrixCellClick = (rowId: string, colId: string) => {
    setOriginId(rowId);
    setDestId(colId);
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Origin Selector - Dropdown Button */}
              <div className="md:col-span-5 space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Origin Location</span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setOriginDropdownOpen(!originDropdownOpen)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition flex items-center justify-between"
                    aria-expanded={originDropdownOpen}
                  >
                    <span>{origin.name} <span className="text-slate-500 font-normal">({origin.district} - {origin.elevationM}m)</span></span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${originDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {originDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                      {CITIES_AND_JUNCTIONS.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => handleSelectOrigin(city.id)}
                          className={`w-full px-3.5 py-2.5 text-left text-sm font-medium transition ${
                            originId === city.id
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'text-slate-100 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {city.name} <span className="text-slate-500 font-normal">({city.district} - {city.elevationM}m)</span>
                        </button>
                      ))}
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
                    onClick={() => setDestDropdownOpen(!destDropdownOpen)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition flex items-center justify-between"
                    aria-expanded={destDropdownOpen}
                  >
                    <span>{destination.name} <span className="text-slate-500 font-normal">({destination.district} - {destination.elevationM}m)</span></span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${destDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {destDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                      {CITIES_AND_JUNCTIONS.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => handleSelectDest(city.id)}
                          className={`w-full px-3.5 py-2.5 text-left text-sm font-medium transition ${
                            destId === city.id
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'text-slate-100 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {city.name} <span className="text-slate-500 font-normal">({city.district} - {city.elevationM}m)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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