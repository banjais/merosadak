import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Thermometer, Navigation, Activity, ShieldAlert, Clock, Mountain, ShieldCheck, Volume2, VolumeX, MessageSquare, AlertTriangle, Users } from 'lucide-react';
import { SafetyScoreRing } from '../SafetyScoreRing';

export interface DriverDashboardProps {
  onClose: () => void;
  safetyScore: number;
  safetyHistory: any[];
  vehicleHealth: any; // Added
  activeCriticalReminder?: string | null;
  onClearCriticalReminder?: () => void;
  currentSpeed: number;
  speed: number;
  isSpeeding: boolean;
  nextIntersection: any;
  userLocation: any;
  isMuted: boolean;
  onToggleMute: () => void;
  isNightVision?: boolean;
  isLeader?: boolean;
  convoyWarning?: boolean;
  isCollisionRisk?: boolean;
  onToggleNightVision?: (val: boolean) => void;
  isStealthMode?: boolean;
  onToggleStealthMode?: (val: boolean) => void;
  incidents?: any[];
  leaderboard?: any[];
  chatMessages?: any[];
  onSendMessage?: (text: string) => Promise<void>;
  safeTripKm: number;
  tripStartTime: number | null;
  isGhostMode: boolean;
  brakeHeat: number;
  terrainGrade: number;
  mechanicalStress: number;
  gForce?: number;
  pathAnalytics: any; // Added
  totalDistance?: number;
  isHighContrast?: boolean;
  aiSubtitle?: string | null;
  isCompactHUD?: boolean;
  onToggleCompactHUD?: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  onClose,
  safetyScore,
  currentSpeed,
  speed,
  isSpeeding,
  nextIntersection,
  isMuted,
  onToggleMute,
  isNightVision,
  isStealthMode,
  isLeader,
  convoyWarning,
  isCollisionRisk,
  safeTripKm,
  brakeHeat,
  terrainGrade,
  mechanicalStress,
  gForce = 0,
  aiSubtitle,
  isCompactHUD,
  onToggleCompactHUD,
  activeCriticalReminder,
  onClearCriticalReminder,
  pathAnalytics,
  totalDistance = 0,
  isHighContrast
}) => {
  const displaySpeed = Math.round(speed || currentSpeed || 0);
  const progress = totalDistance > 0 ? Math.min(100, (safeTripKm / totalDistance) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none">
      {isCollisionRisk && <div className="absolute inset-0 z-[4000] border-8 border-red-500 animate-pulse pointer-events-none" />}
      {/* Route Progress Bar */}
      <div className="h-1.5 w-full bg-outline/10 overflow-hidden shrink-0">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
        />
      </div>

      {/* Critical Alert Overlay */}
      <AnimatePresence>
        {activeCriticalReminder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-x-4 top-20 z-[3000] p-6 bg-error rounded-[2.5rem] shadow-[0_0_50px_rgba(239,68,68,0.5)] border-4 border-white/20 flex flex-col items-center text-center gap-4"
          >
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <AlertTriangle size={40} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Tactical Alert</h2>
              <p className="text-white font-bold mt-1">{activeCriticalReminder}</p>
            </div>
            <button
              onClick={onClearCriticalReminder}
              className="w-full py-4 bg-white text-error rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
            >
              Acknowledge
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main HUD Area */}
      <div className="flex-1 p-6 flex flex-col gap-6 scrollbar-none overflow-y-auto">

        {/* Primary Gauges Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Speedometer Card */}
          <div className={`p-6 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden border transition-colors ${isSpeeding ? 'bg-error/10 border-error/30 animate-pulse' : 'bg-surface-container-low border-outline/5'
            }`}>
            <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Velocity</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-6xl font-black font-headline leading-none ${isSpeeding ? 'text-error' : 'text-primary'}`}>{displaySpeed}</span>
              <span className="text-xs font-bold text-on-surface-variant/60 uppercase">KM/H</span>
            </div>
            {isSpeeding && <Zap size={16} className="text-error absolute top-4 right-4 animate-ping" />}
          </div>

          {/* Safety Card */}
          <div className="p-6 rounded-[2.5rem] bg-surface-container-low border border-outline/5 flex flex-col items-center justify-center">
            <SafetyScoreRing score={safetyScore} size={100} strokeWidth={8} />
            <div className="mt-2 text-center">
              <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest leading-none">Mission Safety</p>
            </div>
          </div>
        </div>

        {/* G-Force Meter Row */}
        <div className="px-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest">Lateral G-Force</span>
            <span className="text-[8px] font-black text-primary uppercase tracking-widest tabular-nums">{Math.abs(gForce).toFixed(2)} G</span>
          </div>
          <div className="relative h-6 bg-surface-container-low rounded-xl border border-outline/5 flex items-center px-4 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-outline/20" />
            <div className="flex justify-between w-full text-[6px] font-black text-on-surface-variant/20 uppercase">
              <span>L</span>
              <span>R</span>
            </div>
            <motion.div
              animate={{ x: `${Math.max(-100, Math.min(100, gForce * 100))}%` }}
              className={`absolute left-1/2 w-4 h-4 -ml-2 rounded-full border-2 border-white shadow-lg ${Math.abs(gForce) > 0.4 ? 'bg-error animate-pulse' : 'bg-primary'}`}
            />
          </div>
        </div>

        {/* Secondary Physics Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-3xl bg-surface-container-low border border-outline/5 flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl ${brakeHeat > 140 ? 'bg-error/20 text-error animate-pulse' : 'bg-orange-500/10 text-orange-500'}`}>
              <Thermometer size={20} />
            </div>
            <div>
              <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest block mb-0.5">Brake Heat</span>
              <span className="text-lg font-black text-on-surface tabular-nums">{Math.round(brakeHeat)}°C</span>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-surface-container-low border border-outline/5 flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl ${Math.abs(terrainGrade) > 8 ? 'bg-amber-500/20 text-amber-600' : 'bg-indigo-500/10 text-indigo-500'}`}>
              <Mountain size={20} />
            </div>
            <div>
              <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest block mb-0.5">Terrain Grade</span>
              <span className="text-lg font-black text-on-surface tabular-nums">{Math.abs(Math.round(terrainGrade))}%</span>
            </div>
          </div>

          <div className="col-span-2 p-4 rounded-3xl bg-surface-container-low border border-outline/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-2xl ${mechanicalStress > 40 ? 'bg-error/20 text-error animate-pulse' : 'bg-indigo-500/10 text-indigo-500'}`}>
                <Activity size={20} />
              </div>
              <div>
                <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest block mb-0.5">Structural Stress</span>
                <span className={`text-lg font-black tabular-nums ${mechanicalStress > 40 ? 'text-error' : 'text-on-surface'}`}>{Math.round(mechanicalStress)}%</span>
              </div>
            </div>
            <div className="w-32 h-1.5 bg-outline/10 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${Math.min(100, mechanicalStress)}%` }}
                className={`h-full ${mechanicalStress > 60 ? 'bg-error' : mechanicalStress > 30 ? 'bg-amber-500' : 'bg-primary'}`}
              />
            </div>
          </div>
        </div>

        {/* Next Maneuver / Intersection */}
        {nextIntersection && (
          <div className="p-5 rounded-[2rem] bg-primary text-white shadow-xl shadow-primary/20 flex items-center justify-between group overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                <Navigation size={24} className="rotate-45" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Upcoming Junction</p>
                <h4 className="text-lg font-black uppercase tracking-tighter leading-tight truncate max-w-[180px]">
                  {nextIntersection.name}
                </h4>
              </div>
            </div>
            <div className="text-right relative z-10">
              <span className="text-2xl font-black font-headline leading-none">{nextIntersection.distance.toFixed(1)}</span>
              <p className="text-[9px] font-black uppercase opacity-60">KM</p>
            </div>
          </div>
        )}

        {/* AI Co-Pilot Subtitles */}
        <AnimatePresence mode="wait">
          {aiSubtitle && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-outline/10 text-center"
            >
              <span className="text-[10px] font-bold italic text-on-surface-variant leading-relaxed">
                "{aiSubtitle}"
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mission Persistence Stats */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
              Safe Trip: {safeTripKm.toFixed(1)} KM
            </span>
          </div>
          {isLeader && (
            <div className="flex items-center gap-2">
              <Users size={14} className={convoyWarning ? 'text-amber-500 animate-pulse' : 'text-primary'} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${convoyWarning ? 'text-amber-500' : 'text-on-surface-variant'}`}>
                Convoy: {convoyWarning ? 'Alert' : 'Stable'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
              Active Mission
            </span>
          </div>
        </div>
      </div>

      {/* Pilot HUD Controls */}
      <div className="p-6 bg-surface-container-low/50 backdrop-blur-xl border-t border-outline/5 flex items-center gap-3">
        <button
          onClick={onToggleMute}
          className={`p-4 rounded-2xl border transition-all ${isMuted ? 'bg-error/10 border-error/20 text-error' : 'bg-white dark:bg-slate-800 border-outline/10 text-on-surface-variant hover:bg-surface-container-low'}`}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <button
          onClick={onToggleCompactHUD}
          className={`p-4 rounded-2xl border transition-all ${isCompactHUD ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white dark:bg-slate-800 border-outline/10 text-on-surface-variant hover:bg-surface-container-low'}`}
        >
          <Activity size={20} />
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-4 bg-error text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-error/20 active:scale-95 transition-transform"
        >
          Abort Mission
        </button>
      </div>
    </div>
  );
};