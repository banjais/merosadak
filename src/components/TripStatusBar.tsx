import React from 'react';
import { AlertTriangle, Clock, Navigation, CloudRain } from 'lucide-react';
import { RoutePlanResult } from '../types';

interface TripStatusBarProps {
  route: RoutePlanResult | null;
  alertCount?: number;
  weatherNote?: string | null;
  className?: string;
}

/** Driver / passenger priority strip: route → time → alerts → weather. Mobile-first. */
export const TripStatusBar: React.FC<TripStatusBarProps> = ({
  route,
  alertCount = 0,
  weatherNote,
  className = '',
}) => {
  if (!route) return null;

  const hours = Math.floor(route.estimatedTimeMinutes / 60);
  const mins = Math.round(route.estimatedTimeMinutes % 60);
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  const km = Number(route.totalDistanceKm.toFixed(1));

  return (
    <div
      className={`mx-2 sm:mx-3 mb-1 rounded-xl border border-slate-700/80 bg-slate-900/95 px-2.5 py-2 shadow-md backdrop-blur-sm ${className}`}
      role="status"
      aria-label="Trip status"
    >
      <div className="flex items-center gap-2 text-[11px] sm:text-xs">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-slate-100">
          <Navigation className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="truncate font-bold">
            {route.origin.name}
            <span className="mx-1 font-normal text-slate-500">→</span>
            {route.destination.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 tabular-nums">
          <span className="font-black text-emerald-300">{km} km</span>
          <span className="inline-flex items-center gap-0.5 text-cyan-300">
            <Clock className="h-3 w-3" />
            {timeLabel}
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
        <span className="font-medium text-slate-300">Driver · passenger</span>
        {alertCount > 0 ? (
          <span className="inline-flex items-center gap-0.5 font-semibold text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            {alertCount} road alert{alertCount === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-slate-500">No active alerts on route</span>
        )}
        {weatherNote && (
          <span className="inline-flex items-center gap-0.5 text-sky-300">
            <CloudRain className="h-3 w-3" />
            {weatherNote}
          </span>
        )}
      </div>
    </div>
  );
};

export default TripStatusBar;
