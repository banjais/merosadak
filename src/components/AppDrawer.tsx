import React, { useMemo } from 'react';
import {
  X,
  Compass,
  AlertTriangle,
  MapPin,
  Route,
  Calculator,
  Coins,
  HardDriveDownload,
  Database,
  ChevronRight,
  LogOut,
  LogIn,
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
  onOpenDistanceCalculator: () => void;
  onOpenDataSources?: () => void;
  onOpenTollModal: () => void;
  onOpenSosModal: () => void;
  onOpenPreTripModal: () => void;
  onOpenReportModal: () => void;
  onOpenShareModal?: () => void;
  onOpenOfflineManager: () => void;
  onOpenLogin: () => void;
  onOpenHighwayInfo?: () => void;
  onOpenMyLocation: () => void;
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
  onOpenDistanceCalculator,
  onOpenDataSources,
  onOpenTollModal,
  onOpenSosModal,
  onOpenPreTripModal,
  onOpenReportModal,
  onOpenShareModal,
  onOpenOfflineManager,
  onOpenLogin,
  onOpenHighwayInfo,
  onOpenMyLocation,
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
      icon: Compass,
      onClick: () => { onNavigateTab('route'); onClose(); },
    },
    {
      id: 'highways',
      label: 'Highway Info',
      icon: Route,
      onClick: () => { onOpenHighwayInfo ? onOpenHighwayInfo() : onNavigateTab('highways'); onClose(); },
    },
    {
      id: 'distance',
      label: 'Distance Calculator',
      icon: Calculator,
      onClick: () => { onOpenDistanceCalculator(); onClose(); },
    },
    {
      id: 'myLocation',
      label: 'My Location',
      icon: MapPin,
      onClick: () => { onOpenMyLocation(); onClose(); },
    },
  ];

  const additionalMenuItems = [
    {
      id: 'tolls',
      label: 'Tolls',
      icon: Coins,
      onClick: () => { onOpenTollModal(); onClose(); },
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: AlertTriangle,
      onClick: () => { onOpenReportModal(); onClose(); },
    },
    {
      id: 'offline',
      label: 'Offline',
      icon: HardDriveDownload,
      onClick: () => { onOpenOfflineManager(); onClose(); },
    },
    {
      id: 'datasources',
      label: 'Data Sources',
      icon: Database,
      onClick: () => { onOpenDataSources?.(); onClose(); },
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
            <span className="font-black text-sm tracking-tight text-white font-display">Merosadak</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition"
            title="Close menu"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-3 scrollbar-paddle">
          <div className="space-y-1">
            {drawerMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition text-left ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 shrink-0 text-emerald-400" />}
                </button>
              );
            })}}
          </div>

          <div className="border-t border-slate-800 pt-3">
            <div className="text-[10px] font-semibold text-slate-400 px-2 mb-2 uppercase tracking-wider">More</div>
            <div className="space-y-1">
              {additionalMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-900/60">
          {loading ? (
            <div className="text-[10px] text-slate-400 text-center py-2">Authenticating...</div>
          ) : user ? (
            <div className="space-y-2">
              <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition text-xs font-semibold"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition text-xs font-semibold"
              title="Sign in"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          )}
          <div className="text-[9px] text-slate-500 text-center mt-2">v2.4.0</div>
        </div>
      </aside>
    </>
  );
};