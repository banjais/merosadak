import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  /** Visual travel at 100% (px). Higher = finer control. */
  maxPull?: number;
  /** Fraction of maxPull required to arm refresh (0–1). */
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

/** Rubber-band: fast at first, then resists — feels like iOS/Facebook. */
function resistance(delta: number, maxPull: number): number {
  if (delta <= 0) return 0;
  // Soft dead-zone so tiny finger jitter doesn't move the UI
  const effective = Math.max(0, delta - 10);
  // Asymptotic ease toward maxPull * 1.05
  const cap = maxPull * 1.08;
  return cap * (1 - Math.exp(-effective / (maxPull * 0.72)));
}

/**
 * Facebook-style pull-to-refresh with tuned sensitivity:
 * - ignores diagonal/horizontal pans
 * - dead-zone before indicator appears
 * - resistance curve + stable refs (no stale touch state)
 * - stays on the current page; only runs onRefresh
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  maxPull = 132,
  threshold = 0.58,
  disabled = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const pulling = useRef(false);
  const tracking = useRef(false); // past dead-zone + confirmed vertical
  const pullPxRef = useRef(0);
  const armedRef = useRef(false);
  const refreshingRef = useRef(false);
  const rafRef = useRef(0);

  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [armed, setArmed] = useState(false);

  const progress = Math.min(100, Math.round((pullPx / maxPull) * 100));
  const thresholdPx = maxPull * threshold;

  const setPull = useCallback((px: number, isArmed: boolean) => {
    pullPxRef.current = px;
    armedRef.current = isArmed;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPullPx(px);
      setArmed(isArmed);
    });
  }, []);

  const isDocumentAtTop = useCallback((): boolean => {
    return (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 1;
  }, []);

  const isTargetAtTop = useCallback(
    (target: EventTarget | null): boolean => {
      let el = target as HTMLElement | null;
      const root = containerRef.current;
      while (el && el !== root) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
          if (el.scrollTop > 1) return false;
        }
        el = el.parentElement;
      }
      return isDocumentAtTop();
    },
    [isDocumentAtTop]
  );

  const reset = useCallback(() => {
    pulling.current = false;
    tracking.current = false;
    setPull(0, false);
  }, [setPull]);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPull(Math.min(maxPull * 0.48, pullPxRef.current || maxPull * 0.48), true);
    try {
      await onRefresh();
    } finally {
      await new Promise((r) => setTimeout(r, 260));
      refreshingRef.current = false;
      setRefreshing(false);
      reset();
    }
  }, [maxPull, onRefresh, reset, setPull]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (!isTargetAtTop(e.target)) return;
      const t = e.touches[0];
      startY.current = t.clientY;
      startX.current = t.clientX;
      pulling.current = true;
      tracking.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshingRef.current) return;

      const t = e.touches[0];
      const dy = t.clientY - startY.current;
      const dx = t.clientX - startX.current;

      // Not a downward pull — cancel
      if (dy < 4) {
        if (tracking.current) setPull(0, false);
        return;
      }

      // Horizontal / map pan dominance — abort so Leaflet & drawers stay smooth
      if (!tracking.current && Math.abs(dx) > Math.abs(dy) * 0.85 && Math.abs(dx) > 12) {
        pulling.current = false;
        tracking.current = false;
        setPull(0, false);
        return;
      }

      // Must still be at scroll top when the gesture starts tracking
      if (!tracking.current) {
        if (!isTargetAtTop(e.target)) {
          pulling.current = false;
          return;
        }
        // Require a clear vertical intent before locking the gesture
        if (dy < 14) return;
        tracking.current = true;
      }

      const px = resistance(dy, maxPull);
      const isArmed = px >= thresholdPx;
      setPull(px, isArmed);

      // Own the gesture only once we're clearly pulling (avoids killing scroll)
      if (px > 8) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      if (refreshingRef.current) return;
      const shouldRefresh = tracking.current && (armedRef.current || pullPxRef.current >= thresholdPx);
      pulling.current = false;
      tracking.current = false;
      if (shouldRefresh) {
        void runRefresh();
      } else {
        reset();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, isTargetAtTop, maxPull, reset, runRefresh, setPull, thresholdPx]);

  const visible = pullPx > 4 || refreshing;
  const indicatorTranslate = refreshing
    ? Math.min(pullPx, maxPull * 0.45)
    : Math.min(pullPx, maxPull);

  return (
    <div
      ref={containerRef}
      className={`relative flex h-dvh max-h-dvh w-full min-h-0 flex-col overflow-auto overscroll-y-contain ${className}`}
      style={{ overscrollBehaviorY: 'contain', touchAction: 'pan-x pan-y' }}
    >
      <div
        className="pointer-events-none fixed left-0 right-0 z-[60] flex justify-center"
        style={{
          top: 'max(0.5rem, env(safe-area-inset-top))',
          opacity: visible ? 1 : 0,
          transform: `translateY(${indicatorTranslate * 0.32}px)`,
          transition:
            refreshing || pullPx === 0
              ? 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)'
              : 'none',
        }}
        aria-hidden={!visible}
      >
        <div
          className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-2.5 shadow-xl backdrop-blur-md transition-colors duration-150 ${
            refreshing
              ? 'border-emerald-400/50 bg-slate-950/90'
              : armed
                ? 'border-amber-400/55 bg-slate-950/90'
                : 'border-slate-600/50 bg-slate-950/85'
          }`}
        >
          <div className="relative h-11 w-11">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden>
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="3" />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={refreshing ? 'rgb(52,211,153)' : armed ? 'rgb(251,191,36)' : 'rgb(56,189,248)'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
                style={{ transition: refreshing ? 'stroke-dashoffset 0.2s ease' : 'none' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw
                className={`h-5 w-5 ${
                  refreshing ? 'animate-spin text-emerald-400' : armed ? 'text-amber-300' : 'text-cyan-300'
                }`}
                style={{ transform: refreshing ? undefined : `rotate(${progress * 3.6}deg)` }}
              />
            </div>
          </div>

          <div className="flex items-baseline gap-1 font-display">
            <span
              className={`text-sm font-black tabular-nums ${
                refreshing ? 'text-emerald-300' : armed ? 'text-amber-300' : 'text-cyan-300'
              }`}
            >
              {refreshing ? '…' : `${progress}`}
            </span>
            {!refreshing && <span className="text-[10px] font-bold text-slate-400">%</span>}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {refreshing ? 'Updating feeds' : armed ? 'Release to refresh' : 'Pull to refresh'}
          </span>

          <div className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${
                refreshing
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                  : armed
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                    : 'bg-gradient-to-r from-cyan-500 to-sky-400'
              }`}
              style={{
                width: `${refreshing ? 100 : progress}%`,
                transition: refreshing ? 'width 0.2s ease' : 'none',
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-auto"
        style={{
          transform:
            pullPx > 0 || refreshing ? `translateY(${Math.min(pullPx, maxPull) * 0.22}px)` : undefined,
          transition:
            pullPx === 0 && !refreshing ? 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none',
          willChange: pullPx > 0 ? 'transform' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
