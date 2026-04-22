import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Activity } from 'lucide-react';

interface GradeHUDProps {
  grade: number;
  roll: number;
  roadQuality?: string;
  precipitation?: number;
  isNightVision: boolean;
  isStealthMode: boolean;
}

export const GradeHUD: React.FC<GradeHUDProps> = ({ 
  grade, roll, roadQuality, precipitation = 0, isNightVision, isStealthMode 
}) => {
  const rotation = useMemo(() => Math.atan(grade / 100) * (180 / Math.PI), [grade]);
  const gradeColor = Math.abs(grade) > 10 ? 'text-error' : 'text-emerald-500';
  
  const tractionRisk = useMemo(() => Math.abs(grade) + Math.abs(roll), [grade, roll]);
  const tractionLimit = useMemo(() => {
    const q = roadQuality?.toUpperCase() || 'B';
    let base = 35;
    if (q === 'A') base = 45;
    else if (q === 'B') base = 35;
    else if (q === 'C') base = 25;
    else if (q === 'D') base = 18;
    else base = 12;

    const stealthFactor = isStealthMode ? 1.5 : 1.0;
    return base * stealthFactor * Math.max(0.5, 1 - (precipitation / 40));
  }, [roadQuality, isStealthMode, precipitation]);

  const isLosingTraction = tractionRisk > tractionLimit;

  return (
    <div className="relative flex items-center gap-4 bg-black/60 backdrop-blur-xl p-3 rounded-[2rem] border border-white/10 shadow-2xl pointer-events-none">
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-14 h-14 rounded-full border-2 border-white/20 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out" style={{ transform: `rotate(${-rotation}deg)` }}>
            <div className="w-[150%] h-px bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
          </div>
          <div className={`z-10 w-7 h-1 bg-current ${gradeColor} shadow-lg rounded-full transition-transform duration-500`} style={{ transform: `rotate(${-rotation}deg)` }} />
        </div>
        <span className={`text-[8px] font-black ${gradeColor}`}>PITCH</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isLosingTraction ? 'bg-error border-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-white/10 border-white/20 text-white/40'}`}>
          <Activity size={16} className={isLosingTraction ? 'text-white' : 'text-white/40'} />
        </div>
        <span className={`text-[8px] font-black ${isLosingTraction ? 'text-error animate-pulse' : 'text-white/40'}`}>FRICTION</span>
      </div>
    </div>
  );
};