import React, { useMemo, useState, useEffect } from 'react';
import { Highway, RoadIncident } from '../types';
import { NEPAL_HIGHWAYS, LIVE_ROAD_INCIDENTS } from '../data/nepalHighwaysData';
import { loadSNHReference, lookupSNHDistance, DistanceLookupResult, SNHReferenceData } from '../utils/snhLookup';
import {
  Route,
  MapPin,
  Mountain,
  PhoneCall,
  Building,
  AlertTriangle,
  Zap,
  Layers,
} from 'lucide-react';
import { SwipeableReelStack, ReelCardItem } from './SwipeableReelStack';

interface RouteHighwayInfoPanelProps {
  routeHighwayCodes: string[];
  incidents?: RoadIncident[];
  onViewHighwayOnMap?: (highway: Highway) => void;
  onOpenHighwayDirectory?: () => void;
}

interface HighwayStatusInfo {
  highway: Highway;
  incidents: RoadIncident[];
  snhLookup: DistanceLookupResult | null;
}

const STATUS_COLORS: Record<string, string> = {
  clear: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
  caution: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80',
  obstructed: 'bg-rose-950/80 text-rose-300 border-rose-700/80',
};

/** Expand codes like "NH02/NH04" or "NH04, NH05" into individual tokens. */
function expandCodes(codes: string[]): string[] {
  const out: string[] = [];
  codes.filter(Boolean).forEach((raw) => {
    raw.split(/[/,&+|]+/).forEach((part) => {
      const t = part.trim();
      if (t) out.push(t);
    });
  });
  return out;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

function findHighway(code: string): Highway | undefined {
  const key = normalizeCode(code);
  const digits = key.replace(/[^0-9]/g, '');
  return NEPAL_HIGHWAYS.find((h) => {
    const hc = normalizeCode(h.code);
    const hi = normalizeCode(h.id);
    if (hc === key || hi === key) return true;
    if (hc.replace('NNH', 'NH') === key.replace('NNH', 'NH')) return true;
    if (digits && (hc.endsWith(digits) || hi.endsWith(digits)) && digits.length >= 2) return true;
    return false;
  });
}

export const RouteHighwayInfoPanel: React.FC<RouteHighwayInfoPanelProps> = ({
  routeHighwayCodes,
  incidents = LIVE_ROAD_INCIDENTS,
  onViewHighwayOnMap,
  onOpenHighwayDirectory,
}) => {
  const [snhReference, setSnhReference] = useState<SNHReferenceData | null>(null);

  useEffect(() => {
    loadSNHReference().then(setSnhReference).catch(() => setSnhReference(null));
  }, []);

  const highwayInfos = useMemo<HighwayStatusInfo[]>(() => {
    const tokens = expandCodes(routeHighwayCodes);
    if (tokens.length === 0) return [];

    const infos: HighwayStatusInfo[] = [];
    const seen = new Set<string>();

    tokens.forEach((code) => {
      const highway = findHighway(code);
      if (!highway) return;
      const key = normalizeCode(highway.code);
      if (seen.has(key)) return;
      seen.add(key);

      const hwIncidents = incidents.filter((inc) => {
        const ic = normalizeCode(inc.highwayCode || '');
        return (
          ic === key ||
          ic.includes(key) ||
          key.includes(ic) ||
          ic.replace('NNH', 'NH') === key.replace('NNH', 'NH')
        );
      });

      const snhLookup = lookupSNHDistance(highway.startPoint, highway.endPoint, snhReference);
      infos.push({ highway, incidents: hwIncidents, snhLookup });
    });

    return infos;
  }, [routeHighwayCodes, incidents, snhReference]);

  const cards: ReelCardItem[] = useMemo(() => {
    return highwayInfos.map(({ highway, incidents: hwIncidents, snhLookup }) => {
      const status = highway.overallStatus || 'clear';
      const statusClass = STATUS_COLORS[status] || STATUS_COLORS.clear;

      return {
        id: `route-hw-${highway.code}`,
        type: 'highway' as const,
        title: `${highway.code} · ${highway.name}`,
        subtitle: `${highway.startPoint} → ${highway.endPoint}`,
        archiveData: {
          title: highway.name,
          highwayCode: highway.code,
        },
        summary: (
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase ${statusClass}`}>
                {status}
              </span>
              <span className="text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" />
                {highway.totalLengthKm} km
              </span>
              <span className="text-amber-300/90">★ {highway.conditionRating}/5</span>
              {hwIncidents.length > 0 && (
                <span className="text-rose-300 font-bold">{hwIncidents.length} alert(s)</span>
              )}
            </div>
            {highway.nepaliName && (
              <p className="text-slate-500 text-[11px]">{highway.nepaliName}</p>
            )}
          </div>
        ),
        detail: (
          <div className="space-y-3 text-xs">
            {highway.description && (
              <p className="text-slate-300 leading-relaxed">{highway.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Mountain className="w-3 h-3 text-purple-400" />
                {highway.terrainType}
              </span>
              {highway.evChargers && highway.evChargers.length > 0 && (
                <span className="inline-flex items-center gap-1 text-yellow-200/90">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  {highway.evChargers.length} EV
                </span>
              )}
            </div>
            {hwIncidents.length > 0 && (
              <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-2 space-y-1.5">
                <div className="flex items-center gap-1 text-rose-300 font-bold text-[10px] uppercase">
                  <AlertTriangle className="w-3 h-3" />
                  Active ({hwIncidents.length})
                </div>
                {hwIncidents.slice(0, 3).map((inc) => (
                  <div key={inc.id} className="text-[11px] text-slate-200">
                    <span className="font-semibold">{inc.title}</span>
                    {inc.locationName && (
                      <span className="text-slate-500"> · {inc.locationName}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {snhLookup && snhLookup.distanceKm != null && (
              <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 p-2 text-[11px] text-cyan-100/90">
                DoR / SNH: <strong>{snhLookup.distanceKm} km</strong>
                {snhLookup.evidenceLevel && (
                  <span className="text-slate-400"> · {snhLookup.evidenceLevel}</span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-emerald-400" />
                {highway.dorDivision || 'DoR'}
              </span>
              <span className="inline-flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                {highway.emergencyContact || '—'}
              </span>
            </div>
            {onViewHighwayOnMap && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewHighwayOnMap(highway);
                }}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center justify-center gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                View on map
              </button>
            )}
          </div>
        ),
      };
    });
  }, [highwayInfos, onViewHighwayOnMap]);

  if (routeHighwayCodes.filter(Boolean).length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-center space-y-2">
        <Route className="w-6 h-6 text-slate-500 mx-auto" />
        <p className="text-xs text-slate-400">No highway codes on this route yet.</p>
        {onOpenHighwayDirectory && (
          <button
            type="button"
            onClick={onOpenHighwayDirectory}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
          >
            Open highway directory
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SwipeableReelStack
        cards={cards}
        emptyState={
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-center space-y-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto" />
            <p className="text-xs text-slate-300">
              Could not match route codes to the highway directory
              {routeHighwayCodes.length > 0 && (
                <span className="block text-slate-500 mt-1 font-mono text-[10px]">
                  {expandCodes(routeHighwayCodes).slice(0, 8).join(', ')}
                </span>
              )}
            </p>
            {onOpenHighwayDirectory && (
              <button
                type="button"
                onClick={onOpenHighwayDirectory}
                className="text-[11px] font-bold text-emerald-400"
              >
                Browse all highways
              </button>
            )}
          </div>
        }
      />
    </div>
  );
};
