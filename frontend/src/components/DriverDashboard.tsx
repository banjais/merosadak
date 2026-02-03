import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  Mic, 
  ShieldAlert, 
  Map as MapIcon, 
  Compass, 
  Wind, 
  Activity,
  Maximize2,
  Minimize2,
  Volume2,
  LogOut,
  Clock
} from 'lucide-react';

interface DriverDashboardProps {
  onClose: () => void;
  speed?: number;
  heading?: number;
  elevation?: number;
  weather?: any;
  currentRoad?: string;
  nextIncident?: any;
  isLive?: boolean;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ 
  onClose, 
  speed = 0, 
  heading = 0,
  currentRoad = "Prithvi Highway",
  weather = { temp: 22, condition: "Clear" },
  nextIncident = { type: "Block", dist: "12km", name: "Mugling" },
  isLive = false
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVoiceTrigger = () => {
    setIsListening(true);
    setTimeout(() => setIsListening(false), 3000);
    // Integrate with actual voice service here
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden mode-transition">
      
      {/* 📺 HUD Scanline Effect */}
      <div className="scanline-effect" />

      {/* 🔝 Top Status Bar */}
      <div className="flex justify-between items-center p-4 sm:p-6 glass-pilot border-b border-white/10 z-20">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 sm:p-3 rounded-2xl shadow-lg shadow-indigo-500/40 neon-border-indigo">
            <Navigation className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter uppercase italic text-indigo-400">Sadak-Sathi</h1>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              <span className={`w-2 h-2 ${isLive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'} rounded-full animate-pulse`} />
              Telemetry: {isLive ? 'Streaming' : 'Offline'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
            <div className="text-right hidden xs:block">
                <div className="text-2xl sm:text-4xl font-black tracking-tighter tabular-nums text-white">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-3 sm:p-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20 shadow-lg shadow-red-500/10"
            >
                <LogOut className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6 p-4 sm:p-6 overflow-y-auto sm:overflow-hidden z-10">
        
        {/* Left: Telemetry */}
        <div className="col-span-1 sm:col-span-4 grid grid-cols-1 gap-4 sm:gap-6">
            <div className="glass-pilot rounded-[32px] sm:rounded-[40px] border border-white/10 p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden group neon-border-indigo">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-50" />
                <div className="text-8xl sm:text-[120px] font-black leading-none tracking-tighter tabular-nums z-10 text-white">
                    {speed}
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-500 uppercase z-10 tracking-[0.3em]">km/h</div>
            </div>

            <div className="glass-pilot rounded-[32px] sm:rounded-[40px] border border-white/10 p-6 sm:p-8 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center border-r border-white/10">
                    <Compass className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-400 mb-2 rotate-45" />
                    <div className="text-2xl sm:text-3xl font-black italic">NW</div>
                </div>
                <div className="flex flex-col items-center justify-center">
                    <Wind className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 mb-2" />
                    <div className="text-2xl sm:text-3xl font-black">{weather.temp}°</div>
                </div>
            </div>
        </div>

        {/* Middle: Active Navigation / Road Info */}
        <div className="col-span-1 sm:col-span-8 glass-pilot rounded-[32px] sm:rounded-[40px] border border-white/10 p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden min-h-[400px]">
            <div className="absolute top-0 right-0 p-6 sm:p-8">
                <Activity className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-500/30 animate-pulse" />
            </div>

            <div>
                <div className="text-[10px] sm:text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-2 text-center sm:text-left">Pilot Vector Path</div>
                <div className="text-4xl sm:text-7xl font-black tracking-tight mb-6 sm:mb-8 line-clamp-1 text-center sm:text-left text-white">{currentRoad}</div>
                
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-8 sm:mb-12 shadow-inner">
                     <div className="h-full w-2/3 bg-gradient-to-r from-indigo-600 via-indigo-400 to-white rounded-full relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_20px_white]" />
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 items-end">
                <div className="bg-red-500/5 border border-red-500/20 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] flex items-center gap-4 sm:gap-6 group hover:bg-red-500/10 transition-colors">
                    <ShieldAlert className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 shrink-0" />
                    <div>
                        <div className="text-[10px] sm:text-sm font-bold text-red-500 uppercase tracking-widest mb-1 italic">Hazard Encounter</div>
                        <div className="text-xl sm:text-3xl font-black">{nextIncident.dist} to {nextIncident.name}</div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:gap-4">
                    <button 
                        className={`w-full py-8 sm:py-10 rounded-[24px] sm:rounded-[32px] font-black text-2xl sm:text-3xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl ${isListening ? 'bg-indigo-600 text-white ring-8 ring-indigo-500/20' : 'bg-white text-slate-950 hover:bg-indigo-50'}`}
                        onClick={handleVoiceTrigger}
                    >
                        {isListening ? "LINK ACTIVE..." : "VOICE PTT"}
                    </button>
                    
                    <div className="flex gap-2 sm:gap-4">
                        <button className="flex-1 py-4 sm:py-6 glass-pilot hover:bg-white/10 border border-white/10 rounded-2xl sm:rounded-3xl font-bold flex items-center justify-center gap-2 text-sm text-indigo-300">
                            <Volume2 className="w-5 h-5" /> Audio
                        </button>
                        <button className="flex-1 py-4 sm:py-6 glass-pilot hover:bg-white/10 border border-white/10 rounded-2xl sm:rounded-3xl font-bold flex items-center justify-center gap-2 text-sm text-indigo-300">
                            <Maximize2 className="w-5 h-5" /> HUD
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 🧭 Dynamic Bottom Strip */}
      <div className="flex flex-col sm:flex-row px-6 sm:px-12 py-6 sm:py-8 bg-indigo-600 justify-between items-center gap-4">
            <div className="text-lg sm:text-2xl font-black tracking-wide flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-center sm:text-left">
                <span className="opacity-70 uppercase text-[10px] sm:text-sm font-bold tracking-widest text-white/80">Next Turn</span>
                <span className="text-xl sm:text-4xl italic uppercase underline decoration-2 sm:decoration-4 underline-offset-4 sm:underline-offset-8">Direct - Narayangarh Junction</span>
            </div>
            <div className="flex gap-8 sm:gap-12">
                <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-black italic">1h 42m</div>
                    <div className="text-[9px] sm:text-[10px] uppercase font-bold text-white/60">Estimated</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-black italic">142 km</div>
                    <div className="text-[9px] sm:text-[10px] uppercase font-bold text-white/60">Remaining</div>
                </div>
            </div>
      </div>

    </div>
  );
};
