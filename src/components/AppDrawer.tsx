import React, { useMemo } from 'react';
import {
  X,
  Compass,
  AlertTriangle,
  CloudFog,
  Activity,
  MapPin,
  Route,
  Calculator,
  Coins,
  HardDriveDownload,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { ActiveFeatureType } from '../App';
import { useAuth } from '../context/AuthContext';
import { RoutePlanResult } from '../types';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
   activeTab?: ActiveFeatureType;
   onNavigateTab: (tab: ActiveFeatureType) => void;
  onOpenTravelSteps?: () => void;
  onOpenDistanceMatrix: () => void;
  onOpenDataSources?: () => void;
  onOpenTollModal: () => void;
  onOpenSosModal: () => void;
  onOpenPreTripModal: () => void;
  onOpenReportModal: () => void;
  onOpenShareModal?: () => void;
  onOpenOfflineManager: () => void;
  onOpenLogin: () => void;
  incidentsCount?: number;
  hasActiveRoute?: boolean;
  routeLabel?: string | null;
  activeRoute?: RoutePlanResult | null;
  distanceCalcOrigin?: string | null;
  distanceCalcDest?: string | null;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  activeTab = 'route',
  onNavigateTab,
  onOpenTravelSteps,
  onOpenDistanceMatrix,
  onOpenDataSources,
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
  activeRoute = null,
  distanceCalcOrigin = null,
  distanceCalcDest = null,
}) => {
  const { user, loading, logout } = useAuth();

  if (!isOpen) return null;

  const drawerMenuItems = [
    {
      id: 'route',
      label: 'Route Planner',
      subtitle: 'Plan your next trip',
      icon: Compass,
      color: 'text-emerald-400',
      activeColor: 'bg-emerald-500 text-slate-950',
      activeBg: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
      activeIcon: 'bg-emerald-500 text-slate-950',
      onClick: () => { onNavigateTab('route'); onClose(); },
    },
    {
      id: 'highways',
      label: hasActiveRoute ? 'Highway Info' : 'Highway Info',
      subtitle: hasActiveRoute ? 'On your route' : 'Highway directory',
      icon: Route,
      color: 'text-violet-400',
      activeColor: 'bg-violet-500 text-white',
      activeBg: 'bg-violet-500/15 text-violet-300 border border-violet-500/40',
      activeIcon: 'bg-violet-500 text-white',
      onClick: () => { onNavigateTab('highways'); onClose(); },
    },
    {
      id: 'distance',
      label: 'Distance Calculator',
      subtitle: 'Exact inter-city highway km',
      icon: Calculator,
      color: 'text-cyan-400',
      activeColor: 'bg-cyan-500 text-slate-950',
      activeBg: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
      activeIcon: 'bg-cyan-500 text-slate-950',
      onClick: () => { onOpenDistanceMatrix(); onClose(); },
    },
    {
      id: 'tolls',
      label: 'Nagdhunga Tunnel Tolls',
      subtitle: 'Vehicle tariffs & bypass rates',
      icon: Coins,
      color: 'text-amber-400',
      activeColor: 'bg-amber-500 text-slate-950',
      activeBg: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
      activeIcon: 'bg-amber-500 text-slate-950',
      onClick: () => { onOpenTollModal(); onClose(); },
    },
    {
      id: 'reports',
      label: 'Reports & Hazards',
      subtitle: hasActiveRoute ? 'Route-specific alerts' : 'Road hazard reporting',
      icon: AlertTriangle,
      color: 'text-rose-400',
      activeColor: 'bg-rose-500 text-white',
      activeBg: 'bg-rose-500/15 text-rose-300 border border-rose-500/40',
      activeIcon: 'bg-rose-500 text-white',
      onClick: () => { onOpenReportModal(); onClose(); },
    },
    {
      id: 'offline',
      label: 'Offline GIS Bundle',
      subtitle: 'Download for offline use',
      icon: HardDriveDownload,
      color: 'text-cyan-400',
      activeColor: 'bg-cyan-500 text-slate-950',
      activeBg: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
      activeIcon: 'bg-cyan-500 text-slate-950',
      onClick: () => { onOpenOfflineManager(); onClose(); },
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[1100] animate-fade-in-smooth"
        onClick={onClose}
      />

      <aside className="fixed top-0 left-0 bottom-0 w-72 max-w-[90vw] bg-slate-950 border-r border-slate-800 z-[1200] flex flex-col shadow-2xl animate-slideInLeft text-slate-100">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md shadow-amber-500/10">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#f59e0b" />
              </svg>
            </div>
            <div>
              <span className="font-black text-sm tracking-tight text-white font-display">Merosadak</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            title="Close menu"
            id="btn-close-drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {routeLabel && (
            <p className="text-[10px] text-emerald-400/90 px-2 font-medium truncate" title={routeLabel || undefined}>
              {routeLabel}
            </p>
          )}

          <div className="space-y-1">
            {drawerMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition text-left group ${
                    isActive
                      ? item.activeBg
                      : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-1 rounded-lg ${isActive ? item.activeIcon : `bg-slate-900 ${item.color} group-hover:bg-slate-800`}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">{item.label}</span>
                      <span className="text-[9px] text-slate-400 font-normal">{item.subtitle}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-3 h-3 ${isActive ? 'text-violet-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
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
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition shrink-0"
                title="Sign out"
              >
                <span className="hidden sm:inline text-[10px] font-semibold">Sign out</span>
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition shrink-0"
                title="Sign in"
              >
                <span className="hidden sm:inline text-[10px] font-semibold">Sign in</span>
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[9px] font-mono text-slate-500">v2.4.0</span>
            {user?.email && (
              <span className="text-[9px] text-slate-500 truncate max-w-[60%]">{user.email}</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
