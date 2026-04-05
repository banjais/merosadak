// src/components/MapLayersToggle.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Layers, Map as MapIcon, Globe, Mountain, ShieldAlert, Navigation2, CheckCircle2, ChevronDown } from 'lucide-react';
import type { MapEngine } from './MapEngineSelector';

export type MapLayerType = 'standard' | 'satellite' | 'terrain' | '3d';

interface MapLayersToggleProps {
  currentLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void;
  activeFilters: { blocked: boolean; oneway: boolean; resumed: boolean };
  onFilterToggle: (filter: 'blocked' | 'oneway' | 'resumed') => void;
  isDarkMode: boolean;
  mapEngine: MapEngine | null;
  onMapEngineChange: (engine: MapEngine) => void;
  onResetEngine: () => void;
}

export const MapLayersToggle: React.FC<MapLayersToggleProps> = ({ 
  currentLayer, 
  onLayerChange, 
  activeFilters, 
  onFilterToggle,
  isDarkMode,
  mapEngine,
  onMapEngineChange,
  onResetEngine
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const layers = [
    { id: 'standard', icon: <MapIcon size={14} />, label: 'Map' },
    { id: 'satellite', icon: <Globe size={14} />, label: 'Sat' },
    { id: 'terrain', icon: <Mountain size={14} />, label: 'Terrain' },
    { id: '3d', icon: <Navigation2 size={14} />, label: '3D' },
  ];

  const filters = [
    { id: 'blocked', icon: <ShieldAlert size={12} />, label: 'Blocked', active: activeFilters.blocked, color: 'text-red-500' },
    { id: 'oneway', icon: <Navigation2 size={12} className="rotate-90" />, label: '1-Lane', active: activeFilters.oneway, color: 'text-amber-500' },
    { id: 'resumed', icon: <CheckCircle2 size={12} />, label: 'Clear', active: activeFilters.resumed, color: 'text-emerald-500' },
  ];

  return (
    <div ref={containerRef} className="absolute top-36 right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-auto">
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-[1.25rem] bg-white/70 backdrop-blur-xl border transition-all shadow-[0_8px_24px_rgba(27,51,85,0.1)] hover:scale-105 active:scale-95 ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/40'}`}
      >
        <Layers size={16} className={isOpen ? 'text-indigo-500' : 'text-slate-600'} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Layers</span>
        <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={`w-auto bg-white/90 backdrop-blur-xl rounded-[1.25rem] border border-white/40 shadow-[0_12px_32px_rgba(27,51,85,0.12)] p-3 flex flex-col gap-3 transition-all duration-300 origin-top-right ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
        
        {/* Map Engine Selector */}
        <div className="flex gap-1.5">
          <button
            onClick={() => onMapEngineChange('nepal')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${mapEngine === 'nepal' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            <Mountain size={14} /> Nepal
          </button>
          <button
            onClick={() => onMapEngineChange('world')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${mapEngine === 'world' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            <Globe size={14} /> World
          </button>
        </div>

        {/* Base Layers */}
        <div className="flex gap-1.5">
          {layers.map(l => (
            <button
              key={l.id}
              onClick={() => onLayerChange(l.id as MapLayerType)}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${currentLayer === l.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              {l.icon} {l.label}
            </button>
          ))}
        </div>

        {/* Road Filters - Only relevant for Nepal map */}
        {mapEngine === 'nepal' && (
          <div className="flex gap-1.5 pt-2 border-t border-slate-200">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => onFilterToggle(f.id as any)}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${f.active ? 'bg-white border border-indigo-200 text-indigo-700 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <span className={f.active ? f.color : ''}>{f.icon}</span> {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};