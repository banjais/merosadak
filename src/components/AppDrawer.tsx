import React from 'react';
import {
  X,
  Compass,
  AlertTriangle,
  CloudFog,
  Activity,
  MapPin,
  Route,
  Languages,
  Calculator,
  Table,
  Coins,
  ShieldAlert,
  ClipboardCheck,
  PlusCircle,
  Share2,
  HardDriveDownload,
  Layers,
  ChevronRight,
  Sparkles,
  LogIn,
  LogOut,
  Zap,
} from 'lucide-react';
import { SubViewTab } from '../App';
import { useAuth } from '../context/AuthContext';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: SubViewTab | 'steps';
  onNavigateTab: (tab: SubViewTab) => void;
  onOpenTravelSteps?: () => void;
  onOpenDistanceMatrix: () => void;
  onOpenDistanceMatrixReference: () => void;
  onOpenTollModal: () => void;
  onOpenSosModal: () => void;
  onOpenPreTripModal: () => void;
  onOpenReportModal: () => void;
  onOpenShareModal: () => void;
  onOpenOfflineManager: () => void;
  onOpenLogin: () => void;
  incidentsCount?: number;
  hasActiveRoute?: boolean;
  routeLabel?: string | null;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  activeTab = 'route',
  onNavigateTab,
  onOpenTravelSteps,
  onOpenDistanceMatrix,
  onOpenDistanceMatrixReference,
  onOpenTollModal,
  onOpenSosModal,
  onOpenPreTripModal,
  onOpenReportModal,
  onOpenShareModal,
  onOpenOfflineManager,
  onOpenLogin,
  incidentsCount = 0,
  hasActiveRoute = false,
  routeLabel = null,
}) => {
  const { user, loading, logout } = useAuth();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[1100] animate-fade-in-smooth"
        onClick={onClose}
      />

      <aside className="fixed top-0 left-0 bottom-0 w-80 max-w-[88vw] bg-slate-950 border-r border-slate-800 z-[1200] flex flex-col shadow-2xl animate-slideInLeft text-slate-100">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md shadow-amber-500/10">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#f59e0b" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
              <span className="font-black text-base tracking-tight text-white font-display">Merosadak</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
            title="Close menu"
            id="btn-close-drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-5 custom-scrollbar">
          <div className="mb-2">
            <button
              onClick={() => {
                onNavigateTab('route');
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                activeTab === 'route'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1.5 rounded-lg ${activeTab === 'route' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-emerald-400 group-hover:bg-slate-800'}`}>
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <span className="block font-bold">Route Planner (Home)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Plan your next trip</span>
                </div>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'route' ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
            </button>
          </div>

          {hasActiveRoute && (
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2.5 flex items-center justify-between">
              <span>Along your route</span>
            </div>
            {routeLabel && (
              <p className="text-[10px] text-emerald-400/90 px-2.5 mb-2 font-medium truncate" title={routeLabel || undefined}>
                {routeLabel}
              </p>
            )}

            <div className="space-y-1">
              <button
                onClick={() => { onNavigateTab('pois'); onClose(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'pois'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'pois' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-cyan-400 group-hover:bg-slate-800'}`}>
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">POIs & Landmarks</span>
                    <span className="text-[10px] text-slate-400 font-normal">Near this corridor only</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'pois' ? 'text-cyan-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>

              <button
                onClick={() => { onNavigateTab('ev_charging'); onClose(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'ev_charging'
                    ? 'bg-lime-500/15 text-lime-300 border border-lime-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'ev_charging' ? 'bg-lime-500 text-slate-950' : 'bg-slate-900 text-lime-400 group-hover:bg-slate-800'}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">EV Charging</span>
                    <span className="text-[10px] text-slate-400 font-normal">Along your route</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'ev_charging' ? 'text-lime-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>

              <button
                onClick={() => { onNavigateTab('incidents'); onClose(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'incidents'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'incidents' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-rose-400 group-hover:bg-slate-800'}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Road alerts</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {incidentsCount > 0 ? `${incidentsCount} live` : 'Corridor hazards'}
                    </span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'incidents' ? 'text-rose-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>

              <button
                onClick={() => { onNavigateTab('weather'); onClose(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'weather'
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'weather' ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-sky-400 group-hover:bg-slate-800'}`}>
                    <CloudFog className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Weather & passes</span>
                    <span className="text-[10px] text-slate-400 font-normal">On this corridor</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'weather' ? 'text-sky-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>

              <button
                onClick={() => { onNavigateTab('highways'); onClose(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'highways'
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'highways' ? 'bg-violet-500 text-white' : 'bg-slate-900 text-violet-400 group-hover:bg-slate-800'}`}>
                    <Route className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Highways on route</span>
                    <span className="text-[10px] text-slate-400 font-normal">NH codes you will use</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'highways' ? 'text-violet-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2.5">
              Calculators & Toll Rates
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onOpenDistanceMatrix();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-slate-900 text-cyan-400 group-hover:bg-slate-800">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Distance Calculator</span>
                    <span className="text-[10px] text-slate-400 font-normal">Exact inter-city highway km</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </button>

            <button
              onClick={() => {
                onOpenDistanceMatrixReference();
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-1.5 rounded-lg bg-slate-900 text-emerald-400 group-hover:bg-slate-800">
                  <Table className="w-4 h-4" />
                </div>
                <div>
                  <span className="block font-bold">Distance Matrix (Reference)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Static km matrix · PDF print</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
            </button>

            <button
              onClick={() => {
                onOpenTollModal();
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-1.5 rounded-lg bg-slate-900 text-amber-400 group-hover:bg-slate-800">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <span className="block font-bold">Nagdhunga Tunnel Tolls</span>
                  <span className="text-[10px] text-slate-400 font-normal">Vehicle tariffs & bypass rates</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
            </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2.5">
              Trip Tools & Offline
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onOpenReportModal();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-slate-900 text-rose-400 group-hover:bg-slate-800">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Report Road Hazard</span>
                    <span className="text-[10px] text-slate-400 font-normal">Crowdsource blockades & slides</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onOpenOfflineManager();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-slate-900 text-cyan-400 group-hover:bg-slate-800">
                    <HardDriveDownload className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Offline GIS Bundle</span>
                    <span className="text-[10px] text-slate-400 font-normal">Download for offline use</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </button>
            </div>
          </div>

        </div>

        <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-medium text-slate-300 truncate">Nepal DoR & DHM GIS</span>
            </div>
            {loading ? (
              <span className="text-[10px] text-slate-500 shrink-0">Authenticating...</span>
            ) : user ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px] font-semibold">Sign out</span>
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition shrink-0"
                title="Sign in"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px] font-semibold">Sign in</span>
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-500">v2.4.0</span>
            {user?.email && (
              <span className="text-[10px] text-slate-500 truncate max-w-[65%]">{user.email}</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
