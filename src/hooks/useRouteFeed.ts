import { useEffect, useMemo, useState } from 'react';
import type { RoadIncident, RoutePlanResult } from '../types';
import { fetchJson } from '../utils/apiConfig';
import { buildRouteIndex, normalizeLatLng, scopeToRoute } from '../utils/routeCorridor';

/**
 * Everything the app knows that lies along ONE route, in route order:
 * curated black spots, DoR/live incidents, traffic corridors, mountain weather,
 * POIs (fuel, EV, toll, food, help, scenic) and bus terminals.
 *
 * Pure data — no JSX — so the journey view, the map and any future surface can
 * share one corridor scan instead of each re-reading the same files.
 */

export type TravelerMode = 'driver' | 'passenger';
export type FeedGroup = 'road' | 'weather' | 'stops';
export type FeedSeverity = 'info' | 'caution' | 'danger';
export type FeedAudience = 'driver' | 'passenger' | 'both';
export type FeedKind =
  | 'blackspot'
  | 'incident'
  | 'traffic'
  | 'weather'
  | 'fuel'
  | 'ev'
  | 'toll'
  | 'food'
  | 'help'
  | 'scenic'
  | 'bus';

export interface FeedEntry {
  id: string;
  group: FeedGroup;
  kind: FeedKind;
  audience: FeedAudience;
  alongKm: number;
  offKm: number;
  title: string;
  detail?: string;
  extra?: string;
  severity: FeedSeverity;
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
    /* fall back to the bundled reference file */
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

interface LiveWx {
  tempC: number;
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
      const v = { tempC: Math.round(cur.temperature_2m), at: Date.now() };
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

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface RouteFeed {
  entries: FeedEntry[];
  loading: boolean;
  latestUpdate?: string;
}

export function useRouteFeed(
  route: RoutePlanResult,
  mode: TravelerMode,
  extraIncidents?: RoadIncident[]
): RouteFeed {
  const [data, setData] = useState<FeedData | null>(dataCache);
  const [live, setLive] = useState<Record<string, LiveWx>>({});

  useEffect(() => {
    let alive = true;
    loadFeedData().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  const idx = useMemo(
    () => buildRouteIndex(route.pathCoordinates, route.totalDistanceKm),
    [route.pathCoordinates, route.totalDistanceKm]
  );

  const weatherHits = useMemo(
    () => (data && idx ? scopeToRoute<any>(data.weather, idx, (w) => (num(w?.lat) ? [w.lat, w.lng] : null), 12) : []),
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

    scopeToRoute<any>(data.blackspots, idx, (b) => (num(b?.lat) ? [b.lat, b.lng] : null), 6).forEach(({ item: b, alongKm, offKm }) => {
      const risk = String(b.riskLevel || '').toLowerCase();
      out.push({
        id: `bs-${b.id}`,
        group: 'road',
        kind: 'blackspot',
        audience: 'driver',
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

    const seen = new Set<string>();
    const incidents = [...(route.incidentsOnRoute || []), ...(extraIncidents || [])].filter((i) => {
      if (!i || seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
    scopeToRoute<any>(incidents, idx, (i) => (num(i?.lat) ? [i.lat, i.lng] : null), 8).forEach(({ item: i, alongKm, offKm }) => {
      out.push({
        id: `inc-${i.id}`,
        group: 'road',
        kind: 'incident',
        audience: 'both',
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

    // Traffic corridor coordinates in this file are [lng, lat].
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
        kind: 'traffic',
        audience: 'both',
        alongKm,
        offKm,
        title: c.name,
        detail:
          `${c.avgSpeedKmh ?? '?'} km/h vs ${c.normalSpeedKmh ?? '?'} normal` +
          (c.delayMinutes ? ` · about +${c.delayMinutes} min` : '') +
          (c.cause ? ` · ${trim(c.cause, 90)}` : ''),
        severity: level === 'standstill' ? 'danger' : level === 'heavy' ? 'caution' : 'info',
        badge: c.lastUpdated ? `as of ${String(c.lastUpdated).slice(0, 10)}` : 'reference',
        lat: pos[0],
        lng: pos[1],
        delayMin: Number(c.delayMinutes) || 0,
      });
    });

    weatherHits.forEach(({ item: w, alongKm, offKm }) => {
      const lv = live[String(w.id)];
      const cond = CONDITION_LABEL[w.condition] || String(w.condition || '').replace(/_/g, ' ');
      const temp = lv ? lv.tempC : w.tempC;
      const driverParts = [
        `visibility ${w.visibilityKm ?? '?'} km`,
        w.roadGrip ? `grip: ${String(w.roadGrip).replace(/_/g, ' ')}` : '',
      ].filter(Boolean);
      const bad = ['dense_fog', 'thunderstorm', 'rain_monsoon'].includes(w.condition);
      const slide = String(w.landslideRisk || '').toLowerCase() === 'high';
      out.push({
        id: `wx-${w.id}`,
        group: 'weather',
        kind: 'weather',
        audience: 'both',
        alongKm,
        offKm,
        title: `${w.name}${w.elevationM ? ` (${w.elevationM} m)` : ''}`,
        detail: [`${temp}°C`, cond, `rain ${w.rainProbabilityPercent ?? '?'}%`].join(' · '),
        extra: mode === 'driver' ? driverParts.join(' · ') + (slide ? ' · landslide risk high' : '') : undefined,
        severity: slide || w.condition === 'thunderstorm' ? 'danger' : bad ? 'caution' : 'info',
        badge: lv ? 'live reading' : 'reference values',
        lat: w.lat,
        lng: w.lng,
      });
    });

    scopeToRoute<any>(data.pois, idx, (p) => (num(p?.lat) ? [p.lat, p.lng] : null), 4).forEach(({ item: p, alongKm, offKm }) => {
      const cat = String(p.category);
      const kind: FeedKind =
        cat === 'fuel_station' ? 'fuel' : cat === 'ev_charger' ? 'ev' : cat === 'toll_plaza' ? 'toll' : cat === 'food_rest' ? 'food' : cat === 'emergency_dor' ? 'help' : 'scenic';
      out.push({
        id: `poi-${p.id}`,
        group: 'stops',
        kind,
        audience: kind === 'fuel' || kind === 'ev' || kind === 'toll' ? 'driver' : 'both',
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

    scopeToRoute<any>(data.bus, idx, (b) => (num(b?.lat) ? [b.lat, b.lng] : null), 3).forEach(({ item: b, alongKm, offKm }) => {
      out.push({
        id: `bus-${b.id}`,
        group: 'stops',
        kind: 'bus',
        audience: 'passenger',
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
  }, [data, idx, weatherHits, live, route.incidentsOnRoute, extraIncidents, mode]);

  const latestUpdate = useMemo(() => {
    const dates = [...(data?.weather || []).map((w) => w?.lastUpdated), ...(data?.traffic || []).map((t) => t?.lastUpdated)]
      .filter(Boolean)
      .map(String)
      .sort();
    return dates.length ? dates[dates.length - 1] : undefined;
  }, [data]);

  return { entries, loading: !data, latestUpdate };
}
