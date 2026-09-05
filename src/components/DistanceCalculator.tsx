import React, { useState } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { findOptimizedRoute, calculateDirectDistanceKm } from '../utils/routeOptimizer';
import { CityNode, VehicleType } from '../types';
import { Calculator, ArrowRight, Car, Fuel, Zap, Clock, ArrowUpDown, Mountain, MapPin, Check } from 'lucide-react';

interface DistanceCalculatorProps {
  onPlanFullRoute?: (originId: string, destId: string) => void;
}

export const DistanceCalculator: React.FC<DistanceCalculatorProps> = ({ onPlanFullRoute }) => {
  const [originId, setOriginId] = useState<string>('ktm');
  const [destId, setDestId] = useState<string>('pkr');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('car');
  const [matrixFilter, setMatrixFilter] = useState<string>('');

  const origin = CITIES_AND_JUNCTIONS.find((c) => c.id === originId) || CITIES_AND_JUNCTIONS[0];
  const destination = CITIES_AND_JUNCTIONS.find((c) => c.id === destId) || CITIES_AND_JUNCTIONS[1];

  const swapCities = () => {
    const temp = originId;
    setOriginId(destId);
    setDestId(temp);
  };

  // Calculate route between chosen pair
  const routeResult = originId !== destId ? findOptimizedRoute(originId, destId, 'fastest', selectedVehicle) : null;
  const aerialDistance = calculateDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);

  // Key hubs for distance matrix
  const keyHubs = CITIES_AND_JUNCTIONS.filter((c) => c.isMajorHub);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg">
            GEOGRAPHIC MILEAGE ENGINE
          </span>
          <span className="text-xs text-slate-400">Roads Board Nepal Calibration</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight mt-1 font-display">
          Nepal Inter-City Distance & Elevation Calculator
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Accurate driving distances, aerial displacements, mountain altitude variance, and multi-vehicle fuel / time estimations along verified highway corridors.
        </p>
      </div>

      {/* Interactive Pair Calculator Card */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Origin Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Origin Location (City / Junction)</span>
            </label>
            <select
              id="select-calc-origin"
              value={originId}
              onChange={(e) => setOriginId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            >
              {CITIES_AND_JUNCTIONS.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.district} - {city.elevationM}m)
                </option>
              ))}
            </select>
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

          {/* Destination Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Destination Location (City / Junction)</span>
            </label>
            <select
              id="select-calc-dest"
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            >
              {CITIES_AND_JUNCTIONS.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.district} - {city.elevationM}m)
                </option>
              ))}
            </select>
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
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onPlanFullRoute && onPlanFullRoute(originId, destId)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-1.5"
                >
                  <span>Open in Route Optimizer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Road Driving Distance</div>
                <div className="text-2xl font-black text-emerald-400 mt-0.5 font-display">
                  {routeResult.totalDistanceKm} <span className="text-sm font-normal text-slate-400">km</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Aerial: {aerialDistance} km straight-line</div>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Estimated Drive Time</div>
                <div className="text-2xl font-black text-cyan-400 mt-0.5 font-display">
                  {Math.floor(routeResult.estimatedTimeMinutes / 60)}h {routeResult.estimatedTimeMinutes % 60}m
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Avg Speed: ~{Math.round(routeResult.totalDistanceKm / (routeResult.estimatedTimeMinutes / 60))} km/h</div>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Elevation Delta</div>
                <div className="text-2xl font-black text-purple-400 mt-0.5 font-display flex items-baseline space-x-1">
                  <span>{destination.elevationM - origin.elevationM > 0 ? `+${destination.elevationM - origin.elevationM}` : destination.elevationM - origin.elevationM}</span>
                  <span className="text-sm font-normal text-slate-400">m</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{origin.elevationM}m ➔ {destination.elevationM}m</div>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-medium">Est. Petrol / Diesel Cost</div>
                <div className="text-2xl font-black text-amber-400 mt-0.5 font-display">
                  Rs. {routeResult.fuelEstimate.costNpr.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">~{routeResult.fuelEstimate.liters} Liters required</div>
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

      {/* Comprehensive City-to-City Distance Matrix Table */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Nepal Major Hubs Distance Matrix (km)</h3>
            <p className="text-xs text-slate-400">Click any cell to load the calculation instantly into the calculator.</p>
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
