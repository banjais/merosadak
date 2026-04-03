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
      { target: 20, delay: 200 },
      { target: 45, delay: 400 },
      { target: 70, delay: 300 },
      { target: 90, delay: 300 },
      { target: 100, delay: 200 },
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
    <div className="fixed inset-0 z-[9999] flex overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030e20] via-[#0a1628] to-[#0f172a]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,98,162,0.15)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,108,92,0.1)_0%,_transparent_50%)]" />

      {/* Left: App Name & Logo */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-[#0062a2] to-[#006c5c] flex items-center justify-center shadow-[0_8px_32px_rgba(0,98,162,0.35)]">
            <MapIcon size={26} className="text-white" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Merosadak
          </h2>
          <p className="text-[10px] font-medium text-[#9cb3dc] tracking-wider uppercase">
            Safe Travels Across the Himalayas
          </p>
        </div>
      </div>

      {/* Right Center: Progress Bar */}
      <div className="relative z-10 flex items-center justify-center w-12 pr-4">
        <div className="flex flex-col items-center gap-2">
          {/* Percentage */}
          <span className="text-[11px] font-bold text-white tabular-nums">{progress}%</span>
          
          {/* Vertical Progress Bar */}
          <div className="w-1.5 h-28 bg-white/10 rounded-full overflow-hidden relative">
            <div 
              className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#0062a2] to-[#4fe5ca] rounded-full transition-all duration-300 ease-out"
              style={{ height: `${progress}%` }}
            />
          </div>

          {/* Status Text */}
          <span className="text-[7px] font-bold text-[#657ba2] uppercase tracking-widest writing-mode-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            {progress < 100 ? 'Loading' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Map Engine Selection — slides in after loading */}
      {loaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center animate-in fade-in duration-500">
          <div className="flex flex-col items-center w-full max-w-xs mx-4 gap-5">
            
            <p className="text-xs font-medium text-[#9cb3dc] tracking-wide">Choose your map experience</p>

            {/* Map Engine Cards */}
            <div className="flex flex-col gap-3 w-full">
              
              {/* Nepal Map */}
              <button
                onClick={() => onSelect('nepal')}
                className="group relative flex items-center gap-3 p-4 rounded-[1.25rem] bg-gradient-to-br from-[#0062a2]/15 to-[#0062a2]/5 border border-[#0062a2]/25 hover:border-[#0062a2]/50 transition-all active:scale-[0.97] active:duration-150 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#0062a2]/0 via-[#0062a2]/5 to-[#0062a2]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#0062a2] to-[#004878] flex items-center justify-center shadow-[0_4px_16px_rgba(0,98,162,0.3)] flex-shrink-0">
                  <Mountain size={20} className="text-white" />
                </div>
                <div className="relative flex flex-col items-start flex-1">
                  <span className="text-sm font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Nepal Map</span>
                  <span className="text-[10px] text-[#9cb3dc] leading-snug">Road alerts, monsoon risks &amp; local data</span>
                </div>
                <ChevronRight size={16} className="relative text-[#657ba2] group-hover:text-[#91c5ff] group-hover:translate-x-1 transition-all flex-shrink-0" />
              </button>

              {/* World Map */}
              <button
                onClick={() => onSelect('world')}
                className="group relative flex items-center gap-3 p-4 rounded-[1.25rem] bg-gradient-to-br from-[#006c5c]/12 to-[#006c5c]/4 border border-[#006c5c]/20 hover:border-[#006c5c]/40 transition-all active:scale-[0.97] active:duration-150 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#006c5c]/0 via-[#006c5c]/5 to-[#006c5c]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#006c5c] to-[#00443a] flex items-center justify-center shadow-[0_4px_16px_rgba(0,108,92,0.3)] flex-shrink-0">
                  <Globe size={20} className="text-white" />
                </div>
                <div className="relative flex flex-col items-start flex-1">
                  <span className="text-sm font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>World Map</span>
                  <span className="text-[10px] text-[#9cb3dc] leading-snug">Full global view with OpenStreetMap tiles</span>
                </div>
                <ChevronRight size={16} className="relative text-[#657ba2] group-hover:text-[#4fe5ca] group-hover:translate-x-1 transition-all flex-shrink-0" />
              </button>
            </div>

            <p className="text-[8px] text-[#657ba2] uppercase tracking-widest">Switch anytime from Map Engine panel</p>
          </div>
        </div>
      )}
    </div>
  );
};
