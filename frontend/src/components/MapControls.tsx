import React from 'react';
import { Plus, Minus, Compass } from 'lucide-react';
import { useMap } from 'react-leaflet';

export const MapControls: React.FC = () => {
  const map = useMap();

  const handleZoomIn = () => {
    map.setZoom(map.getZoom() + 1, { animate: true, duration: 0.5 });
  };

  const handleZoomOut = () => {
    map.setZoom(map.getZoom() - 1, { animate: true, duration: 0.5 });
  };

  const handleResetNorth = () => {
    map.setView(map.getCenter(), map.getZoom(), { animate: true });
    // Note: Leaflet doesn't natively support rotation without plugins, 
    // but this ensures the center is cleared and view is focused.
  };

  return (
    <div className="absolute bottom-32 right-8 z-[1000] flex flex-col gap-2">
      <div className="flex flex-col bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <button 
          onClick={handleZoomIn}
          className="p-3 text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90"
          title="Zoom In"
        >
          <Plus size={20} />
        </button>
        <div className="h-[1px] bg-white/5 mx-2" />
        <button 
          onClick={handleZoomOut}
          className="p-3 text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-90"
          title="Zoom Out"
        >
          <Minus size={20} />
        </button>
      </div>

      <button 
        onClick={handleResetNorth}
        className="p-3 bg-slate-900/40 backdrop-blur-xl border border-white/10 text-indigo-400 rounded-2xl shadow-2xl hover:text-white hover:bg-indigo-600 transition-all active:rotate-180 duration-500"
        title="Recenter"
      >
        <Compass size={20} />
      </button>
    </div>
  );
};
