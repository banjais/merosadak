import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import type { Highway, RoutePlanResult, RoutePreference, VehicleType } from '../../types';
import { RouteHighwayInfoPanel } from '../RouteHighwayInfoPanel';
import { RouteTerrainAndTrafficAnalysis } from '../RouteTerrainAndTrafficAnalysis';
import { TripAssistantPanel } from '../TripAssistantPanel';

interface CustomAdvisory {
  summary?: string;
  bestDepartureWindow?: string;
  monsoonOrWeatherWarning?: string;
}

interface InsightsPanelProps {
  route: RoutePlanResult;
  vehicle: VehicleType;
  preference: RoutePreference;
  aiAdvisory: CustomAdvisory | null;
  loadingAdvisory: boolean;
  onGenerateAdvisory: () => void;
  onViewHighwayOnMap?: (highway: Highway) => void;
  onOpenHighwayDirectory?: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between gap-2 px-1">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

/** Understanding the route: highways on it, terrain and traffic, AI advice. */
export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  route,
  vehicle,
  preference,
  aiAdvisory,
  loadingAdvisory,
  onGenerateAdvisory,
  onViewHighwayOnMap,
  onOpenHighwayDirectory,
}) => {
  const saved = route.aiAdvisory;
  return (
    <div className="space-y-5">
      <Section title="Highways on this route">
        <RouteHighwayInfoPanel
          routeHighwayCodes={route.steps.map((s) => s.highwayCode).filter(Boolean) as string[]}
          incidents={route.incidentsOnRoute}
          onViewHighwayOnMap={onViewHighwayOnMap}
          onOpenHighwayDirectory={onOpenHighwayDirectory}
        />
      </Section>

      <Section title="Terrain & traffic">
        <RouteTerrainAndTrafficAnalysis routePlan={route} vehicle={vehicle} />
      </Section>

      <Section
        title="AI advisory"
        action={
          <button
            type="button"
            onClick={onGenerateAdvisory}
            disabled={loadingAdvisory}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loadingAdvisory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {loadingAdvisory ? 'Analysing…' : aiAdvisory || saved ? 'Refresh' : 'Generate'}
          </button>
        }
      >
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
          {aiAdvisory ? (
            <>
              <p>{aiAdvisory.summary}</p>
              {aiAdvisory.bestDepartureWindow && (
                <p className="text-cyan-300">
                  <span className="font-semibold text-slate-300">Best departure: </span>
                  {aiAdvisory.bestDepartureWindow}
                </p>
              )}
              {aiAdvisory.monsoonOrWeatherWarning && <p className="text-amber-400">⚠ {aiAdvisory.monsoonOrWeatherWarning}</p>}
            </>
          ) : saved ? (
            <>
              <p>{saved.summary}</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {saved.keyRecommendations.map((rec, i) => (
                  <li key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-[11px] text-slate-300">
                    ✓ {rec}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-2 text-center text-slate-400">Generate advice tailored to this route, season and vehicle.</p>
          )}
        </div>
        <TripAssistantPanel routePlan={route} vehicle={vehicle} preference={preference} />
      </Section>
    </div>
  );
};
