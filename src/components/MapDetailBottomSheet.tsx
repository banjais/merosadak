import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Navigation, Mountain, Fuel, AlertTriangle, ChevronUp } from 'lucide-react';
import { CityNode, HighwayWeatherNode } from '../types';

interface MapDetailBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity?: CityNode | null;
  selectedWeatherNode?: HighwayWeatherNode | null;
  onViewOnMap?: (lat: number, lng: number, title: string) => void;
}

export const MapDetailBottomSheet: React.FC<MapDetailBottomSheetProps> = ({
  isOpen,
  onClose,
  selectedCity,
  selectedWeatherNode,
  onViewOnMap,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = selectedCity ? (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-black text-white font-display">{selectedCity.name}</h3>
          {selectedCity.nepaliName && (
            <p className="text-xs text-slate-400">{selectedCity.nepaliName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">District</div>
          <div className="text-white font-bold">{selectedCity.district}</div>
        </div>
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Elevation</div>
          <div className="text-white font-bold">{selectedCity.elevationM}m ASL</div>
        </div>
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Province</div>
          <div className="text-white font-bold">{selectedCity.province}</div>
        </div>
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Type</div>
          <div className="text-white font-bold capitalize">{selectedCity.type}</div>
        </div>
      </div>

      {selectedCity.highwayCode && (
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 text-xs">
          <div className="text-slate-400 mb-0.5">Connected Highway</div>
          <div className="text-white font-bold">{selectedCity.highwayCode}</div>
        </div>
      )}

      {onViewOnMap && (
        <button
          onClick={() => onViewOnMap(selectedCity.lat, selectedCity.lng, selectedCity.name)}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>View on Map</span>
        </button>
      )}
    </div>
  ) : selectedWeatherNode ? (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-black text-white font-display">{selectedWeatherNode.name}</h3>
          {selectedWeatherNode.nepaliName && (
            <p className="text-xs text-slate-400">{selectedWeatherNode.nepaliName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Temperature</div>
          <div className="text-white font-bold">{selectedWeatherNode.tempC}°C</div>
        </div>
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Humidity</div>
          <div className="text-white font-bold">{selectedWeatherNode.humidityPercent}%</div>
        </div>
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Wind Speed</div>
          <div className="text-white font-bold">{selectedWeatherNode.windSpeedKmh} km/h</div>
        </div>
        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Visibility</div>
          <div className="text-white font-bold">{selectedWeatherNode.visibilityKm} km</div>
        </div>
      </div>

      <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 text-xs">
        <div className="text-slate-400 mb-0.5">Condition</div>
        <div className="text-white font-bold">{selectedWeatherNode.summary}</div>
      </div>

      {onViewOnMap && (
        <button
          onClick={() => onViewOnMap(selectedWeatherNode.lat, selectedWeatherNode.lng, selectedWeatherNode.name)}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>View on Map</span>
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] flex flex-col items-center pointer-events-none">
      <div
        ref={sheetRef}
        className={`pointer-events-auto w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 rounded-t-3xl shadow-2xl transition-all duration-300 ease-out ${
          isExpanded ? 'translate-y-0' : 'translate-y-0'
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-center mb-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
            >
              <ChevronUp className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`overflow-y-auto transition-all duration-300 ${isExpanded ? 'max-h-[60vh]' : 'max-h-[30vh]'}`}>
            {content}
          </div>
        </div>
      </div>
    </div>
  );
};
