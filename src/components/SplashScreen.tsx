import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SplashScreenProps {
  onFinished?: () => void;
  isReady?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished, isReady = false }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing Map, Routes & Live Data…');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const hasFinishedRef = useRef(false);
  const isMountedRef = useRef(true);
  const startTimeRef = useRef(Date.now());

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const finishSplash = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    clearTimers();
    setIsFadingOut(true);
    hideTimeoutRef.current = window.setTimeout(() => {
      hideTimeoutRef.current = null;
      if (!isMountedRef.current) return;
      setIsHidden(true);
      if (onFinished) onFinished();
    }, 700);
  }, [clearTimers, onFinished]);

  useEffect(() => {
    isMountedRef.current = true;
    startTimeRef.current = Date.now();

    const timer = window.setTimeout(() => {
      setShowContent(true);
    }, 150);

    return () => {
      window.clearTimeout(timer);
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasFinishedRef.current || intervalRef.current !== null) return;

    let currentPct = progressRef.current;
    intervalRef.current = window.setInterval(() => {
      const increment = Math.floor(Math.random() * 8) + 4;
      currentPct = Math.min(100, currentPct + increment);
      progressRef.current = currentPct;
      setProgress(currentPct);

      if (currentPct < 25) {
        setStatusText('Initializing Theme & App Architecture…');
      } else if (currentPct < 55) {
        setStatusText('Loading Highway GIS & Tile Layers…');
      } else if (currentPct < 85) {
        setStatusText('Syncing Live Incidents, Weather & Traffic…');
      } else {
        setStatusText('Finalizing Route Engine & Map Layers…');
      }

      if (currentPct >= 100) {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        const elapsed = Date.now() - startTimeRef.current;
        const minDisplayTime = 3200;
        const remainingDelay = Math.max(0, minDisplayTime - elapsed);
        if (remainingDelay > 0) {
          setTimeout(finishSplash, remainingDelay);
        } else {
          finishSplash();
        }
      }
    }, 220);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!hasFinishedRef.current) {
        clearTimers();
      }
    };
  }, [clearTimers, finishSplash]);

  useEffect(() => {
    if (isReady && progress >= 100 && !hasFinishedRef.current) {
      finishSplash();
    }
  }, [isReady, progress, finishSplash]);

  if (isHidden) return null;

  return (
    <div
      id="splashScreen"
      className={`fixed inset-0 z-[9999] bg-[#070f1e] flex flex-col items-center justify-center transition-all duration-700 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none scale-[1.03]' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/12 via-transparent to-transparent blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_var(--tw-gradient-stops))] from-amber-500/8 via-transparent to-transparent blur-3xl pointer-events-none opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_var(--tw-gradient-stops))] from-emerald-500/6 via-transparent to-transparent blur-3xl pointer-events-none opacity-40" />

      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px'
      }} />

      {/* Main Splash Card */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full animate-fadeIn">
        {/* Pulsing Gold Logo Container */}
        <div className="mb-6 animate-splash-pulse drop-shadow-[0_0_28px_rgba(245,158,11,0.5)]">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/30 via-transparent to-emerald-500/20 blur-xl opacity-60 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-950/95 border border-amber-500/50 flex items-center justify-center shadow-2xl shadow-amber-500/25 backdrop-blur-md ring-1 ring-amber-500/10 ring-inset">
              <svg viewBox="0 0 24 24" width="52" height="52" className="sm:w-16 sm:h-16">
                <path
                  d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"
                  fill="#f59e0b"
                  filter="drop-shadow(0 0 8px rgba(245,158,11,0.6))"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-display mb-1.5 splash-shimmer-text leading-none">
          MERO SADAK
        </h1>

        {/* Nepali Subtitle */}
        <div className="text-lg sm:text-xl font-extrabold text-amber-400 mb-2.5 font-display tracking-wide leading-tight">
          मेरो सडक
        </div>

        {/* Description */}
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400 mb-8 leading-tight">
          Nepal National Road Network & GIS
        </p>

        {/* Progress Bar Container */}
        <div className="w-full max-w-[320px] mb-5">
          <div className="flex items-center space-x-3 mb-2.5">
            <div className="flex-1 h-2.5 rounded-full bg-slate-900/90 overflow-hidden border border-slate-700/60 p-[1px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full transition-all duration-300 ease-out shadow-[0_0_16px_rgba(245,158,11,0.8),_0_0_32px_rgba(245,158,11,0.4)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-sm font-black text-amber-300 min-w-[42px] text-right tabular-nums">
              {progress}%
            </span>
          </div>

          {/* Dynamic Footer Status */}
          <div className="text-sm font-medium text-slate-400 tracking-wide min-h-[22px] transition-opacity duration-200">
            {statusText}
          </div>
        </div>

        {/* Decorative Accent Line */}
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mb-5" />

        {/* Skip Link */}
        <button
          onClick={finishSplash}
          className="mt-2 text-sm text-slate-500 hover:text-amber-400 transition-colors duration-200 underline underline-offset-4 cursor-pointer font-medium"
          disabled={isFadingOut}
        >
          Skip loading screen
        </button>
      </div>
    </div>
  );
};