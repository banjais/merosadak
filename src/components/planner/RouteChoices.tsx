import React from 'react';
import { Check, Map as MapIcon } from 'lucide-react';
import type { RoutePlanResult } from '../../types';

interface RouteChoicesProps {
  options: RoutePlanResult[];
  selectedId: string;
  onSelect: (route: RoutePlanResult) => void;
  onViewOnMap?: () => void;
}

const fmtTime = (min: number) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};

/**
 * Compact alternative-route picker: one tappable row per route
 * (name · distance · time · road score). No extra panels or tabs.
 */
export const RouteChoices: React.FC<RouteChoicesProps> = ({ options, selectedId, onSelect, onViewOnMap }) => {
  const fastest = Math.min(...options.map((o) => o.estimatedTimeMinutes));
  const shortest = Math.min(...options.map((o) => o.totalDistanceKm));
  const best = Math.max(...options.map((o) => o.roadConditionScore));

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Route choices">
      {options.map((opt, i) => {
        const selected = opt.id === selectedId;
        const tags = [
          opt.estimatedTimeMinutes === fastest && 'Fastest',
          opt.totalDistanceKm === shortest && 'Shortest',
          opt.roadConditionScore === best && options.length > 1 && 'Best road',
        ].filter(Boolean) as string[];
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(opt)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
              selected
                ? 'border-emerald-500/60 bg-emerald-500/10'
                : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${
                selected ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-600 text-slate-400'
              }`}
            >
              {selected ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-white">
                {opt.routeName || opt.viaHighlights || `Route ${i + 1}`}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                <span>{opt.totalDistanceKm.toFixed(0)} km</span>
                <span>· {fmtTime(opt.estimatedTimeMinutes)}</span>
                <span>· Road {opt.roadConditionScore}</span>
              </span>
            </span>
            {tags[0] && (
              <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                {tags[0]}
              </span>
            )}
          </button>
        );
      })}
      {onViewOnMap && (
        <button
          type="button"
          onClick={onViewOnMap}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
        >
          <MapIcon className="h-4 w-4" /> View on map
        </button>
      )}
    </div>
  );
};
