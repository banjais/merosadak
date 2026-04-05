// src/components/MapEngineSelector.tsx
import React, { useState, useEffect } from 'react';
import { Map as MapIcon, Globe, Mountain, ChevronRight } from 'lucide-react';

export type MapEngine = 'nepal' | 'world';

interface MapEngineSelectorProps {
  onSelect: (engine: MapEngine) => void;
}

export const MapEngineSelector: React.FC<MapEngineSelectorProps> = ({ onSelect }) => {
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const steps = [
      { target: 20, delay: 150 },
      { target: 45, delay: 250 },
      { target: 70, delay: 200 },
      { target: 90, delay: 200 },
      { target: 100, delay: 150 },
    ];

    let current = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const runStep = () => {
      if (current >= steps.length) {
        setTimeout(() => setLoaded(true), 300);
        return;
      }
      timeout = setTimeout(() => {
        setProgress(steps[current].target);
        current++;
        runStep();
      }, steps[current].delay);
    };

    runStep();

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex overflow-hidden bg-gradient-to-b from-[#030e20] via-[#0a1628] to-[#0f172a]">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,98,162,0.15)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,108,92,0.1)_0%,_transparent_50%)]" />

      {/* Left: Branding */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#0062a2] to-[#006c5c] flex items-center justify-center shadow-2xl">
            <MapIcon size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">MeroSadak</h1>
          <p className="text-sm text-slate-400">Safe Travels Across the Himalayas</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10 flex items-center justify-center w-12 pr-6">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl font-bold text-white tabular-nums">{progress}%</span>
          <div className="w-1.5 h-32 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-t from-[#0062a2] to-[#4fe5ca] w-full transition-all duration-300"
              style={{ height: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Engine Selection */}
      {loaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="w-full max-w-md px-6">
            <p className="text-center text-slate-400 text-sm mb-8">Choose your map experience</p>

            <div className="space-y-4">
              {/* Nepal Map */}
              <button
                onClick={() => onSelect('nepal')}
                className="group w-full flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-[#0062a2]/10 to-transparent border border-[#0062a2]/30 hover:border-[#0062a2] transition-all active:scale-[0.985]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#0062a2] flex items-center justify-center flex-shrink-0">
                  <Mountain size={28} className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-lg font-bold text-white">Nepal Map</div>
                  <div className="text-sm text-slate-400">Local roads, alerts &amp; monsoon risks</div>
                </div>
                <ChevronRight className="text-slate-400 group-hover:text-white transition-colors" />
              </button>

              {/* World Map */}
              <button
                onClick={() => onSelect('world')}
                className="group w-full flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-[#006c5c]/10 to-transparent border border-[#006c5c]/30 hover:border-[#006c5c] transition-all active:scale-[0.985]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#006c5c] flex items-center justify-center flex-shrink-0">
                  <Globe size={28} className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-lg font-bold text-white">World Map</div>
                  <div className="text-sm text-slate-400">Global view with OpenStreetMap</div>
                </div>
                <ChevronRight className="text-slate-400 group-hover:text-white transition-colors" />
              </button>
            </div>

            <p className="text-center text-[10px] text-slate-500 mt-8">You can switch anytime from the map layers panel</p>
          </div>
        </div>
      )}
    </div>
  );
};