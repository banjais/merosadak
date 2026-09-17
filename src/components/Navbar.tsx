import React from 'react';
import { ShieldAlert, Compass, Navigation, Map as MapIcon, Route, Calculator, PhoneCall, AlertTriangle, Radio, Mountain, WifiOff, CloudDownload, Languages } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

export type ActiveTab = 'map' | 'highways' | 'distance' | 'planner' | 'alerts' | 'dialects';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeAlertCount: number;
  onOpenReportModal: () => void;
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { id: 'planner', label: 'Route Planner', icon: <Compass className="w-4 h-4" /> },
  { id: 'map', label: 'Live Map', icon: <MapIcon className="w-4 h-4" /> },
  { id: 'highways', label: 'Highways Info', icon: <Route className="w-4 h-4" /> },
  { id: 'distance', label: 'Distance Matrix', icon: <Calculator className="w-4 h-4" /> },
  { id: 'alerts', label: 'Live Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'dialects', label: 'Dialects', icon: <Languages className="w-4 h-4" /> },
];

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
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/70 px-3 sm:px-4 py-1 text-xs text-slate-300 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 overflow-hidden min-w-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="hidden xs:inline font-semibold text-red-400 uppercase tracking-wider shrink-0 text-[10px]">DOR Live:</span>
          <div className="truncate text-slate-300 font-medium min-w-0">
            <span className="text-amber-300">Jogimara curve (Prithvi NH04)</span> single-lane clearance • <span className="text-amber-300">Daunne Pass (NH01)</span> 4-lane widening with delays • <span className="text-emerald-400">BP Highway (NH13)</span> open for light vehicles
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-4 shrink-0 text-slate-400">
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

      {/* Main Header — icon-first nav so everything fits edge-to-edge on any screen width */}
      <div className="w-full px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between gap-1 sm:gap-3 h-14 sm:h-16">
          {/* Brand */}
          <div
            className="flex items-center gap-2 cursor-pointer shrink-0"
            onClick={() => setActiveTab('planner')}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/20 shrink-0">
              <Navigation className="w-4 h-4 sm:w-5 sm:h-5 text-white transform -rotate-45" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white font-display" style={{ fontSize: 'clamp(0.9rem, 1.4vw, 1.125rem)' }}>Mero Sadak</span>
                <span className="hidden lg:inline px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md">
                  NEPAL DOR
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden lg:block truncate">
                Highways Directory, Distance Matrix &amp; AI Route Trip Optimizer
              </p>
            </div>
          </div>

          {/* Center Navigation — icon-only pill nav on mobile, icon+label from sm up.
              This is the part that used to overflow narrow screens with 6 full labels;
              now every screen size shows the full set of tabs without clipping. */}
          <nav
            className="flex items-center gap-0.5 sm:gap-1 bg-slate-950/60 p-1 rounded-full sm:rounded-xl border border-slate-800 overflow-x-auto no-scrollbar min-w-0"
            aria-label="Primary"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-1.5 px-2 py-1.5 sm:px-3 rounded-full sm:rounded-lg text-xs font-semibold transition-all shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span className={isActive ? 'inline' : 'hidden sm:inline'}>{item.label}</span>
                  {item.id === 'alerts' && activeAlertCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {activeAlertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Actions — icon-only on mobile */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              id="btn-mountain-offline-pack"
              onClick={() => setIsOfflineManagerOpen(true)}
              className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-3 rounded-xl text-xs font-semibold border transition-all shadow-sm active:scale-95 ${
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
              <span className="hidden md:inline font-medium">
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
              className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-all shadow-sm active:scale-95"
              title="Report a road issue"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden md:inline">Report Issue</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
