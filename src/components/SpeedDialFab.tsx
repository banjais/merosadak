import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  CloudFog,
  Route,
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

  const handleAction = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  return (
    <div
      ref={fabRef}
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center justify-end"
    >
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="flex items-center justify-end space-x-2 mb-3 z-50 animate-fadeIn">
            <button
              type="button"
              onClick={() => handleAction(onOpenSos)}
              className="w-11 h-11 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border border-red-400/40 shadow-rose-600/30"
              title="Emergency SOS"
            >
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </button>
            <button
              type="button"
              onClick={() =>
                handleAction(() =>
                  onSelectFeature(activeFeature === 'steps' ? null : 'steps')
                )
              }
              className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border ${
                activeFeature === 'steps'
                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-amber-500/40'
                  : 'bg-slate-900/95 text-amber-300 border-amber-500/40 hover:bg-slate-800'
              }`}
              title="Travel Flow"
            >
              <Sparkles className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() =>
                handleAction(() =>
                  onSelectFeature(activeFeature === 'incidents' ? null : 'incidents')
                )
              }
              className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border relative ${
                activeFeature === 'incidents'
                  ? 'bg-rose-500 text-white border-rose-300 font-black shadow-rose-500/40'
                  : 'bg-slate-900/95 text-rose-400 border-slate-700 hover:bg-slate-800'
              }`}
              title="Road Alerts"
            >
              <AlertTriangle className="w-5 h-5" />
              {incidentsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] text-white font-black flex items-center justify-center ring-2 ring-slate-950 animate-pulse">
                  {incidentsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                handleAction(() =>
                  onSelectFeature(activeFeature === 'weather' ? null : 'weather')
                )
              }
              className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border ${
                activeFeature === 'weather'
                  ? 'bg-sky-500 text-slate-950 border-sky-300 font-black shadow-sky-500/40'
                  : 'bg-slate-900/95 text-sky-400 border-slate-700 hover:bg-slate-800'
              }`}
              title="Weather"
            >
              <CloudFog className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                handleAction(() =>
                  onSelectFeature(activeFeature === 'highways' ? null : 'highways')
                )
              }
              className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border ${
                activeFeature === 'highways'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-emerald-500/40'
                  : 'bg-slate-900/95 text-emerald-400 border-slate-700 hover:bg-slate-800'
              }`}
              title="Highways"
            >
              <Route className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenDrawer)}
              className="w-11 h-11 rounded-full bg-slate-900/95 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition border border-indigo-500/40"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform active:scale-90 ring-4 ring-slate-950/80 ${
          isOpen
            ? 'bg-slate-800 text-amber-400 border border-amber-500/50 rotate-45 shadow-amber-500/20'
            : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 text-white hover:shadow-teal-500/30 hover:scale-105'
        }`}
        title={isOpen ? 'Close menu' : 'Open Navigation & Travel Tools'}
        aria-label="Toggle floating navigation menu"
      >
        <Plus className="w-6 h-6 stroke-[2.8] transition-transform duration-300" />
      </button>
    </div>
  );
};
