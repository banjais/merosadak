import React, { useState, useEffect } from 'react';
import { Ruler, X, MapPin, Navigation, Clock, Loader2 } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { ETAResult } from '../services/etaService';

interface DistanceCalculatorProps {
  onClose: () => void;
  points: { lat: number, lng: number }[];
  clearPoints: () => void;
  eta?: ETAResult | null;
  etaLoading?: boolean;
  etaError?: string | null;
  onCalculateETA?: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => Promise<any>;
  userLocation?: { lat: number; lng: number } | null;
}

export const DistanceCalculator: React.FC<DistanceCalculatorProps> = ({
  onClose, points, clearPoints, eta, etaLoading, etaError, onCalculateETA, userLocation
}) => {
  const [distance, setDistance] = useState<number | null>(null);

  // Close on Escape key
  useEscapeKey(onClose);

  // Haversine Formula
  const calculateDistance = (p1: { lat: number, lng: number }, p2: { lat: number, lng: number }) => {
    const EARTH_RADIUS_KM = 6371; // Earth's radius in km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  };

  useEffect(() => {
    if (points.length >= 2) {
      let total = 0;
      for (let i = 0; i < points.length - 1; i++) {
        total += calculateDistance(points[i], points[i + 1]);
      }
      setDistance(total);
    } else {
      setDistance(null);
    }
  }, [points]);

  return (
    <div className="fixed top-24 right-8 z-[1500] w-72 glass-pilot rounded-3xl border border-white/10 shadow-2xl p-6 animate-in slide-in-from-right-10 duration-500">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Measure</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-slate-400"><X size={18} /></button>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Distance</div>
          <div className="text-3xl font-black text-indigo-500 tabular-nums">
            {distance !== null ? distance.toFixed(2) : '0.00'} <span className="text-sm">km</span>
          </div>
        </div>

        {/* ETA Section */}
        {eta && (
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-emerald-400" />
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estimated Travel Time</div>
            </div>
            {etaLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-400" />
                <span className="text-sm text-slate-400">Calculating...</span>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-black text-emerald-500 tabular-nums">
                  {eta.durationHours.toFixed(2)} <span className="text-sm">hours</span>
                </div>
                {eta.distanceKm && (
                  <div className="text-xs text-slate-400 mt-1">
                    Route: {eta.distanceKm.toFixed(1)} km via {eta.routeName || 'recommended route'}
                  </div>
                )}
                {eta.safetyScore !== undefined && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500">Safety:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${i <= (eta.safetyScore || 0) ? 'bg-emerald-400' : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick ETA calculation button */}
        {onCalculateETA && userLocation && points.length > 0 && (
          <button
            onClick={() => {
              const lastPoint = points[points.length - 1];
              onCalculateETA(userLocation, lastPoint);
            }}
            disabled={etaLoading}
            className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-emerald-500/20 disabled:opacity-50"
          >
            {etaLoading ? 'Calculating...' : 'Calculate ETA'}
          </button>
        )}

        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Selected Points ({points.length})</div>
          <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            {points.length === 0 ? (
              <div className="text-[11px] italic text-slate-600 px-1 py-10 text-center border-2 border-dashed border-white/5 rounded-xl">
                Tap anywhere on the map to start measuring
              </div>
            ) : (
              points.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 p-2 rounded-xl text-[10px]">
                  <div className="flex items-center gap-2">
                    <MapPin size={10} className="text-indigo-400" />
                    <span className="font-mono text-slate-300">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                  </div>
                  <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded">P{i + 1}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {points.length > 0 && (
          <button
            onClick={clearPoints}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/20"
          >
            Clear Measurement
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3 p-3 bg-indigo-600/10 rounded-2xl border border-indigo-500/20">
        <Navigation size={16} className="text-indigo-500" />
        <span className="text-[10px] font-bold text-indigo-100/70 leading-tight tracking-wide">
          Points are connected in sequence. Distances are calculated using standard geodesic curves.
        </span>
      </div>
    </div>
  );
};
