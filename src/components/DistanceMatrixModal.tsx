import React, { useState } from 'react';
import { CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { calculateDirectDistanceKm, findOptimizedRoute } from '../utils/routeOptimizer';
import { X, Search, Calculator, ArrowRight, Mountain, Fuel, Car, Zap } from 'lucide-react';
import { CityNode } from '../types';

interface DistanceMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoute: (originId: string, destId: string) => void;
}

export const DistanceMatrixModal: React.FC<DistanceMatrixModalProps> = ({
  isOpen,
  onClose,
  onSelectRoute,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('ktm');
  const [selectedDest, setSelectedDest] = useState<string>('pkr');

  if (!isOpen) return null;

  const keyHubs = CITIES_AND_JUNCTIONS.filter((c) => c.isMajorHub);
  const originNode = CITIES_AND_JUNCTIONS.find((c) => c.id === selectedOrigin) || keyHubs[0];
  const destNode = CITIES_AND_JUNCTIONS.find((c) => c.id === selectedDest) || keyHubs[1];

  const routePlan = selectedOrigin !== selectedDest ? findOptimizedRoute(selectedOrigin, selectedDest, 'fastest', 'car') : null;
  const directKm = calculateDirectDistanceKm(originNode.lat, originNode.lng, destNode.lat, destNode.lng);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" id="distance-matrix-modal">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nepal Inter-City Distance & Elevation Matrix</h3>
              <p className="text-xs text-slate-400">Verified Department of Roads driving distances and aerial displacements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Route Lookup Bar */}
        <div className="p-4 bg-slate-900 border-b border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4">
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Origin City</label>
            <select
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              {CITIES_AND_JUNCTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.province})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Destination City</label>
            <select
              value={selectedDest}
              onChange={(e) => setSelectedDest(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
            >
              {CITIES_AND_JUNCTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.province})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-end">
            <button
              onClick={() => {
                onSelectRoute(selectedOrigin, selectedDest);
                onClose();
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <span>Load in Route Optimizer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Selected Pair Calculation Stats */}
        {routePlan && (
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Road Driving Distance</span>
              <strong className="text-base text-emerald-400 font-bold">{routePlan.totalDistanceKm} km</strong>
              <span className="text-[10px] text-slate-500 block">Aerial: {directKm} km</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Estimated Drive Time</span>
              <strong className="text-base text-white font-bold">
                {Math.floor(routePlan.estimatedTimeMinutes / 60)}h {routePlan.estimatedTimeMinutes % 60}m
              </strong>
              <span className="text-[10px] text-slate-500 block">Mountain pass delays incl.</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Altitude Change</span>
              <strong className="text-base text-cyan-400 font-bold">
                {originNode.elevationM}m ➔ {destNode.elevationM}m
              </strong>
              <span className="text-[10px] text-slate-500 block">Net Δ: {Math.abs(originNode.elevationM - destNode.elevationM)}m</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Estimated Fuel (Car)</span>
              <strong className="text-base text-amber-400 font-bold">~{routePlan.fuelEstimate.liters} L</strong>
              <span className="text-[10px] text-slate-500 block">NPR {routePlan.fuelEstimate.costNpr}</span>
            </div>
          </div>
        )}

        {/* Full Grid Matrix Table */}
        <div className="p-4 flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Hub-to-Hub Distance Matrix (Kilometers)</span>
            <span className="text-[10px] text-slate-500">Click any distance cell to instantly calculate</span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-2.5 sticky left-0 bg-slate-950 z-10">Hub City</th>
                  {keyHubs.map((h) => (
                    <th key={h.id} className="p-2.5 whitespace-nowrap text-center text-slate-300">
                      {h.name.split('/')[0].trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {keyHubs.map((rowCity) => (
                  <tr key={rowCity.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-2.5 font-sans font-bold text-slate-200 sticky left-0 bg-slate-900/90 whitespace-nowrap">
                      {rowCity.name.split('/')[0].trim()}
                    </td>
                    {keyHubs.map((colCity) => {
                      if (rowCity.id === colCity.id) {
                        return (
                          <td key={colCity.id} className="p-2.5 text-center text-slate-600 font-normal">
                            -
                          </td>
                        );
                      }
                      const p = findOptimizedRoute(rowCity.id, colCity.id, 'fastest', 'car');
                      const dist = p ? p.totalDistanceKm : calculateDirectDistanceKm(rowCity.lat, rowCity.lng, colCity.lat, colCity.lng);
                      return (
                        <td
                          key={colCity.id}
                          onClick={() => {
                            setSelectedOrigin(rowCity.id);
                            setSelectedDest(colCity.id);
                          }}
                          className="p-2.5 text-center text-emerald-400 hover:text-white hover:bg-emerald-600/30 cursor-pointer transition font-medium"
                          title={`${rowCity.name} to ${colCity.name}: ${dist} km`}
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
    </div>
  );
};
