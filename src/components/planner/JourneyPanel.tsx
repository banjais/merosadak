import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  Clock,
  CloudSun,
  Coins,
  Fuel,
  ListTree,
  MapPin,
  Milestone,
  Mountain,
  Phone,
  Radio,
  ShieldAlert,
  Utensils,
  Zap,
} from 'lucide-react';
import type { RoutePlanResult, VehicleType } from '../../types';
import { useRouteFeed, type FeedEntry, type FeedGroup, type FeedKind, type FeedSeverity, type TravelerMode } from '../../hooks/useRouteFeed';
import { buildRouteElevationProfile } from '../../utils/routeElevationProfile';
import { normalizeLatLng } from '../../utils/routeCorridor';
import { DataAttribution } from '../DataAttribution';
import { RouteJunctionTimeline } from '../RouteJunctionTimeline';
import type { RoadIncident } from '../../types';

type MapTarget = { lat: number; lng: number; title: string; zoom?: number };

interface JourneyPanelProps {
  route: RoutePlanResult;
  vehicle: VehicleType;
  mode: TravelerMode;
  extraIncidents?: RoadIncident[];
  onViewOnMap?: (target?: MapTarget) => void;
}

type Filter = 'all' | FeedGroup;

interface Waypoint {
  type: 'waypoint';
  key: string;
  alongKm: number;
  etaMin: number;
  title: string;
  highwayCode?: string;
  surface: string;
  status: string;
  segmentKm: number;
  segmentMin: number;
  climbM: number;
  warning?: string;
  pos: [number, number] | null;
}
interface FeedRow extends FeedEntry {
  type: 'feed';
  etaMin: number;
}
type Row = Waypoint | FeedRow;

const ICONS: Record<FeedKind, React.ComponentType<{ className?: string }>> = {
  blackspot: ShieldAlert,
  incident: AlertTriangle,
  traffic: Radio,
  weather: CloudSun,
  fuel: Fuel,
  ev: Zap,
  toll: Coins,
  food: Utensils,
  help: Phone,
  scenic: Mountain,
  bus: Bus,
};

const SEV: Record<FeedSeverity, { card: string; dot: string; icon: string }> = {
  info: { card: 'border-slate-800 bg-slate-950/70', dot: 'bg-slate-500', icon: 'text-slate-400' },
  caution: { card: 'border-amber-500/40 bg-amber-500/5', dot: 'bg-amber-400', icon: 'text-amber-400' },
  danger: { card: 'border-rose-500/50 bg-rose-500/5', dot: 'bg-rose-500', icon: 'text-rose-400' },
};

const STATUS_TONE: Record<string, string> = {
  clear: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  caution: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  obstructed: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  closed: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

const pad = (n: number) => String(n).padStart(2, '0');
const defaultDeparture = (): string => {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const clock = (departure: string, plusMin: number): string => {
  const [h, m] = departure.split(':').map(Number);
  const total = (h || 0) * 60 + (m || 0) + Math.round(plusMin);
  const days = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}${days > 0 ? ` +${days}d` : ''}`;
};
const dur = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Elevation profile with the route's hazards pinned at their km. */
const ElevationStrip: React.FC<{ route: RoutePlanResult; pins: FeedEntry[] }> = ({ route, pins }) => {
  const profile = useMemo(() => buildRouteElevationProfile(route), [route]);
  const pts = profile.elevationPoints;
  if (pts.length < 2) return null;
  const W = 600;
  const H = 110;
  const total = Math.max(route.totalDistanceKm, pts[pts.length - 1].distance, 1);
  const lo = Math.min(...pts.map((p) => p.elevation));
  const hi = Math.max(...pts.map((p) => p.elevation));
  const span = Math.max(hi - lo, 1);
  const x = (km: number) => (km / total) * W;
  const y = (e: number) => H - 14 - ((e - lo) / span) * (H - 32);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.distance).toFixed(1)},${y(p.elevation).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts[pts.length - 1].distance).toFixed(1)},${H - 14} L${x(pts[0].distance).toFixed(1)},${H - 14} Z`;
  const elevAt = (km: number) => {
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.distance - km) < Math.abs(best.distance - km)) best = p;
    return best.elevation;
  };

  return (
    <div data-no-tab-swipe className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full min-w-[420px]" role="img" aria-label="Elevation profile with hazards">
        <defs>
          <linearGradient id="jr-elev" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {profile.steepHazardZones.map((z) => (
          <rect key={z.id} x={x(z.startKm)} y={4} width={Math.max(2, x(z.endKm) - x(z.startKm))} height={H - 18} fill={z.severity === 'extreme' ? 'rgb(244 63 94)' : 'rgb(245 158 11)'} opacity="0.14" />
        ))}
        <path d={area} fill="url(#jr-elev)" />
        <path d={line} fill="none" stroke="rgb(52 211 153)" strokeWidth="1.8" strokeLinejoin="round" />
        {pins
          .filter((p) => p.severity !== 'info')
          .map((p) => (
            <circle key={p.id} cx={x(p.alongKm)} cy={y(elevAt(p.alongKm))} r="3.6" fill={p.severity === 'danger' ? 'rgb(244 63 94)' : 'rgb(251 191 36)'} stroke="rgb(2 6 23)" strokeWidth="1.2">
              <title>{`km ${Math.round(p.alongKm)} · ${p.title}`}</title>
            </circle>
          ))}
        <text x="4" y="12" fontSize="10" fill="rgb(148 163 184)">{Math.round(hi)} m</text>
        <text x="4" y={H - 16} fontSize="10" fill="rgb(148 163 184)">{Math.round(lo)} m</text>
        <text x={W - 4} y={H - 2} fontSize="10" textAnchor="end" fill="rgb(148 163 184)">{Math.round(total)} km</text>
        <text x="4" y={H - 2} fontSize="10" fill="rgb(148 163 184)">0 km</text>
      </svg>
    </div>
  );
};

export const JourneyPanel: React.FC<JourneyPanelProps> = ({ route, vehicle, mode, extraIncidents, onViewOnMap }) => {
  const [view, setView] = useState<'corridor' | 'schedule'>('corridor');
  const [filter, setFilter] = useState<Filter>('all');
  const [departure, setDeparture] = useState<string>(defaultDeparture);
  const { entries, loading, latestUpdate } = useRouteFeed(route, mode, extraIncidents);

  const visible = useMemo(() => entries.filter((e) => e.audience === 'both' || e.audience === mode), [entries, mode]);

  const waypoints = useMemo<Waypoint[]>(() => {
    const stepKm = route.steps.reduce((s, st) => s + (st.distanceKm || 0), 0);
    const stepMin = route.steps.reduce((s, st) => s + (st.durationMinutes || 0), 0);
    const kmScale = stepKm > 0 && route.totalDistanceKm / stepKm >= 0.5 && route.totalDistanceKm / stepKm <= 2 ? route.totalDistanceKm / stepKm : 1;
    const minScale = stepMin > 0 ? route.estimatedTimeMinutes / stepMin : 1;
    let km = 0;
    let min = 0;
    return route.steps.map((st, i) => {
      const startKm = km;
      const startMin = min;
      km += (st.distanceKm || 0) * kmScale;
      min += (st.durationMinutes || 0) * minScale;
      const first = st.from ?? null;
      const c0 = st.coordinates?.[0];
      const pos: [number, number] | null = first ? [first.lat, first.lng] : c0 ? normalizeLatLng(c0[0], c0[1]) : null;
      return {
        type: 'waypoint',
        key: `wp-${i}`,
        alongKm: startKm,
        etaMin: startMin,
        title: st.instruction,
        highwayCode: st.highwayCode,
        surface: st.surface,
        status: st.roadStatus,
        segmentKm: (st.distanceKm || 0) * kmScale,
        segmentMin: (st.durationMinutes || 0) * minScale,
        climbM: st.elevationChangeM ?? 0,
        warning: st.warning,
        pos,
      };
    });
  }, [route]);

  const rows = useMemo<Row[]>(() => {
    const feed: FeedRow[] = (filter === 'all' ? visible : visible.filter((e) => e.group === filter)).map((e) => ({
      ...e,
      type: 'feed',
      etaMin: (e.alongKm / Math.max(route.totalDistanceKm, 1)) * route.estimatedTimeMinutes,
    }));
    const base: Row[] = filter === 'all' ? [...waypoints, ...feed] : feed;
    const sorted = base.sort((a, b) => a.alongKm - b.alongKm || (a.type === 'waypoint' ? -1 : 1));

    // Deduplicate any repeated entries
    const seen = new Set<string>();
    return sorted.filter((row) => {
      const key = row.type === 'waypoint' ? row.key : row.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [visible, waypoints, filter, route.totalDistanceKm, route.estimatedTimeMinutes]);

  const counts = useMemo(
    () => ({
      road: visible.filter((e) => e.group === 'road').length,
      weather: visible.filter((e) => e.group === 'weather').length,
      stops: visible.filter((e) => e.group === 'stops').length,
    }),
    [visible]
  );
  const hazards = visible.filter((e) => e.group === 'road' && e.severity !== 'info').length;
  const delayMin = visible.reduce((s, e) => s + (e.delayMin || 0), 0);
  const status = route.statusSummary;
  const statusTotal = status ? status.clearKm + status.cautionKm + status.obstructedKm : 0;
  const arrival = clock(departure, route.estimatedTimeMinutes + delayMin);

  return (
    <div className="space-y-3" id="route-journey">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Journey view" className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-0.5 text-xs font-bold">
          {([
            ['corridor', 'Corridor', ListTree],
            ['schedule', 'Stops & schedule', Milestone],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${view === id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        {view === 'corridor' && (
          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            Depart
            <input
              type="time"
              value={departure}
              onChange={(e) => e.target.value && setDeparture(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <span className="font-mono text-slate-300">→ {arrival}</span>
          </label>
        )}
      </div>

      {view === 'schedule' ? (
        <RouteJunctionTimeline routePlan={route} vehicle={vehicle} onViewOnMap={onViewOnMap} />
      ) : (
        <>
          <ElevationStrip route={route} pins={visible} />

          {statusTotal > 0 && (
            <div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-800" aria-label="Road status along the route">
                <div className="bg-emerald-500" style={{ width: `${(status.clearKm / statusTotal) * 100}%` }} />
                <div className="bg-amber-500" style={{ width: `${(status.cautionKm / statusTotal) * 100}%` }} />
                <div className="bg-rose-500" style={{ width: `${(status.obstructedKm / statusTotal) * 100}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {Math.round(status.clearKm)} km clear · {Math.round(status.cautionKm)} km caution · {Math.round(status.obstructedKm)} km obstructed
                {delayMin > 0 && ` · listed delays about +${delayMin} min`}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 text-xs" role="tablist" aria-label="Filter the corridor">
            {([
              ['all', 'Everything', visible.length + waypoints.length],
              ['road', 'Hazards & alerts', counts.road],
              ['weather', 'Weather', counts.weather],
              ['stops', 'Fuel & stops', counts.stops],
            ] as Array<[Filter, string, number]>).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-xl border px-2.5 py-1 font-bold transition ${
                  filter === key ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label} <span className="opacity-70">{n}</span>
              </button>
            ))}
            {hazards > 0 && (
              <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-bold text-amber-300">
                {hazards} to watch
              </span>
            )}
          </div>

          {loading ? (
            <div className="px-1 text-xs text-slate-500">Loading what is on this route…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              Nothing is listed within a few km of this route for this filter. The lists are curated and not exhaustive, so this does not mean the road is free of hazards.
            </div>
          ) : (
            <ol className="relative space-y-2 pl-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-800">
              {rows.map((row) =>
                row.type === 'waypoint' ? (
                  <li key={row.key} className="relative">
                    <span className="absolute -left-[18px] top-3 h-3 w-3 rounded-full border-2 border-emerald-400 bg-slate-950" />
                    <button
                      type="button"
                      onClick={() => row.pos && onViewOnMap?.({ lat: row.pos[0], lng: row.pos[1], title: row.title, zoom: 11 })}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-left transition hover:border-emerald-500/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-white">
                            <span>{row.title}</span>
                            {row.highwayCode && (
                              <span className="rounded border border-slate-700 bg-slate-800 px-1.5 text-[10px] text-cyan-300">{row.highwayCode}</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                            <span className={`rounded border px-1.5 capitalize ${STATUS_TONE[row.status] ?? STATUS_TONE.clear}`}>{row.status}</span>
                            <span className="capitalize">{row.surface.replace(/_/g, ' ')}</span>
                            <span>{row.segmentKm.toFixed(1)} km · {dur(row.segmentMin)}</span>
                            {row.climbM !== 0 && <span className={row.climbM > 0 ? 'text-purple-400' : 'text-cyan-400'}>{row.climbM > 0 ? `+${row.climbM} m` : `${row.climbM} m`}</span>}
                          </div>
                          {row.warning && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-400">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {row.warning}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-sm font-black text-white">{clock(departure, row.etaMin)}</div>
                          <div className="text-[10px] text-slate-500">km {Math.round(row.alongKm)}</div>
                        </div>
                      </div>
                    </button>
                  </li>
                ) : (
                  <li key={row.id} className="relative">
                    <span className={`absolute -left-[15px] top-4 h-1.5 w-1.5 rounded-full ${SEV[row.severity].dot}`} />
                    {(() => {
                      const Icon = ICONS[row.kind];
                      return (
                        <button
                          type="button"
                          onClick={() => onViewOnMap?.({ lat: row.lat, lng: row.lng, title: row.title, zoom: 12 })}
                          className={`flex w-full gap-2.5 rounded-xl border p-2.5 text-left transition hover:brightness-125 ${SEV[row.severity].card}`}
                        >
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEV[row.severity].icon}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold leading-snug text-slate-100">{row.title}</div>
                            {row.detail && <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{row.detail}</div>}
                            {row.extra && <div className="mt-0.5 text-[11px] leading-snug text-slate-300">{row.extra}</div>}
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
                              {row.badge && <span className="uppercase tracking-wide">{row.badge}</span>}
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {row.offKm < 0.3 ? 'on route' : `${row.offKm.toFixed(1)} km off route`}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono text-[11px] font-bold text-slate-300">{clock(departure, row.etaMin)}</div>
                            <div className="text-[10px] text-slate-500">{row.offKm > 2 ? '≈' : ''}km {Math.round(row.alongKm)}</div>
                          </div>
                        </button>
                      );
                    })()}
                  </li>
                )
              )}
            </ol>
          )}

          <DataAttribution
            compact
            source="Road: DoR SNH 2022/23 · Hazards, weather points and stops: app reference lists"
            updatedAt={latestUpdate}
            note="Only items within a few km of this route are shown, in the order you reach them. Times assume the departure above and do not include listed delays except in the arrival estimate."
          />
        </>
      )}
    </div>
  );
};
