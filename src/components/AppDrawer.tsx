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
  Coins,
  ShieldAlert,
  ClipboardCheck,
  PlusCircle,
  Share2,
  HardDriveDownload,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { SubViewTab } from '../App';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: SubViewTab;
  onNavigateTab: (tab: SubViewTab) => void;
  onOpenTravelSteps?: () => void;
  onOpenDistanceMatrix: () => void;
  onOpenTollModal: () => void;
  onOpenSosModal: () => void;
  onOpenPreTripModal: () => void;
  onOpenReportModal: () => void;
  onOpenShareModal: () => void;
  onOpenOfflineManager: () => void;
  onCycleMapStyle?: () => void;
  incidentsCount?: number;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  activeTab = 'route',
  onNavigateTab,
  onOpenTravelSteps,
  onOpenDistanceMatrix,
  onOpenTollModal,
  onOpenSosModal,
  onOpenPreTripModal,
  onOpenReportModal,
  onOpenShareModal,
  onOpenOfflineManager,
  onCycleMapStyle,
  incidentsCount = 0,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Drawer Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="fixed top-0 left-0 bottom-0 w-84 max-w-[88vw] bg-slate-950 border-r border-slate-800 z-[1200] flex flex-col shadow-2xl animate-slideInLeft text-slate-100">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/90 flex items-center justify-center shadow-md shadow-amber-500/10">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#f59e0b" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-base tracking-tight text-white font-display">MERO SADAK</span>
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                  मेरो सडक
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                National Highway GIS Hub
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

        {/* Drawer Navigation Sections */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-5 custom-scrollbar">
          {/* Section 1: Highways, Corridors & Transit GIS */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2.5 flex items-center justify-between">
              <span>Highways &amp; Corridors</span>
              <span className="text-[9px] font-mono text-indigo-400">INVENTORY</span>
            </div>

            <div className="space-y-1">
              {/* Traffic Corridors */}
              <button
                onClick={() => {
                  onNavigateTab('traffic');
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'traffic'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'traffic' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-amber-400 group-hover:bg-slate-800'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Traffic Corridors &amp; Speed</span>
                    <span className="text-[10px] text-slate-400 font-normal">Congestion &amp; speed variance</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'traffic' ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>

              {/* Highway POIs & EV Stations */}
              <button
                onClick={() => {
                  onNavigateTab('pois');
                  onClose();
                }}
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
                    <span className="block font-bold">POIs, Fuel &amp; EV Fast Charging</span>
                    <span className="text-[10px] text-slate-400 font-normal">Fast-chargers, petrol &amp; motels</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'pois' ? 'text-cyan-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>

              {/* 80 National Highways */}
              <button
                onClick={() => {
                  onNavigateTab('highways');
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'highways'
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'highways' ? 'bg-purple-500 text-white' : 'bg-slate-900 text-purple-400 group-hover:bg-slate-800'}`}>
                    <Route className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">National Highways Directory</span>
                    <span className="text-[10px] text-slate-400 font-normal">All 80 routes (NH01–NH80)</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'highways' ? 'text-purple-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>

              {/* Transit Driving Dialects */}
              <button
                onClick={() => {
                  onNavigateTab('dialects');
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left group ${
                  activeTab === 'dialects'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg ${activeTab === 'dialects' ? 'bg-teal-500 text-slate-950' : 'bg-slate-900 text-teal-400 group-hover:bg-slate-800'}`}>
                    <Languages className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Transit Driving Dialects</span>
                    <span className="text-[10px] text-slate-400 font-normal">Maithili, Bhojpuri, Doteli terms</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeTab === 'dialects' ? 'text-teal-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              </button>
            </div>
          </div>

          {/* Section 2: Distance & Toll Calculators */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2.5">
              Calculators &amp; Toll Rates
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
                    <span className="block font-bold">62-City Distance Matrix</span>
                    <span className="text-[10px] text-slate-400 font-normal">Exact inter-city highway km</span>
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
                    <span className="text-[10px] text-slate-400 font-normal">Vehicle tariffs &amp; bypass rates</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </button>
            </div>
          </div>

          {/* Section 3: Field Tools & Offline GIS */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2.5">
              Trip Tools &amp; Offline
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onOpenPreTripModal();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-slate-900 text-emerald-400 group-hover:bg-slate-800">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Pre-Trip Vehicle Checklist</span>
                    <span className="text-[10px] text-slate-400 font-normal">Brakes, spare tyre &amp; fluids</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </button>

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
                    <span className="text-[10px] text-slate-400 font-normal">Crowdsource blockades &amp; slides</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onOpenShareModal();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-slate-900 text-purple-400 group-hover:bg-slate-800">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Share Active Trip Link</span>
                    <span className="text-[10px] text-slate-400 font-normal">SMS, WhatsApp &amp; copy URL</span>
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
                    <span className="text-[10px] text-slate-400 font-normal">Download 79 highways &amp; palikas</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-300">Nepal DoR &amp; DHM GIS</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">v2.4.0</span>
        </div>
      </aside>
    </>
  );
};
