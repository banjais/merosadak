import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Fuel,
  Pencil,
  Mountain,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import type { RoutePlanResult } from '../../types';

interface RouteVerdictProps {
  plan: RoutePlanResult;
  /** Fuel + toll for the selected vehicle, already computed by the planner. */
  totalCostNpr: number;
  /** Highway codes the route actually drives, e.g. "NH05 · NH02". */
  viaLabel: string;
  tripStarted: boolean;
  onStartTrip: () => void;
  onEdit: () => void;
}

type Verdict = {
  tone: 'clear' | 'caution' | 'blocked';
  label: string;
  sentence: string;
  pill: string;
  ring: string;
  bar: string;
};

/**
 * The one card every route search must open with: can I depart, and is the
 * road open? The verdict comes straight off the surveyed segment statuses
 * (statusSummary) plus live incident reports, so "ROUTE CLEAR" is a claim the
 * data earns, not a decoration. Everything deeper lives in the detail
 * sections below — this card stays short on purpose.
 */
export const RouteVerdict: React.FC<RouteVerdictProps> = ({
  plan,
  totalCostNpr,
  viaLabel,
  tripStarted,
  onStartTrip,
  onEdit,
}) => {
  const { clearKm = 0, cautionKm = 0, obstructedKm = 0 } = plan.statusSummary ?? {};
  const incidents = plan.incidentsOnRoute?.length ?? 0;
  const isAerialFallback = Boolean(
    plan.__aerialWarning ||
    plan.routeName?.toLowerCase().includes('aerial') ||
    plan.routeBadge?.toLowerCase().includes('aerial')
  );

  const hasBlocked = obstructedKm > 0;
  const hasCaution = !hasBlocked && (cautionKm > 0 || incidents > 0);

  const verdict: Verdict = isAerialFallback
    ? {
        tone: 'caution',
        label: 'AERIAL ESTIMATE',
        sentence: 'No connected road route is available for this pair. This is straight-line distance only; actual road distance and travel time will be longer. Road conditions are not verified.',
        pill: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
        ring: 'border-amber-500/40',
        bar: 'bg-amber-400',
      }
    : hasBlocked
    ? {
        tone: 'blocked',
        label: 'PARTIALLY BLOCKED',
        sentence: `${Math.round(obstructedKm)} km of this route is obstructed — check the blocks section before you depart.`,
        pill: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
        ring: 'border-rose-500/40',
        bar: 'bg-rose-500',
      }
    : hasCaution
      ? {
          tone: 'caution',
          label: 'PASS WITH CAUTION',
          sentence: `Open the whole way, but ${[
            cautionKm > 0 ? `${Math.round(cautionKm)} km needs care` : null,
            incidents > 0 ? `${incidents} active alert${incidents === 1 ? '' : 's'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}.`,
          pill: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
          ring: 'border-amber-500/40',
          bar: 'bg-amber-400',
        }
      : {
          tone: 'clear',
          label: 'ROUTE CLEAR',
          sentence: 'Every surveyed segment on this route reports open status.',
          pill: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
          ring: 'border-emerald-500/40',
          bar: 'bg-emerald-400',
        };

  const total = Math.max(clearKm + cautionKm + obstructedKm, 0.001);
  const hours = Math.floor(plan.estimatedTimeMinutes / 60);
  const mins = Math.round(plan.estimatedTimeMinutes % 60);

  const stats = [
    { Icon: Navigation, tone: 'text-emerald-400', label: 'Distance', value: isAerialFallback ? `${plan.totalDistanceKm.toFixed(1)} km · aerial` : `${plan.totalDistanceKm.toFixed(1)} km` },
    { Icon: Clock, tone: 'text-cyan-400', label: 'Drive time', value: isAerialFallback ? 'Not available' : hours > 0 ? `${hours}h ${mins}m` : `${mins} min` },
    { Icon: Fuel, tone: 'text-amber-400', label: 'Fuel + toll', value: isAerialFallback ? 'Not available' : `Rs ${totalCostNpr.toLocaleString()}` },
    { Icon: Mountain, tone: 'text-purple-400', label: 'High point', value: isAerialFallback ? 'Not available' : `${plan.maxElevationM.toLocaleString()} m` },
  ];

  return (
    <section
      className={`rounded-3xl border ${verdict.ring} bg-gradient-to-b from-slate-900/90 to-slate-950/80 p-4 sm:p-5 backdrop-blur-md shadow-2xl`}
      aria-label="Route verdict"
    >
      {/* Verdict line — readable in one glance, no scrolling, no tabs. */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black tracking-wide ${verdict.pill}`}
          role="status"
        >
          {hasBlocked ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {verdict.label}
        </span>
        <span className="text-xs font-bold text-white truncate">
          {plan.origin.name} <ArrowRight className="inline h-3 w-3 text-slate-500" /> {plan.destination.name}
        </span>
        {viaLabel && (
          <span className="text-[11px] font-mono text-slate-400 truncate">via {viaLabel}</span>
        )}
      </div>

      <p className="mt-2 text-[13px] leading-snug text-slate-300">{verdict.sentence}</p>

      {/* Road status is shown only when a road route has status data. */}
      {!isAerialFallback && total > 0.001 && (
        <div
          className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
          role="img"
          aria-label={`${Math.round(clearKm)} km clear, ${Math.round(cautionKm)} km caution, ${Math.round(obstructedKm)} km obstructed`}
        >
          {clearKm > 0 && <div className="h-full bg-emerald-400" style={{ width: `${(clearKm / total) * 100}%` }} />}
          {cautionKm > 0 && <div className="h-full bg-amber-400" style={{ width: `${(cautionKm / total) * 100}%` }} />}
          {obstructedKm > 0 && <div className="h-full bg-rose-500" style={{ width: `${(obstructedKm / total) * 100}%` }} />}
        </div>
      )}

      {/* The short facts, one row, no hunting. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(({ Icon, tone, label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-800/80 bg-[var(--surface-raised)] px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3 w-3 shrink-0 ${tone}`} />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            </div>
            <div className="mt-0.5 truncate font-mono text-sm font-bold text-white tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-sm font-bold text-slate-200 transition-all"
        >
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          Change
        </button>
        {!isAerialFallback && (
          <button
            type="button"
            onClick={onStartTrip}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/25 transition-all"
          >
            {tripStarted ? 'Following trip' : 'Start trip'}
            <Navigation className="ml-1 inline h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </section>
  );
};

export default RouteVerdict;
