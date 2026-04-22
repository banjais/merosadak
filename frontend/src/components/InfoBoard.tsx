import React from 'react';
import {
  Clock, Mountain, AlertTriangle, ShieldCheck,
  BarChart3, MapPin, Fuel, Zap, Landmark, Share2
} from 'lucide-react';

export interface InfoBoardProps {
  onClose: () => void;
  activeTab: string;
  context: 'travel' | 'road' | 'service' | 'alert' | null;
  selectedObject: any;
  data: any[];
  trafficPrediction: any[];
  trafficHistory: any[];
  isProcessing: boolean;
  onCriticalTrigger: (msg: string) => void;
  descentBriefing: string | null;
  isHighContrast: boolean;
  pathAnalytics: any;
  vehicleHealth?: any; // Added
  onShareMission?: () => void;
}

export const InfoBoard: React.FC<InfoBoardProps> = ({
  activeTab,
  pathAnalytics,
  isHighContrast,
  onShareMission
}) => {
  if (activeTab === 'summary' || activeTab === 'travel') {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-none animate-in fade-in slide-in-from-bottom-2">
        {/* Primary Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-[2rem] bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-1 text-primary">
              <Clock size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Est. Duration</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-on-surface font-headline">
                {pathAnalytics?.duration ? Math.round(pathAnalytics.duration) : '--'}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant">MINS</span>
            </div>
          </div>

          <div className="p-4 rounded-[2rem] bg-amber-500/5 border border-amber-500/10">
            <div className="flex items-center gap-2 mb-1 text-amber-600">
              <AlertTriangle size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Terrain Risk</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-on-surface font-headline">
                {pathAnalytics?.landslides || 0}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant">SLIDES</span>
            </div>
          </div>
        </div>

        {/* Hazards Section */}
        {pathAnalytics?.hazards && pathAnalytics.hazards.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Detected Hazards</span>
            </div>
            <div className="grid gap-2">
              {pathAnalytics.hazards.map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container-low border border-outline/5 hover:border-primary/20 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                    <span className="text-xs font-bold text-on-surface uppercase tracking-tight">{h.type.replace('_', ' ')}</span>
                  </div>
                  <span className="text-[10px] font-black text-on-surface-variant/40">KM {h.distance?.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regional Quality Breakdown */}
        {pathAnalytics?.provinceStats && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Landmark size={16} className="text-primary" />
              <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Regional Quality Summary</span>
            </div>
            <div className="space-y-3">
              {pathAnalytics.provinceStats.map((stat: any, idx: number) => (
                <div key={idx} className="p-4 rounded-[1.5rem] bg-surface-container-low border border-outline/5">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-on-surface uppercase">{stat.name}</span>
                      <span className="text-[9px] font-bold text-on-surface-variant/50 uppercase">{stat.distanceKm.toFixed(1)} KM SECTION</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black ${stat.avgQuality >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        GRADE {stat.avgQuality >= 80 ? 'A' : stat.avgQuality >= 60 ? 'B' : 'C'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-outline/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${stat.avgQuality >= 70 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500'}`}
                      style={{ width: `${stat.avgQuality}%` }}
                    />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onShareMission?.(); }}
                    className="mt-4 w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Share2 size={14} /> Share Mission Analysis
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback for other tabs
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center opacity-30">
      <BarChart3 size={48} className="mb-4" />
      <p className="text-sm font-black uppercase tracking-[0.2em]">System Data Required</p>
      <p className="text-[10px] font-bold uppercase mt-2">Select a path to generate real-time analytics</p>
    </div>
  );
};