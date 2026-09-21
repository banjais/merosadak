import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  CloudSun,
  Fuel,
  Mountain,
  Phone,
  Radio,
  ShieldAlert,
  Utensils,
  Zap,
  Coins,
  Clock,
  MapPin,
} from 'lucide-react';
import { RoadIncident, RoutePlanResult } from '../types';
import { fetchJson } from '../utils/apiConfig';
import { buildRouteIndex, normalizeLatLng, scopeToRoute } from '../utils/routeCorridor';
import { DataAttribution } from './DataAttribution';

/**
 * "Ahead on your route": shows only what lies along THIS route, in the order the
 * traveller meets it. Replaces a wall of buttons that each opened a whole-country list.
 *
 * Driver and passenger see different things:
 *   driver     road hazards + driving advice, weather with road grip/visibility,
 *              fuel / EV / toll, traffic delays
 *   passenger  weather at places you pass, rest & food stops, bus terminals,
 *              delays as time lost (no driving advice)
 */

type Mode = 'driver' | 'passenger';
type Group = 'road' | 'weather' | 'stops';
type Severity = 'info' | 'caution' | 'danger';
type Audience = 'driver' | 'passenger' | 'both';

interface FeedEntry {
  id: string;
  group: Group;
  audience: Audience;
  icon: React.ReactNode;
  alongKm: number;
  offKm: number;
  title: string;
  detail?: string;
  extra?: string;
  severity: Severity;
  badge?: string;
  lat: number;
  lng: number;
  delayMin?: number;
}

interface FeedData {
  weather: any[];
  pois: any[];
  traffic: any[];
  blackspots: any[];
  bus: any[];
}

interface Props {
  routePlan: RoutePlanResult;
  mode: Mode;
  /** additional incidents to scope to the route (e.g. the app's live incident list) */
  extraIncidents?: RoadIncident[];
  onViewOnMap?: (target?: { lat: number; lng: number; title: string; zoom?: number }) => void;
}

// ---------------------------------------------------------------- data loading
let dataCache: FeedData | null = null;
let dataInflight: Promise<FeedData> | null = null;

async function getStatic(path: string): Promise<any[]> {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getApiOrStatic(endpoint: string, key: string, staticPath: string): Promise<any[]> {
  try {
    const data = await fetchJson<Record<string, any>>(endpoint);
    if (Array.isArray(data?.[key]) && data[key].length > 0) return data[key];
  } catch {
    /* fall through to the bundled reference file */
  }
  return getStatic(staticPath);
}

function loadFeedData(): Promise<FeedData> {
  if (dataCache) return Promise.resolve(dataCache);
  if (!dataInflight) {
    dataInflight = Promise.all([
      getApiOrStatic('/api/weather', 'weatherNodes', '/data/mountain-weather.json'),
      getApiOrStatic('/api/pois', 'pois', '/data/pois.json'),
      getApiOrStatic('/api/traffic', 'corridors', '/data/traffic-corridors.json'),
      getStatic('/data/blackspots.json'),
      getStatic('/data/bus-stations.json'),
    ])
      .then(([weather, pois, traffic, blackspots, bus]) => {
        dataCache = { weather, pois, traffic, blackspots, bus };
        return dataCache;
      })
      .finally(() => {
        dataInflight = null;
      });
  }
  return dataInflight;
}

// live readings for weather points on the route (Open-Meteo through the worker)
interface LiveWx {
  tempC: number;
  windKmh?: number;
  precipMm?: number;
  at: number;
}
const liveWxCache = new Map<string, LiveWx>();
const LIVE_TTL_MS = 10 * 60 * 1000;

async function fetchLiveWx(id: string, lat: number, lng: number): Promise<LiveWx | null> {
  const hit = liveWxCache.get(id);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const data = await fetchJson<any>(`/api/weather?lat=${lat}&lon=${lng}`, { signal: ctrl.signal });
    const cur = data?.current;
    if (data?.source === 'open-meteo' && cur && typeof cur.temperature_2m === 'number') {
      const v: LiveWx = {
        tempC: Math.round(cur.temperature_2m),
        windKmh: typeof cur.wind_speed_10m === 'number' ? Math.round(cur.wind_speed_10m) : undefined,
        precipMm: typeof cur.precipitation === 'number' ? cur.precipitation : undefined,
        at: Date.now(),
      };
      liveWxCache.set(id, v);
      return v;
    }
  } catch {
    /* keep reference values */
  } finally {
    clearTimeout(timer);
  }
  return null;
}

// ---------------------------------------------------------------- helpers
const CONDITION_LABEL: Record<string, string> = {
  sunny: 'Clear',
  cloudy: 'Cloudy',
  dense_fog: 'Dense fog',
  mountain_shower: 'Showers',
  rain_monsoon: 'Heavy rain',
  thunderstorm: 'Thunderstorm',
};

const trim = (s: unknown, n: number): string => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};

const fmtTime = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const sevClasses: Record<Severity, string> = {
  info: 'border-slate-800 bg-slate-950',
  caution: 'border-amber-500/40 bg-amber-500/5',
  danger: 'border-rose-500/50 bg-rose-500/5',
};
const sevDot: Record<Severity, string> = {
  info: 'text-slate-400',
  caution: 'text-amber-400',
  danger: 'text-rose-400',
};

const ICON = 'w-4 h-4 shrink-0';

// ---------------------------------------------------------------- component
export const RouteAheadFeed: React.FC<Props> = ({ routePlan, mode, extraIncidents, onViewOnMap }) => {
  const [data, setData] = useState<FeedData | null>(dataCache);
  const [live, setLive] = useState<Record<string, LiveWx>>({});
  const [chip, setChip] = useState<'all' | Group>('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    loadFeedData().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  const idx = useMemo(
    () => buildRouteIndex(routePlan.pathCoordinates, routePlan.totalDistanceKm),
    [routePlan.pathCoordinates, routePlan.totalDistanceKm]
  );

  // weather points that lie on this route (needed before we can fetch live readings)
  const weatherHits = useMemo(
    () => (data && idx ? scopeToRoute<any>(data.weather, idx, (w) => (Number.isFinite(w?.lat) ? [w.lat, w.lng] : null), 12) : []),
    [data, idx]
  );

  useEffect(() => {
    let alive = true;
    weatherHits.slice(0, 5).forEach(({ item }) => {
      fetchLiveWx(String(item.id), item.lat, item.lng).then((v) => {
        if (alive && v) setLive((prev) => ({ ...prev, [String(item.id)]: v }));
      });
    });
    return () => {
      alive = false;
    };
  }, [weatherHits]);

  const entries = useMemo<FeedEntry[]>(() => {
    if (!data || !idx) return [];
    const out: FeedEntry[] = [];

    // --- road hazards (curated blackspots) : driver only
    scopeToRoute<any>(data.blackspots, idx, (b) => (Number.isFinite(b?.lat) ? [b.lat, b.lng] : null), 6).forEach(({ item: b, alongKm, offKm }) => {
      const risk = String(b.riskLevel || '').toLowerCase();
      out.push({
        id: `bs-${b.id}`,
        group: 'road',
        audience: 'driver',
        icon: <ShieldAlert className={ICON} />,
        alongKm,
        offKm,
        title: b.name,
        detail: trim(b.primaryCause, 130),
        extra: b.safeDrivingAdvice ? `Advice: ${trim(b.safeDrivingAdvice, 150)}` : undefined,
        severity: risk === 'high' || risk === 'critical' ? 'danger' : 'caution',
        badge: 'Accident black spot',
        lat: b.lat,
        lng: b.lng,
      });
    });

    // --- incidents : everyone (delays/closures affect all); advice only for drivers
    const seen = new Set<string>();
    const incidents = [...(routePlan.incidentsOnRoute || []), ...(extraIncidents || [])].filter((i) => {
      if (!i || seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
    scopeToRoute<any>(incidents, idx, (i) => (Number.isFinite(i.lat) ? [i.lat, i.lng] : null), 8).forEach(({ item: i, alongKm, offKm }) => {
      out.push({
        id: `inc-${i.id}`,
        group: 'road',
        audience: 'both',
        icon: <AlertTriangle className={ICON} />,
        alongKm,
        offKm,
        title: i.title,
        detail: trim(i.description, 130),
        extra: i.alternativeRouteAdvice ? `Alternative: ${trim(i.alternativeRouteAdvice, 120)}` : undefined,
        severity: i.severity === 'critical' || i.severity === 'severe' ? 'danger' : i.severity === 'moderate' ? 'caution' : 'info',
        badge: i.dorVerified ? 'DoR verified' : i.source ? String(i.source) : 'Reported',
        lat: i.lat,
        lng: i.lng,
      });
    });

    // --- traffic corridors : everyone. Coordinates in this file are [lng, lat].
    scopeToRoute<any>(
      data.traffic,
      idx,
      (c) => normalizeLatLng(c?.startCoord?.[0], c?.startCoord?.[1]) || normalizeLatLng(c?.endCoord?.[0], c?.endCoord?.[1]),
      4
    ).forEach(({ item: c, alongKm, offKm }) => {
      const pos = normalizeLatLng(c.startCoord?.[0], c.startCoord?.[1]) || [0, 0];
      const level = String(c.level || '').toLowerCase();
      out.push({
        id: `tr-${c.id}`,
        group: 'road',
        audience: 'both',
        icon: <Radio className={ICON} />,
        alongKm,
        offKm,
        title: c.name,
        detail:
          `${c.avgSpeedKmh ?? '?'} km/h vs ${c.normalSpeedKmh ?? '?'} normal` +
          (c.delayMinutes ? ` · about +${c.delayMinutes} min` : '') +
          (c.cause ? ` · ${trim(c.cause, 90)}` : ''),
        severity: level === 'standstill' || level === 'heavy' ? (level === 'standstill' ? 'danger' : 'caution') : 'info',
        badge: c.lastUpdated ? `as of ${String(c.lastUpdated).slice(0, 10)}` : 'reference',
        lat: pos[0],
        lng: pos[1],
        delayMin: Number(c.delayMinutes) || 0,
      });
    });

    // --- weather at passes/places on the route : everyone; grip & visibility for drivers
    weatherHits.forEach(({ item: w, alongKm, offKm }) => {
      const lv = live[String(w.id)];
      const cond = CONDITION_LABEL[w.condition] || String(w.condition || '').replace(/_/g, ' ');
      const temp = lv ? lv.tempC : w.tempC;
      const parts = [`${temp}°C`, cond, `rain ${w.rainProbabilityPercent ?? '?'}%`];
      const driverParts = [`visibility ${w.visibilityKm ?? '?'} km`, w.roadGrip ? `grip: ${String(w.roadGrip).replace(/_/g, ' ')}` : ''].filter(Boolean);
      const bad = ['dense_fog', 'thunderstorm', 'rain_monsoon'].includes(w.condition);
      const slide = String(w.landslideRisk || '').toLowerCase() === 'high';
      out.push({
        id: `wx-${w.id}`,
        group: 'weather',
        audience: 'both',
        icon: <CloudSun className={ICON} />,
        alongKm,
        offKm,
        title: `${w.name}${w.elevationM ? ` (${w.elevationM} m)` : ''}`,
        detail: parts.join(' · '),
        extra: mode === 'driver' ? driverParts.join(' · ') + (slide ? ' · landslide risk high' : '') : undefined,
        severity: slide || w.condition === 'thunderstorm' ? 'danger' : bad ? 'caution' : 'info',
        badge: lv ? 'live reading' : 'reference values',
        lat: w.lat,
        lng: w.lng,
      });
    });

    // --- stops: fuel / EV / toll (driver), food / scenic / help (both), bus terminals (passenger)
    scopeToRoute<any>(data.pois, idx, (p) => (Number.isFinite(p?.lat) ? [p.lat, p.lng] : null), 4).forEach(({ item: p, alongKm, offKm }) => {
      const cat = String(p.category);
      const driverOnly = cat === 'fuel_station' || cat === 'ev_charger' || cat === 'toll_plaza';
      const icon =
        cat === 'fuel_station' ? <Fuel className={ICON} /> :
        cat === 'ev_charger' ? <Zap className={ICON} /> :
        cat === 'toll_plaza' ? <Coins className={ICON} /> :
        cat === 'food_rest' ? <Utensils className={ICON} /> :
        cat === 'emergency_dor' ? <Phone className={ICON} /> :
        <Mountain className={ICON} />;
      out.push({
        id: `poi-${p.id}`,
        group: 'stops',
        audience: driverOnly ? 'driver' : 'both',
        icon,
        alongKm,
        offKm,
        title: p.name,
        detail: trim(p.description, 120),
        extra: p.contactNumber ? `Tel ${p.contactNumber}` : undefined,
        severity: 'info',
        badge: cat.replace(/_/g, ' '),
        lat: p.lat,
        lng: p.lng,
      });
    });

    scopeToRoute<any>(data.bus, idx, (b) => (Number.isFinite(b?.lat) ? [b.lat, b.lng] : null), 3).forEach(({ item: b, alongKm, offKm }) => {
      out.push({
        id: `bus-${b.id}`,
        group: 'stops',
        audience: 'passenger',
        icon: <Bus className={ICON} />,
        alongKm,
        offKm,
        title: b.name,
        detail: trim(b.notes || b.location, 100),
        severity: 'info',
        badge: 'bus terminal / stop',
        lat: b.lat,
        lng: b.lng,
      });
    });

    return out.sort((a, b) => a.alongKm - b.alongKm);
  }, [data, idx, weatherHits, live, routePlan.incidentsOnRoute, extraIncidents, mode]);

  const visible = useMemo(() => entries.filter((e) => e.audience === 'both' || e.audience === mode), [entries, mode]);
  const counts = useMemo(
    () => ({
      road: visible.filter((e) => e.group === 'road').length,
      weather: visible.filter((e) => e.group === 'weather').length,
      stops: visible.filter((e) => e.group === 'stops').length,
    }),
    [visible]
  );
  const shown = chip === 'all' ? visible : visible.filter((e) => e.group === chip);
  const limited = showAll ? shown : shown.slice(0, 6);

  const delayMin = visible.reduce((s, e) => s + (e.delayMin || 0), 0);
  const fuelEv = visible.filter((e) => e.id.startsWith('poi-') && (e.badge === 'fuel station' || e.badge === 'ev charger')).length;
  const hazards = visible.filter((e) => e.group === 'road' && e.severity !== 'info').length;

  const status = routePlan.statusSummary;
  const statusTotal = status ? status.clearKm + status.cautionKm + status.obstructedKm : 0;
  const latestUpdate = useMemo(() => {
    const dates = [
      ...(data?.weather || []).map((w) => w?.lastUpdated),
      ...(data?.traffic || []).map((t) => t?.lastUpdated),
    ].filter(Boolean).map(String).sort();
    return dates.length ? dates[dates.length - 1] : undefined;
  }, [data]);

  return (
    <div className="space-y-3" id="route-ahead-feed">
      {/* headline: distance + time + road status, always visible */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-white">
            Ahead on your route
            <span className="text-slate-500 font-medium"> · {mode === 'driver' ? 'driving' : 'riding along'}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-300 font-semibold">
            <span>{routePlan.totalDistanceKm.toFixed(1)} km</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {fmtTime(routePlan.estimatedTimeMinutes)}
            </span>
          </div>
        </div>

        {statusTotal > 0 && (
          <div>
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-800" aria-label="Road status along the route">
              <div className="bg-emerald-500" style={{ width: `${(status.clearKm / statusTotal) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(status.cautionKm / statusTotal) * 100}%` }} />
              <div className="bg-rose-500" style={{ width: `${(status.obstructedKm / statusTotal) * 100}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              {Math.round(status.clearKm)} km clear · {Math.round(status.cautionKm)} km caution · {Math.round(status.obstructedKm)} km obstructed
            </div>
          </div>
        )}

        {/* at-a-glance facts (not buttons) */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {mode === 'driver' ? (
            <>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">{hazards} hazard{hazards === 1 ? '' : 's'} listed</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">{fuelEv} fuel/EV point{fuelEv === 1 ? '' : 's'} listed</span>
            </>
          ) : (
            <>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">{counts.weather} weather point{counts.weather === 1 ? '' : 's'}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">{counts.stops} stop{counts.stops === 1 ? '' : 's'} / terminal{counts.stops === 1 ? '' : 's'}</span>
            </>
          )}
          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            {delayMin > 0 ? `listed delays about +${delayMin} min` : 'no listed delays'}
          </span>
        </div>
      </div>

      {/* three filters, not eleven buttons */}
      <div className="flex items-center gap-1.5 text-xs" role="tablist" aria-label="Filter what is ahead">
        {([
          ['all', 'All', visible.length],
          ['road', mode === 'driver' ? 'Hazards & delays' : 'Delays & alerts', counts.road],
          ['weather', 'Weather', counts.weather],
          ['stops', mode === 'driver' ? 'Fuel & stops' : 'Stops & terminals', counts.stops],
        ] as Array<['all' | Group, string, number]>).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={chip === key}
            onClick={() => {
              setChip(key);
              setShowAll(false);
            }}
            className={`px-2.5 py-1 rounded-lg border font-bold transition ${
              chip === key ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {label} <span className="opacity-70">{n}</span>
          </button>
        ))}
      </div>

      {/* the feed itself, in route order */}
      {!data ? (
        <div className="text-xs text-slate-500 px-1">Loading what is on this route…</div>
      ) : limited.length === 0 ? (
        <div className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-3">
          Nothing is listed within a few km of this route for this filter. The lists are not exhaustive, so this does not mean the road is clear.
        </div>
      ) : (
        <ol className="space-y-2">
          {limited.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onViewOnMap?.({ lat: e.lat, lng: e.lng, title: e.title, zoom: 12 })}
                className={`w-full text-left rounded-xl border p-2.5 flex gap-2.5 transition hover:brightness-125 ${sevClasses[e.severity]}`}
              >
                <div className="w-14 shrink-0 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">km</div>
                  <div className="text-sm font-black text-white leading-none">
                    {e.offKm > 2 ? '≈' : ''}
                    {Math.round(e.alongKm)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <span className={`mt-0.5 ${sevDot[e.severity]}`}>{e.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 leading-snug">{e.title}</div>
                      {e.detail && <div className="text-[11px] text-slate-400 leading-snug mt-0.5">{e.detail}</div>}
                      {e.extra && <div className="text-[11px] text-slate-300 leading-snug mt-0.5">{e.extra}</div>}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
                        {e.badge && <span className="uppercase tracking-wide">{e.badge}</span>}
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {e.offKm < 0.3 ? 'on route' : `${e.offKm.toFixed(1)} km off route`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}

      {shown.length > 6 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-1">
          {showAll ? 'Show fewer' : `Show all ${shown.length}`}
        </button>
      )}

      <DataAttribution
        compact
        source="Road: DoR SNH 2022/23 · Hazards, weather points and stops: app reference lists"
        updatedAt={latestUpdate}
        note="Only items within a few km of this route are shown. Lists are curated and not exhaustive; an empty list does not mean a clear road. Weather is marked 'live reading' only when a live value loaded, otherwise it is reference data."
      />
    </div>
  );
};
