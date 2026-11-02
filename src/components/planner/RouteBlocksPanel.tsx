import React, { useMemo } from 'react';
import { AlertTriangle, Ban, CheckCircle2, MapPin, ShieldAlert } from 'lucide-react';
import type { RoadIncident, RoutePlanResult, RouteStep } from '../../types';

interface RouteBlocksPanelProps {
  plan: RoutePlanResult;
  /** Live reports from the feed that may not be in the plan snapshot yet. */
  extraIncidents?: RoadIncident[];
}

interface SegmentIssue {
  key: string;
  highwayCode: string;
  highwayName: string;
  from: string;
  to: string;
  distanceKm: number;
  status: RouteStep['roadStatus'];
  warning?: string;
}

const SEVERITY_TONE: Record<RoadIncident['severity'], string> = {
  minor: 'border-slate-700 bg-slate-900/60',
  moderate: 'border-amber-500/40 bg-amber-500/5',
  severe: 'border-orange-500/40 bg-orange-500/5',
  high: 'border-rose-500/40 bg-rose-500/5',
  critical: 'border-rose-500/60 bg-rose-500/10',
};

const STATUS_PILL: Record<string, string> = {
  caution: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  obstructed: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  closed: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

const TYPE_LABEL: Record<string, string> = {
  landslide: 'Landslide',
  flood: 'Flood',
  construction: 'Construction',
  fallen_rocks: 'Fallen rocks',
  one_way: 'One-way traffic',
  accident: 'Accident',
  bridge_maintenance: 'Bridge maintenance',
  traffic_jam: 'Traffic jam',
  pothole: 'Potholes',
};

/**
 * Answers the question the whole app exists for: WHERE exactly is the road
 * blocked or risky? One card per surveyed segment that is not clear, then the
 * live incident reports. Lives behind the "Blocks & alerts" section, which the
 * verdict auto-opens the moment anything on the route is not clear.
 */
export const RouteBlocksPanel: React.FC<RouteBlocksPanelProps> = ({ plan, extraIncidents = [] }) => {
  const segmentIssues = useMemo<SegmentIssue[]>(
    () =>
      (plan.steps ?? [])
        .filter((s) => s.roadStatus && s.roadStatus !== 'clear')
        .map((s, i) => ({
          key: `${s.highwayCode ?? 'seg'}-${i}`,
          highwayCode: s.highwayCode ?? '',
          highwayName: s.highwayName ?? '',
          from: s.from?.name || s.instruction,
          to: s.to?.name || '',
          distanceKm: s.distanceKm,
          status: s.roadStatus,
          warning: s.warning,
        })),
    [plan],
  );

  const incidents = useMemo(() => {
    const seen = new Set<string>();
    return [...(plan.incidentsOnRoute ?? []), ...extraIncidents].filter((inc) => {
      if (seen.has(inc.id)) return false;
      seen.add(inc.id);
      return true;
    });
  }, [plan, extraIncidents]);

  const nothingBlocked = segmentIssues.length === 0 && incidents.length === 0;

  if (nothingBlocked) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-bold text-emerald-300">Nothing is blocking this route</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Every surveyed segment reports open status and there are no live incident reports along the way.
            Still drive to the conditions — mountain highways change fast.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {segmentIssues.length > 0 && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Surveyed segments not clear</p>
      )}
      {segmentIssues.map((seg) => (
        <div key={seg.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
              {seg.highwayCode || '—'}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">
              {seg.highwayName || seg.from}
              {seg.to && seg.to !== seg.from ? <span className="font-normal text-slate-500"> · {seg.from} → {seg.to}</span> : null}
            </span>
            <span className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_PILL[seg.status] ?? 'border-slate-700 text-slate-300'}`}>
              {seg.status}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
            <span className="font-mono tabular-nums">{seg.distanceKm.toFixed(1)} km</span>
            {seg.warning && <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="h-3 w-3" />{seg.warning}</span>}
          </div>
        </div>
      ))}

      {incidents.length > 0 && (
        <p className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Live incident reports</p>
      )}
      {incidents.map((inc) => (
        <div key={inc.id} className={`rounded-2xl border p-3 ${SEVERITY_TONE[inc.severity] ?? SEVERITY_TONE.minor}`}>
          <div className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{inc.title}</span>
            <span className="rounded-lg border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {inc.highwayCode}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{inc.locationName}</span>
            <span>{TYPE_LABEL[inc.type] ?? inc.type}</span>
            {inc.chainageKm && <span className="font-mono">chainage {inc.chainageKm}</span>}
            <span className={`font-semibold uppercase ${inc.status === 'clear' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {inc.status}
            </span>
          </div>
          {inc.description && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{inc.description}</p>}
        </div>
      ))}
    </div>
  );
};

export default RouteBlocksPanel;
