import React, { useState } from 'react';
import { Layers, Map as MapIcon, Globe, Mountain, Filter, ShieldAlert, Navigation2, CheckCircle2, ChevronDown } from 'lucide-react';

export type MapLayerType = 'standard' | 'satellite' | 'terrain' | '3d';

interface MapLayersToggleProps {
  currentLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void;
  activeFilters: { blocked: boolean; oneway: boolean; open: boolean };
  onFilterToggle: (filter: 'blocked' | 'oneway' | 'open') => void;
  isDarkMode: boolean;
}

export const MapLayersToggle: React.FC<MapLayersToggleProps> = ({ 
  currentLayer, 
  onLayerChange, 
  activeFilters, 
  onFilterToggle,
  isDarkMode 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const layers = [
    { id: 'standard', icon: <MapIcon size={16} />, label: 'Standard' },
    { id: 'satellite', icon: <Globe size={16} />, label: 'Satellite' },
    { id: 'terrain', icon: <Mountain size={16} />, label: 'Terrain' },
    { id: '3d', icon: <Navigation2 size={16} />, label: '3D Mode' },
  ];

  const filters = [
    { id: 'blocked', icon: <ShieldAlert size={14} />, label: 'Blocked', active: activeFilters.blocked, color: 'text-red-500' },
    { id: 'oneway', icon: <Navigation2 size={14} className="rotate-90" />, label: 'One-Way', active: activeFilters.oneway, color: 'text-amber-500' },
    { id: 'open', icon: <CheckCircle2 size={14} />, label: 'Open', active: activeFilters.open, color: 'text-emerald-500' },
  ];

  return (
    <div className="absolute top-24 right-6 z-[1000] flex flex-col items-end gap-3 pointer-events-auto">
      
      {/* 🚀 Main Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-pilot border transition-all shadow-xl hover:scale-105 active:scale-95 ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/10'}`}
      >
        <Layers size={18} className={isOpen ? 'text-indigo-400' : 'text-slate-400'} />
        <span className="text-[11px] font-black uppercase tracking-widest text-indigo-100 italic">MAP ENGINE</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 📂 Dropdown Menu */}
      <div className={`w-56 glass-pilot rounded-3xl border border-white/10 shadow-2xl p-4 flex flex-col gap-5 transition-all duration-300 origin-top-right ${isOpen ? 'scale-100 opacity-100 mt-0' : 'scale-90 opacity-0 mt-2 pointer-events-none'}`}>
        
        {/* Layer Selection */}
        <div>
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-1">Layers & Perspective</h4>
          <div className="grid grid-cols-2 gap-2">
            {layers.map(l => (
              <button
                key={l.id}
                onClick={() => onLayerChange(l.id as MapLayerType)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-1.5 ${currentLayer === l.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                {l.icon}
                <span className="text-[9px] font-bold uppercase">{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Road Status Filters */}
        <div>
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-1 text-right">Road Status Filter</h4>
          <div className="flex flex-col gap-2">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => onFilterToggle(f.id as any)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${f.active ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-slate-950/40 border-white/5 opacity-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg bg-slate-900 border border-white/5 ${f.color}`}>
                    {f.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${f.active ? 'text-white' : 'text-slate-500'}`}>{f.label}</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${f.active ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${f.active ? 'left-4.5' : 'left-0.5'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cinematic HUD Footer */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Nepal Vector Engine v4.0</span>
        </div>
      </div>
    </div>
  );
};
