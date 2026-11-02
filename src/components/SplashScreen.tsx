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
  const intervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>( null);
  const progressRef = useRef(0);
  const hasFinishedRef = useRef(false);
  const isMountedRef = useRef(true);

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
    }, 400);
  }, [clearTimers, onFinished]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // The shell is a brand moment, not a loading gate. The app renders its real
  // content underneath from the start (data states begin empty), so the splash
  // must never hold the page hostage while a feed is in flight. It fades after
  // a short, fixed window regardless of readiness.
  useEffect(() => {
    let currentPct = progressRef.current;
    intervalRef.current = window.setInterval(() => {
      const increment = Math.floor(Math.random() * 8) + 4;
      currentPct = Math.min(99, currentPct + increment);
      progressRef.current = currentPct;
      setProgress(currentPct);

      if (currentPct < 25) {
        setStatusText('Initializing Theme & App Architecture…');
      } else if (currentPct < 55) {
        setStatusText('Loading Highway GIS & Tile Layers…');
      } else if (currentPct < 85) {
        setStatusText('Syncing Live Incidents, Weather & Traffic…');
      } else {
        setStatusText('Finishing load…');
      }
    }, 220);

    const timer = window.setTimeout(() => finishSplash(), 700);

    return () => {
      window.clearTimeout(timer);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [finishSplash]);

  // The app no longer waits on this shell, so an `isReady` flag arriving late
  // is a no-op rather than something that can re-trigger the fade.
  useEffect(() => {
    if (!isReady || hasFinishedRef.current) return;
    finishSplash();
  }, [isReady, finishSplash]);

  if (isHidden) return null;

  return (
    <div
      id="splashScreen"
      className={`fixed inset-0 z-[9999] bg-[#060a10] flex flex-col items-center justify-center transition-all duration-700 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none scale-[1.03]' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/12 via-transparent to-transparent blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_var(--tw-gradient-stops))] from-emerald-500/8 via-transparent to-transparent blur-3xl pointer-events-none opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_var(--tw-gradient-stops))] from-cyan-500/8 via-transparent to-transparent blur-3xl pointer-events-none opacity-50" />

      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px'
      }} />

      {/* Main Splash Card */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full animate-fadeIn">
        {/* Pulsing Brand Logo Container */}
        <div className="mb-6 animate-splash-pulse drop-shadow-[0_0_28px_rgba(16,185,129,0.45)]">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-500/30 via-transparent to-cyan-500/25 blur-xl opacity-60 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#0a121d]/95 border border-emerald-500/40 flex items-center justify-center shadow-2xl shadow-emerald-500/20 backdrop-blur-md ring-1 ring-emerald-500/10 ring-inset">
              <svg viewBox="0 0 24 24" width="52" height="52" className="sm:w-16 sm:h-16">
                <defs>
                  <linearGradient id="splashRoadGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"
                  fill="url(#splashRoadGrad)"
                  filter="drop-shadow(0 0 8px rgba(16,185,129,0.55))"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display mb-1.5 splash-shimmer-text leading-none">
          Mero Sadak
        </h1>

        {/* Nepali Subtitle */}
        <div className="text-base sm:text-lg font-extrabold text-emerald-400 mb-2.5 font-display tracking-wide leading-tight">
          मेरो सडक
        </div>

        {/* Description */}
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-8 leading-tight whitespace-nowrap">
          Nepal National Road Network & GIS
        </p>

        {/* Progress Bar Container */}
        <div className="w-full max-w-[320px] mb-5">
          <div className="flex items-center space-x-3 mb-2.5">
            <div className="flex-1 h-2.5 rounded-full bg-slate-950/90 overflow-hidden border border-emerald-500/20 p-[1px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_16px_rgba(16,185,129,0.7),_0_0_32px_rgba(34,211,238,0.35)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-xs font-black text-emerald-300 min-w-[42px] text-right tabular-nums">
              {progress}%
            </span>
          </div>

          {/* Dynamic Footer Status */}
          <div className="text-xs font-medium text-slate-400 tracking-wide min-h-[22px] transition-opacity duration-200">
            {statusText}
          </div>
        </div>

        {/* Decorative Accent Line */}
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent mb-5" />

        {/* Skip Link */}
        <button
          onClick={finishSplash}
          className="mt-2 text-xs text-slate-500 hover:text-emerald-400 transition-colors duration-200 underline underline-offset-4 cursor-pointer font-medium"
          disabled={isFadingOut}
        >
          Skip
        </button>
      </div>
    </div>
  );
};