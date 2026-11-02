import React, { useEffect, useState } from 'react';
import { Navigation, X, ChevronUp } from 'lucide-react';
import type { RoutePlanResult } from '../types';
import { useHaptic } from '../hooks/useHaptic';

interface MyRouteFabProps {
  /** The currently-planned route. FAB hides when null. */
  route: RoutePlanResult | null;
  /** Whether the route verdict panel is currently visible on screen. */
  isVerdictVisible?: boolean;
  /** Click handler — usually scroll-to-verdict or open-the-planner action. */
  onClick?: () => void;
  /** Clear the active route (X). */
  onClear?: () => void;
}

/**
 * Bottom-left "My Route" FAB.
 *
 * Shows only when a route has been calculated (`route` is non-null). Click
 * scrolls the planner verdict back into view; the X dismisses the route.
 * Sits bottom-LEFT so it doesn't collide with the existing SpeedDialFab
 * (bottom-right) — both round, same visual family.
 *
 * Designed to be unobtrusive: emerald→teal→cyan gradient to read as
 * "go / start", pulse on first appearance so the user notices it after
 * planning, and collapses to a small dot when scrolled to the verdict
 * (where the action is already in view).
 */
export const MyRouteFab: React.FC<MyRouteFabProps> = ({
  route,
  isVerdictVisible = false,
  onClick,
  onClear,
}) => {
  const { triggerLight: hapticLight } = useHaptic();
  const [didPulse, setDidPulse] = useState(false);

  // One-time pulse on first appearance so the user notices the FAB after
  // planning a route. Subsequent re-renders (e.g. vehicle change) don't
  // re-pulse.
  useEffect(() => {
    if (route && !didPulse) {
      setDidPulse(true);
    }
    if (!route) {
      setDidPulse(false);
    }
  }, [route, didPulse]);

  if (!route) return null;

  const totalKm = route.totalDistanceKm ?? 0;
  const totalMin = route.estimatedTimeMinutes ?? 0;
  const hours = Math.floor(totalMin / 60);
  const mins = Math.round(totalMin % 60);
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  const handleMain = () => {
    hapticLight();
    onClick?.();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    onClear?.();
  };

  return (
    <div
      className={`fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-40 flex items-center transition-all duration-300 ${
        isVerdictVisible ? 'opacity-0 translate-y-3 pointer-events-none' : 'opacity-100'
      }`}
      aria-label={`My route: ${route.origin?.name} to ${route.destination?.name}, ${totalKm.toFixed(1)} km, ${timeLabel}`}
    >
      <button
        type="button"
        onClick={handleMain}
        className="group flex items-center gap-2 rounded-full border border-emerald-500/40 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-2xl shadow-emerald-500/30 pl-2 pr-3.5 py-1.5 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-95 transition-all"
        title={`My route · ${route.origin?.name} → ${route.destination?.name}`}
      >
        {/* Round icon core — same round motif as the right-side SpeedDialFab */}
        <span className="w-8 h-8 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center ring-1 ring-white/30 transition">
          <Navigation className="w-4 h-4" />
        </span>
        <span className="flex flex-col leading-tight text-left">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">
            My Route
          </span>
          <span className="text-xs font-black text-white tabular-nums">
            {totalKm.toFixed(1)} km · {timeLabel}
          </span>
        </span>
        {onClear && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClear(e as unknown as React.MouseEvent);
              }
            }}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-rose-500/80 flex items-center justify-center transition cursor-pointer"
            title="Clear route"
            aria-label="Clear route"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronUp className="w-3.5 h-3.5 text-white/70 group-hover:text-white group-hover:-translate-y-0.5 transition" />
      </button>
    </div>
  );
};

export default MyRouteFab;
