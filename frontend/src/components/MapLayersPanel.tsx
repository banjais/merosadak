// Wrapper: simplifies MapLayersToggle for quick integration
import React, { useState, useEffect } from 'react';
import { MapLayersToggle as Original, type MapLayerType } from './MapLayersToggle';
import { useWeatherMonsoon } from '../WeatherMonsoonContext';
import type { MapEngine } from './MapEngineSelector';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface MapLayersPanelProps {
  isOpen: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  onToggleMonsoon: () => void;
  monsoonVisible: boolean;
  onToggleTraffic: () => void;
  trafficVisible: boolean;
  onOpenDistanceCalc: () => void;
}

export const MapLayersPanel: React.FC<MapLayersPanelProps> = ({
  isOpen,
  isDarkMode,
  onClose,
  onToggleMonsoon,
  monsoonVisible,
  onToggleTraffic,
  trafficVisible,
  // onToggleMonsoon is no longer needed as a prop, monsoonVisible is derived from context
  onOpenDistanceCalc,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [layer, setLayer] = useState<MapLayerType>('standard');
  const [engine, setEngine] = useState<MapEngine>('nepal');

  // Close on Escape key
  useEscapeKey(onClose);
  const { monsoonIncidents } = useWeatherMonsoon();

  if (!shouldRender) return null;

  const handleLayerChange = (l: MapLayerType) => {
    setLayer(l);
    // In a full implementation, this would change the TileLayer URL
  };

  return (
    <div className={`absolute top-20 right-4 z-[2000] w-72 backdrop-blur-xl rounded-2xl border shadow-2xl p-4 transition-colors duration-300 ${isOpen ? 'animate-in fade-in zoom-in-95' : 'animate-out fade-out zoom-out-95'} duration-200 ${isDarkMode
      ? 'bg-slate-900/90 border-slate-700/40'
      : 'bg-white/90 border-white/40'
      }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-bold font-headline ${isDarkMode ? 'text-white' : ''}`}>Map Layers</h3>
        <button onClick={onClose} className={`text-xs hover:text-gray-800 transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500'}`}>✕</button>
      </div>

      {/* Base Layers */}
      <div className="space-y-2 mb-4">
        <p className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>Base Map</p>
        <div className="grid grid-cols-3 gap-2">
          {(['standard', 'satellite', 'terrain'] as MapLayerType[]).map(l => (
            <button
              key={l}
              onClick={() => handleLayerChange(l)}
              className={`p-2 rounded-xl text-center text-[10px] font-bold uppercase transition-all ${layer === l
                ? 'bg-indigo-600 text-white shadow-lg'
                : isDarkMode
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Map Engine */}
      <div className="space-y-2 mb-4">
        <p className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>Region</p>
        <div className="flex gap-2">
          {(['nepal', 'world'] as MapEngine[]).map(e => (
            <button
              key={e}
              onClick={() => setEngine(e)}
              className={`flex-1 p-2 rounded-xl text-[10px] font-bold uppercase transition-all ${engine === e
                ? 'bg-indigo-600 text-white shadow-lg'
                : isDarkMode
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Overlays */}
      <div className="space-y-2 mb-4">
        <p className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>Overlays</p>

        {/* Traffic Toggle */}
        <button
          onClick={onToggleTraffic}
          className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${trafficVisible
            ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
            : isDarkMode
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          <span>🚦 Real-Time Traffic</span>
          <span className={`w-3 h-3 rounded-full ${trafficVisible ? 'bg-red-600 animate-pulse' : isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`} />
        </button>

        {/* Monsoon Toggle */}
        <button
          onClick={() => { /* Monsoon visibility is now controlled by context */ }}
          className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${monsoonVisible
            ? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
            : isDarkMode
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          <span>🌧️ Monsoon / Landslide Risk</span>
          <span className={`w-3 h-3 rounded-full ${monsoonVisible ? 'bg-blue-600' : isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`} />
        </button>

        {/* Distance Calculator */}
        <button
          onClick={onOpenDistanceCalc}
          className={`w-full p-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${isDarkMode
            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          📏 Distance Calculator
        </button>
      </div>
    </div>
  );
};
