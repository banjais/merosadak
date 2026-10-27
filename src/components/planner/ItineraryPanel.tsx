import React from 'react';
import { AlertTriangle, Milestone, Navigation } from 'lucide-react';
import type { RoutePlanResult, VehicleType } from '../../types';
import { RouteJunctionTimeline } from '../RouteJunctionTimeline';

export type ItineraryView = 'timeline' | 'steps';

interface ItineraryPanelProps {
  route: RoutePlanResult;
  vehicle: VehicleType;
  view: ItineraryView;
  onViewChange: (view: ItineraryView) => void;
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
}

/** Junction ETAs or turn-by-turn steps — one segmented control, one list. */
export const ItineraryPanel: React.FC<ItineraryPanelProps> = ({ route, vehicle, view, onViewChange, onViewOnMap }) => (
  <div className="space-y-3">
    <div role="group" aria-label="Itinerary view" className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-0.5 text-xs font-bold">
      {([
        ['timeline', 'Junction ETAs', Milestone],
        ['steps', 'Turn by turn', Navigation],
      ] as const).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => onViewChange(id)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
            view === id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>

    {view === 'timeline' ? (
      <RouteJunctionTimeline routePlan={route} vehicle={vehicle} onViewOnMap={onViewOnMap} />
    ) : (
      <ol className="space-y-2">
        {route.steps.map((step, index) => {
          const climb = step.elevationChangeM ?? 0;
          return (
            <li
              key={index}
              className="flex items-start justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 font-semibold text-white">
                    <span>{step.instruction}</span>
                    {step.highwayCode && (
                      <span className="rounded border border-slate-700 bg-slate-800 px-1.5 text-[9px] font-bold text-cyan-300">
                        {step.highwayCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                    <span className="capitalize">{step.surface.replace('_', ' ')}</span>
                    <span>{step.durationMinutes} min</span>
                    {climb !== 0 && (
                      <span className={climb > 0 ? 'text-purple-400' : 'text-cyan-400'}>
                        {climb > 0 ? `+${climb} m climb` : `${climb} m descent`}
                      </span>
                    )}
                  </div>
                  {step.warning && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>{step.warning}</span>
                    </div>
                  )}
                </div>
              </div>
              <span className="shrink-0 font-bold text-slate-200">{step.distanceKm} km</span>
            </li>
          );
        })}
      </ol>
    )}
  </div>
);
