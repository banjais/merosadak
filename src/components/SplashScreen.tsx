import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinished?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing Map, Routes & Live Data…');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let currentPct = 0;
    const interval = setInterval(() => {
      const increment = Math.floor(Math.random() * 12) + 8;
      currentPct = Math.min(100, currentPct + increment);
      setProgress(currentPct);

      if (currentPct < 30) {
        setStatusText('Initializing Theme & App Architecture…');
      } else if (currentPct < 65) {
        setStatusText('Loading Highway GIS & Tile Layers…');
      } else if (currentPct < 90) {
        setStatusText('Syncing Live Incidents, Weather & Traffic…');
      } else {
        setStatusText('Ready! Welcome to Mero Sadak');
      }

      if (currentPct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsFadingOut(true);
          setTimeout(() => {
            setIsHidden(true);
            if (onFinished) onFinished();
          }, 600);
        }, 350);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [onFinished]);

  if (isHidden) return null;

  return (
    <div
      id="splashScreen"
      className={`fixed inset-0 z-[9999] bg-[#070f1e] flex flex-col items-center justify-center transition-all duration-600 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-transparent blur-3xl pointer-events-none" />

      {/* Main Splash Card */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full animate-fadeIn">
        {/* Pulsing Gold Logo Container */}
        <div className="mb-5 animate-splash-pulse drop-shadow-[0_0_24px_rgba(245,158,11,0.6)]">
          <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-slate-900/90 border border-amber-500/40 flex items-center justify-center shadow-2xl shadow-amber-500/20 backdrop-blur-md">
            <svg viewBox="0 0 24 24" width="48" height="48" className="sm:w-14 sm:h-14">
              <path
                d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"
                fill="#f59e0b"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-display mb-1 splash-shimmer-text">
          MERO SADAK
        </h1>

        {/* Nepali Subtitle */}
        <div className="text-base sm:text-lg font-extrabold text-amber-400 mb-2 font-display tracking-wide">
          मेरो सडक
        </div>

        {/* Description */}
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-7">
          Nepal National Road Network &amp; GIS
        </p>

        {/* Progress Bar Container */}
        <div className="w-full max-w-[280px] mb-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex-1 h-2 rounded-full bg-slate-800/90 overflow-hidden border border-slate-700/60 p-[1px]">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full transition-all duration-150 shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-xs font-black text-amber-300 min-w-[36px] text-right">
              {progress}%
            </span>
          </div>

          {/* Dynamic Footer Status */}
          <div className="text-[11px] font-medium text-slate-400 tracking-wide min-h-[18px]">
            {statusText}
          </div>
        </div>

        {/* Skip Link */}
        <button
          onClick={() => {
            setIsFadingOut(true);
            setTimeout(() => {
              setIsHidden(true);
              if (onFinished) onFinished();
            }, 600);
          }}
          className="mt-4 text-[11px] text-slate-500 hover:text-amber-400 transition underline underline-offset-4 cursor-pointer"
        >
          Skip loading screen
        </button>
      </div>
    </div>
  );
};
