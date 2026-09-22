import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  /** Max pull distance in px (progress reaches 100% here) */
  maxPull?: number;
  /** Release threshold as fraction of maxPull (0–1) */
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Facebook-style pull-to-refresh: stays on the current page, refreshes data only.
 * Progress indicator tracks 0–100% for the full pull distance.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  maxPull = 120,
  threshold = 0.72,
  disabled = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [armed, setArmed] = useState(false);

  const progress = Math.min(100, Math.round((pullPx / maxPull) * 100));
  const thresholdPx = maxPull * threshold;

  const findScrollParent = useCallback((target: EventTarget | null): HTMLElement | null => {
    let el = target as HTMLElement | null;
    while (el && el !== containerRef.current) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollTop > 0) {
        return el;
      }
      el = el.parentElement;
    }
    // window / document scroll
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
      return document.documentElement;
    }
    return null;
  }, []);

  const isAtTop = useCallback(
    (target: EventTarget | null): boolean => {
      const scroller = findScrollParent(target);
      if (!scroller) {
        // No nested scroller with offset — treat as top if window is top
        return (window.scrollY || document.documentElement.scrollTop || 0) <= 2;
      }
      if (scroller === document.documentElement) {
        return (window.scrollY || document.documentElement.scrollTop || 0) <= 2;
      }
      return scroller.scrollTop <= 2;
    },
    [findScrollParent]
  );

  const reset = useCallback(() => {
    pulling.current = false;
    setPullPx(0);
    setArmed(false);
  }, []);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullPx(maxPull * 0.55);
    try {
      await onRefresh();
    } finally {
      // brief success hold
      await new Promise((r) => setTimeout(r, 280));
      setRefreshing(false);
      reset();
    }
  }, [maxPull, onRefresh, reset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!isAtTop(e.target)) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const y = e.touches[0].clientY;
      const delta = y - startY.current;
      if (delta <= 0) {
        setPullPx(0);
        setArmed(false);
        return;
      }
      if (!isAtTop(e.target) && pullPx < 8) {
        // User started scrolling content — cancel pull
        reset();
        return;
      }
      // Rubber-band easing
      const dampened = Math.min(maxPull * 1.15, delta * 0.55);
      setPullPx(dampened);
      setArmed(dampened >= thresholdPx);
      // Prevent browser native overscroll/refresh while we own the gesture
      if (dampened > 6) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      if (refreshing) return;
      if (armed || pullPx >= thresholdPx) {
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
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [armed, disabled, isAtTop, maxPull, pullPx, refreshing, reset, runRefresh, thresholdPx]);

  const visible = pullPx > 2 || refreshing;
  const indicatorTranslate = refreshing
    ? Math.min(pullPx, maxPull * 0.5)
    : Math.min(pullPx, maxPull);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col min-h-0 flex-1 overscroll-y-contain ${className}`}
      style={{ overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}
    >
      {/* Pull indicator — does not unmount the page */}
      <div
        className="pointer-events-none fixed left-0 right-0 z-[60] flex justify-center"
        style={{
          top: 'max(0.5rem, env(safe-area-inset-top))',
          opacity: visible ? 1 : 0,
          transform: `translateY(${indicatorTranslate * 0.35}px)`,
          transition: refreshing || pullPx === 0 ? 'opacity 0.2s ease, transform 0.25s ease' : 'none',
        }}
        aria-hidden={!visible}
      >
        <div
          className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-2.5 shadow-xl backdrop-blur-md transition-colors ${
            refreshing
              ? 'border-emerald-400/50 bg-slate-950/90'
              : armed
                ? 'border-amber-400/55 bg-slate-950/90'
                : 'border-slate-600/50 bg-slate-950/85'
          }`}
        >
          {/* Circular progress ring */}
          <div className="relative h-11 w-11">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="rgba(148,163,184,0.25)"
                strokeWidth="3"
              />
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
                  refreshing
                    ? 'animate-spin text-emerald-400'
                    : armed
                      ? 'text-amber-300'
                      : 'text-cyan-300'
                }`}
                style={{
                  transform: refreshing ? undefined : `rotate(${progress * 3.6}deg)`,
                }}
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

          {/* Linear bar under the ring */}
          <div className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                refreshing
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                  : armed
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                    : 'bg-gradient-to-r from-cyan-500 to-sky-400'
              }`}
              style={{ width: `${refreshing ? 100 : progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content shifts slightly with the pull (Facebook-like) but never unmounts */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          transform: pullPx > 0 || refreshing ? `translateY(${Math.min(pullPx, maxPull) * 0.28}px)` : undefined,
          transition: pullPx === 0 && !refreshing ? 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
