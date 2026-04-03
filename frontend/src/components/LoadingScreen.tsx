import React, { useState, useEffect } from 'react';
import { Navigation } from 'lucide-react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      {/* 🧩 Animated Puzzle Pieces / Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-indigo-500/10 rounded-xl animate-float blur-sm"
            style={{
              width: Math.random() * 100 + 40 + 'px',
              height: Math.random() * 100 + 40 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animationDelay: i * 0.5 + 's',
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        ))}
      </div>

      {/* Center Logo Area */}
      <div className="relative z-10 flex flex-col items-center animate-in zoom-in duration-1000">
        <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)] mb-8">
          <Navigation className="w-12 h-12 text-indigo-600 animate-pulse" />
        </div>
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-sm px-8 flex flex-col items-center">
        <h1 className="text-3xl font-black tracking-tighter text-white mb-2">MEROSADAK</h1>
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-[0.3em] text-center mb-10 opacity-80">
          Nepal's Intelligent Travel Companion
        </p>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(99,102,241,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest tabular-nums italic">
          Synchronizing Himalayan Data... {progress}%
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-40px) rotate(10deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};
