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
    { id: 'blocked', icon: <ShieldAlert size={12} />, label: 'Blocked', active: activeFilters.blocked, color: 'text-error' },
    { id: 'oneway', icon: <Navigation2 size={12} className="rotate-90" />, label: '1-Lane', active: activeFilters.oneway, color: 'text-amber-500' },
    { id: 'resumed', icon: <CheckCircle2 size={12} />, label: 'Clear', active: activeFilters.resumed, color: 'text-secondary' },
  ];

  return (
    <div ref={containerRef} className="absolute top-36 right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-auto">
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-[1.25rem] bg-white/70 backdrop-blur-xl border transition-all shadow-[0_8px_24px_rgba(27,51,85,0.1)] hover:scale-105 active:scale-95 ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-white/40'}`}
      >
        <Layers size={16} className={isOpen ? 'text-primary' : 'text-on-surface-variant'} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface font-label">Map</span>
        <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={`w-auto bg-white/80 backdrop-blur-xl rounded-[1.25rem] border border-white/40 shadow-[0_12px_32px_rgba(27,51,85,0.12)] p-3 flex flex-col gap-3 transition-all duration-300 origin-top-right ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
        
        {/* Engine */}
        <div className="flex gap-1.5">
          <button
            onClick={() => onMapEngineChange('nepal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase font-label transition-all ${mapEngine === 'nepal' ? 'bg-gradient-to-br from-[#0062a2] to-[#004878] text-white shadow-md' : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/10'}`}
          >
            <Mountain size={12} /> Nepal
          </button>
          <button
            onClick={() => onMapEngineChange('world')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase font-label transition-all ${mapEngine === 'world' ? 'bg-gradient-to-br from-[#006c5c] to-[#00443a] text-white shadow-md' : 'bg-surface-container-low text-on-surface-variant hover:bg-tertiary/10'}`}
          >
            <Globe size={12} /> World
          </button>
        </div>

        {/* Layers */}
        <div className="flex gap-1.5">
          {layers.map(l => (
            <button
              key={l.id}
              onClick={() => onLayerChange(l.id as MapLayerType)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-bold uppercase font-label transition-all ${currentLayer === l.id ? 'bg-gradient-to-br from-primary to-primary-dim text-white shadow-md' : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/10'}`}
            >
              {l.icon} {l.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-1.5">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => onFilterToggle(f.id as any)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-bold uppercase font-label transition-all ${f.active ? 'bg-primary/10 text-on-surface border border-primary/20' : 'bg-surface-container-low text-on-surface-variant opacity-50'}`}
            >
              <span className={f.active ? f.color : ''}>{f.icon}</span> {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
