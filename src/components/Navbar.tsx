import React from 'react';
import { ShieldAlert, Compass, Navigation, Map as MapIcon, Route, Calculator, PhoneCall, AlertTriangle, Radio, Mountain, Wifi, WifiOff, CloudDownload, Languages } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

export type ActiveTab = 'map' | 'highways' | 'distance' | 'planner' | 'alerts' | 'dialects';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeAlertCount: number;
  onOpenReportModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeAlertCount,
  onOpenReportModal,
}) => {
  const { isOnline, cacheStats, setIsOfflineManagerOpen } = useOffline();
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Live Emergency Ticker */}
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/70 px-4 py-1 text-xs text-slate-300 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-hidden">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="font-semibold text-red-400 uppercase tracking-wider shrink-0 text-[10px]">DOR Live Advisory:</span>
          <div className="truncate text-slate-300 font-medium">
            <span className="text-amber-300">Jogimara curve (Prithvi H04)</span> single-lane clearance • <span className="text-amber-300">Daunne Pass (H01)</span> 4-lane widening with delays • <span className="text-emerald-400">BP Highway (H13)</span> open for light vehicles
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-4 shrink-0 text-slate-400">
          <span className="flex items-center space-x-1">
            <PhoneCall className="w-3 h-3 text-emerald-400" />
            <span>Traffic Hotline: <strong className="text-emerald-400">103</strong></span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center space-x-1">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span>Highway Rescue: <strong className="text-red-400">1114</strong></span>
          </span>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('planner')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/20">
              <Navigation className="w-5 h-5 text-white transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white font-display">Mero Sadak</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md">
                  NEPAL DOR
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Highways Directory, Distance Matrix & AI Route Trip Optimizer
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              id="nav-tab-planner"
              onClick={() => setActiveTab('planner')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'planner'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Route Planner</span>
            </button>

            <button
              id="nav-tab-map"
              onClick={() => setActiveTab('map')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'map'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Live Map</span>
            </button>

            <button
              id="nav-tab-highways"
              onClick={() => setActiveTab('highways')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'highways'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              <span>Highways Info</span>
            </button>

            <button
              id="nav-tab-distance"
              onClick={() => setActiveTab('distance')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'distance'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Distance Matrix</span>
            </button>

            <button
              id="nav-tab-alerts"
              onClick={() => setActiveTab('alerts')}
              className={`relative flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'alerts'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Live Alerts</span>
              {activeAlertCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                  {activeAlertCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-dialects"
              onClick={() => setActiveTab('dialects')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dialects'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Dialects</span>
            </button>
          </nav>

          {/* Right Action Button */}
          <div className="flex items-center space-x-2">
            <button
              id="btn-mountain-offline-pack"
              onClick={() => setIsOfflineManagerOpen(true)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm active:scale-95 ${
                !isOnline
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900/80'
                  : cacheStats.isReadyForOffline
                  ? 'bg-slate-800/90 text-emerald-300 border-emerald-500/30 hover:bg-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Manage offline map tiles and cached road status for remote mountain travel"
            >
              {!isOnline ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              ) : cacheStats.isReadyForOffline ? (
                <Mountain className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden sm:inline font-medium">
                {!isOnline
                  ? 'Mountain Offline'
                  : cacheStats.isReadyForOffline
                  ? `Offline Ready (${cacheStats.tilesCount})`
                  : 'Offline Pack'}
              </span>
            </button>

            <button
              id="btn-report-road-issue"
              onClick={onOpenReportModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-all shadow-sm active:scale-95"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Report Issue</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
