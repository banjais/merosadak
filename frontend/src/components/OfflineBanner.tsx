import React from 'react';
import { WifiOff, Download } from 'lucide-react';

interface OfflineBannerProps {
  onDownloadMap?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onDownloadMap }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-red-600 text-white px-4 py-3 shadow-lg animate-slide-down">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WifiOff size={18} className="animate-pulse" />
          <div>
            <p className="text-sm font-bold font-headline">You are offline</p>
            <p className="text-xs font-label text-white/80">
              Showing cached data. Some features unavailable.
            </p>
          </div>
        </div>
        {onDownloadMap && (
          <button
            onClick={onDownloadMap}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1.5 rounded-lg text-xs font-label font-bold uppercase tracking-wide transition-colors whitespace-nowrap"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Download Map</span>
          </button>
        )}
      </div>
    </div>
  );
};
