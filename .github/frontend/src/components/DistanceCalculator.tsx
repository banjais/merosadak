import React, { useState, useEffect } from 'react';
import { Ruler, X, MapPin, Navigation } from 'lucide-react';

interface DistanceCalculatorProps {
  onClose: () => void;
  points: { lat: number, lng: number }[];
  clearPoints: () => void;
}

export const DistanceCalculator: React.FC<DistanceCalculatorProps> = ({ onClose, points, clearPoints }) => {
  const [distance, setDistance] = useState<number | null>(null);

  // Haversine Formula
  const calculateDistance = (p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) => {
    const R = 6371; // Earth's radius in km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (points.length >= 2) {
      let total = 0;
      for (let i = 0; i < points.length - 1; i++) {
        total += calculateDistance(points[i], points[i+1]);
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
                  <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded">P{i+1}</span>
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
