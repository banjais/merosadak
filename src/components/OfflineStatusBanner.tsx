import React from 'react';
import { useOffline } from '../context/OfflineContext';
import { WifiOff, Mountain, CloudDownload, RefreshCw, Layers, ShieldCheck } from 'lucide-react';

export const OfflineStatusBanner: React.FC = () => {
  const { isOnline, isSimulatedOffline, setSimulatedOffline, cacheStats, setIsOfflineManagerOpen } = useOffline();

  if (isOnline) return null;

  return (
    <div
      className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/40 px-4 py-2 text-xs text-amber-200 shadow-md animate-fadeIn"
      id="mountain-offline-banner"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-amber-300">
              {isSimulatedOffline ? '🏔️ Mountain Offline Mode (Simulated Test)' : '🏔️ Mountain Offline Mode Active'}
            </span>
            <span className="text-slate-300 text-[11px] ml-1.5 hidden sm:inline">
              Operating with {cacheStats.tilesCount} cached map tiles & local topological routing engine.
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setIsOfflineManagerOpen(true)}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition flex items-center space-x-1"
          >
            <Layers className="w-3 h-3" />
            <span>Manage Offline Pack ({cacheStats.tilesCount} Tiles)</span>
          </button>

          {isSimulatedOffline && (
            <button
              onClick={() => setSimulatedOffline(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold border border-slate-700 transition"
            >
              Exit Simulation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
