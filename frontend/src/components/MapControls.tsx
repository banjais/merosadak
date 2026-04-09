import React from 'react';
import { Plus, Minus, Compass } from 'lucide-react';
import { useMap } from 'react-leaflet';

interface MapControlsProps {
  userLocation?: { lat: number; lng: number } | null;
  isDarkMode?: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({ userLocation, isDarkMode = false }) => {
  const map = useMap();

  const handleZoomIn = () => {
    const newZoom = Math.min(map.getZoom() + 1, 18);
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], newZoom, { animate: true, duration: 0.5 });
    } else {
      map.setZoom(newZoom, { animate: true, duration: 0.5 });
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(map.getZoom() - 1, 2);
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], newZoom, { animate: true, duration: 0.5 });
    } else {
      map.setZoom(newZoom, { animate: true, duration: 0.5 });
    }
  };

  const handleRecenter = () => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 13, { animate: true, duration: 1.0 });
    } else {
      map.setView(map.getCenter(), map.getZoom(), { animate: true });
    }
  };

  return (
    <div className="absolute bottom-36 right-4 z-[100] flex flex-col gap-2">
      <div className={`flex flex-col backdrop-blur-xl border rounded-[1.5rem] overflow-hidden shadow-[0_8px_24px_rgba(27,51,85,0.1)] transition-colors duration-300 ${isDarkMode
        ? 'bg-slate-900/70 border-slate-700/40'
        : 'bg-white/70 border-white/40'
        }`}>
        <button
          onClick={handleZoomIn}
          className="p-3 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
          title="Zoom In"
        >
          <Plus size={20} />
        </button>
        <div className="h-[1px] bg-outline/10 mx-2" />
        <button
          onClick={handleZoomOut}
          className="p-3 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
          title="Zoom Out"
        >
          <Minus size={20} />
        </button>
      </div>

      <button
        onClick={handleRecenter}
        className={`p-3 backdrop-blur-xl border rounded-[1.5rem] shadow-[0_8px_24px_rgba(27,51,85,0.1)] hover:text-white hover:bg-gradient-to-br hover:from-primary hover:to-tertiary transition-all active:rotate-180 duration-500 ${isDarkMode
          ? 'bg-slate-900/70 border-slate-700/40 text-primary'
          : 'bg-white/70 border-white/40 text-primary'
          }`}
        title="Recenter on me"
      >
        <Compass size={20} />
      </button>
    </div>
  );
};
