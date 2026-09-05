import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Sparkles,
  Compass,
  AlertTriangle,
  CloudFog,
  ShieldAlert,
  Menu,
} from 'lucide-react';
import { ActiveFeatureType } from '../App';

interface SpeedDialFabProps {
  activeFeature: ActiveFeatureType;
  onSelectFeature: (feature: ActiveFeatureType) => void;
  onOpenSos: () => void;
  onOpenDrawer: () => void;
  incidentsCount?: number;
}

export const SpeedDialFab: React.FC<SpeedDialFabProps> = ({
  activeFeature,
  onSelectFeature,
  onOpenSos,
  onOpenDrawer,
  incidentsCount = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // slight delay so user can move between buttons smoothly
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 280);
  };

  const handleAction = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  return (
    <div
      ref={fabRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end"
    >
      {/* Expanded Speed-Dial Action Items */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="flex flex-col items-end space-y-2.5 mb-3.5 z-50 animate-fadeIn">
            {/* 1. Emergency SOS Hotline */}
            <div className="flex items-center space-x-2.5 group">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/95 text-rose-300 text-xs font-extrabold border border-rose-800/80 shadow-xl backdrop-blur-md transition group-hover:scale-105">
                Emergency SOS (100 / 103 / 1114)
              </span>
              <button
                onClick={() => handleAction(onOpenSos)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border border-red-400/40 shadow-rose-600/30 ring-2 ring-slate-950"
                title="Emergency Highway SOS Hotline Dispatch"
                id="fab-btn-sos"
              >
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </button>
            </div>

            {/* 2. Travel Flow: What after what for travel? */}
            <div className="flex items-center space-x-2.5 group">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/95 text-amber-300 text-xs font-extrabold border border-amber-500/40 shadow-xl backdrop-blur-md transition group-hover:scale-105">
                Travel Flow: What After What?
              </span>
              <button
                onClick={() =>
                  handleAction(() =>
                    onSelectFeature(activeFeature === 'steps' ? null : 'steps')
                  )
                }
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border ring-2 ring-slate-950 ${
                  activeFeature === 'steps'
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-amber-500/40'
                    : 'bg-slate-900/95 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                }`}
                title="Step-by-Step Travel Sequence Checklist"
                id="fab-btn-travel-flow"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>

            {/* 3. Point-to-Point Route Planner */}
            <div className="flex items-center space-x-2.5 group">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/95 text-cyan-300 text-xs font-bold border border-slate-700/80 shadow-xl backdrop-blur-md transition group-hover:scale-105">
                Route Planner &amp; Mountain ETA
              </span>
              <button
                onClick={() =>
                  handleAction(() =>
                    onSelectFeature(activeFeature === 'route' ? null : 'route')
                  )
                }
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border ring-2 ring-slate-950 ${
                  activeFeature === 'route'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-cyan-500/40'
                    : 'bg-slate-900/95 text-cyan-400 border-slate-700 hover:bg-slate-800'
                }`}
                title="Point-to-Point Route & ETA Planner"
                id="fab-btn-route"
              >
                <Compass className="w-5 h-5" />
              </button>
            </div>

            {/* 4. Live Road Alerts Feed */}
            <div className="flex items-center space-x-2.5 group">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/95 text-rose-300 text-xs font-bold border border-slate-700/80 shadow-xl backdrop-blur-md transition group-hover:scale-105">
                Live Road Alerts &amp; Blocks ({incidentsCount})
              </span>
              <button
                onClick={() =>
                  handleAction(() =>
                    onSelectFeature(activeFeature === 'incidents' ? null : 'incidents')
                  )
                }
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border ring-2 ring-slate-950 relative ${
                  activeFeature === 'incidents'
                    ? 'bg-rose-500 text-white border-rose-300 font-black shadow-rose-500/40'
                    : 'bg-slate-900/95 text-rose-400 border-slate-700 hover:bg-slate-800'
                }`}
                title="Live Road Alerts & Landslides"
                id="fab-btn-incidents"
              >
                <AlertTriangle className="w-5 h-5" />
                {incidentsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] text-white font-black flex items-center justify-center ring-2 ring-slate-950 animate-pulse">
                    {incidentsCount}
                  </span>
                )}
              </button>
            </div>

            {/* 5. Mountain Passes & Weather */}
            <div className="flex items-center space-x-2.5 group">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/95 text-sky-300 text-xs font-bold border border-slate-700/80 shadow-xl backdrop-blur-md transition group-hover:scale-105">
                Passes &amp; Weather Telemetry
              </span>
              <button
                onClick={() =>
                  handleAction(() =>
                    onSelectFeature(activeFeature === 'weather' ? null : 'weather')
                  )
                }
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border ring-2 ring-slate-950 ${
                  activeFeature === 'weather'
                    ? 'bg-sky-500 text-slate-950 border-sky-300 font-black shadow-sky-500/40'
                    : 'bg-slate-900/95 text-sky-400 border-slate-700 hover:bg-slate-800'
                }`}
                title="High-Altitude Mountain Passes & Weather"
                id="fab-btn-weather"
              >
                <CloudFog className="w-5 h-5" />
              </button>
            </div>

            {/* 6. Open Left Menu Drawer */}
            <div className="flex items-center space-x-2.5 group">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/95 text-indigo-300 text-xs font-bold border border-indigo-500/40 shadow-xl backdrop-blur-md transition group-hover:scale-105">
                All Tools &amp; Highways Drawer
              </span>
              <button
                onClick={() => handleAction(onOpenDrawer)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/95 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border border-indigo-500/40 ring-2 ring-slate-950"
                title="Open Left Menu Drawer (Calculators, NH01–NH80, Offline Sync)"
                id="fab-btn-open-drawer"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Round Floating Action Button (+FAB) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-14 h-14 sm:w-15 sm:h-15 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform active:scale-90 ring-4 ring-slate-950/80 ${
          isOpen
            ? 'bg-slate-800 text-amber-400 border border-amber-500/50 rotate-45 shadow-amber-500/20'
            : 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 hover:shadow-amber-500/30 hover:scale-105'
        }`}
        title={isOpen ? 'Close menu' : 'Open Navigation & Travel Tools'}
        aria-label="Toggle floating navigation menu"
        id="btn-speed-dial-fab"
      >
        <Plus className="w-7 h-7 stroke-[2.8] transition-transform duration-300" />
      </button>
    </div>
  );
};
