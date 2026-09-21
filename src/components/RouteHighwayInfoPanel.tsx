import React, { useMemo, useState, useEffect } from 'react';
import { Highway, RoadIncident } from '../types';
import { NEPAL_HIGHWAYS, LIVE_ROAD_INCIDENTS, CITIES_AND_JUNCTIONS } from '../data/nepalHighwaysData';
import { loadSNHReference, lookupSNHDistance, getEvidenceLevelLabel, getEvidenceLevelColor, DistanceLookupResult, SNHReferenceData } from '../utils/snhLookup';
import {
  Route,
  ChevronRight,
  MapPin,
  Mountain,
  PhoneCall,
  Building,
  Clock,
  Zap,
  AlertTriangle,
  HardHat,
  Layers,
  ExternalLink,
  FileText,
} from 'lucide-react';

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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  clear: '🟢',
  caution: '⚠️',
  obstructed: '⛔',
};

export const RouteHighwayInfoPanel: React.FC<RouteHighwayInfoPanelProps> = ({
  routeHighwayCodes,
  incidents = LIVE_ROAD_INCIDENTS,
  onViewHighwayOnMap,
  onOpenHighwayDirectory,
}) => {
  const [snhReference, setSnhReference] = useState<SNHReferenceData | null>(null);

  useEffect(() => {
    loadSNHReference().then(setSnhReference);
  }, []);

  const highwayInfos = useMemo<HighwayStatusInfo[]>(() => {
    const codes = routeHighwayCodes.filter(Boolean);
    if (codes.length === 0) return [];

    const infos: HighwayStatusInfo[] = [];
    const seen = new Set<string>();

    codes.forEach((code) => {
      const normalizedCode = code.trim();
      const key = normalizedCode.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const highway = NEPAL_HIGHWAYS.find(
        (h) => h.code.toLowerCase() === key || h.id.toLowerCase() === key
      );
      if (!highway) return;

      const hwIncidents = incidents.filter(
        (inc) =>
          inc.highwayCode === highway.code ||
          inc.highwayCode === highway.id ||
          inc.highwayCode.includes(highway.code) ||
          highway.code.split(' ').some((c) => inc.highwayCode.includes(c))
      );

      const snhLookup = lookupSNHDistance(highway.startPoint, highway.endPoint, snhReference);

      infos.push({ highway, incidents: hwIncidents, snhLookup });
    });

    return infos;
  }, [routeHighwayCodes, incidents]);

  if (highwayInfos.length === 0) {
    return (
      <div className="text-center py-8">
        <Route className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-medium">
          No national highway information available for this route.
        </p>
        {onOpenHighwayDirectory && (
          <button
            onClick={onOpenHighwayDirectory}
            className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white font-bold rounded-lg border border-slate-700 transition"
          >
            Browse All Highways
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Route className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-black text-white">
            Route Highway Information ({highwayInfos.length} corridor{highwayInfos.length > 1 ? 's' : ''})
          </h3>
        </div>
        {onOpenHighwayDirectory && (
          <button
            onClick={onOpenHighwayDirectory}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center space-x-1"
            title="Browse all highways in directory"
          >
            <ExternalLink className="w-3 h-3" />
            <span>All Highways</span>
          </button>
        )}
      </div>

      {highwayInfos.map(({ highway, incidents: hwIncidents, snhLookup }) => {
        const statusKey = highway.overallStatus || 'clear';
        const statusClass = STATUS_COLORS[statusKey] || STATUS_COLORS.caution;
        const statusIcon = STATUS_ICONS[statusKey] || STATUS_ICONS.caution;

        return (
          <div
            key={highway.id}
            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/90 rounded-xl overflow-hidden transition shadow-lg"
          >
            <div className="p-4 border-b border-slate-800">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">NEPAL</span>
                  <span className="text-sm font-black text-amber-400 font-display">{highway.code}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h4 className="text-base font-bold text-white">{highway.name}</h4>
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${statusClass}`}>
                      <span>{statusIcon}</span>
                      <span className="uppercase">{statusKey}</span>
                    </span>
                    {highway.conditionRating && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        ⭐ {highway.conditionRating}/5
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400 mt-1.5">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>{highway.startPoint} → {highway.endPoint}</span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="font-semibold text-slate-300">{highway.totalLengthKm} km</span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center space-x-1">
                      <Mountain className="w-3.5 h-3.5 text-purple-400" />
                      <span>{highway.terrainType || 'Hilly'}</span>
                    </span>
                    {highway.activeAlertCount > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="flex items-center space-x-1 text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{highway.activeAlertCount} Active Alert{highway.activeAlertCount > 1 ? 's' : ''}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* Key Passes & Junctions */}
              {highway.keyPassesAndJunctions && highway.keyPassesAndJunctions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span>Key Passes & Junctions ({highway.keyPassesAndJunctions.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {highway.keyPassesAndJunctions.map((pass, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300"
                      >
                        {pass}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Incidents on Route Segments */}
              {hwIncidents.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>Active Incidents on This Highway ({hwIncidents.length})</span>
                  </div>
                  <div className="space-y-2">
                    {hwIncidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-white">{inc.title}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.25 rounded uppercase font-black ${
                                  inc.severity === 'severe' || inc.severity === 'critical'
                                    ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
                                    : inc.severity === 'moderate'
                                    ? 'bg-yellow-950/80 text-yellow-300 border border-yellow-700/80'
                                    : 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
                                }`}
                              >
                                {inc.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                              {inc.description}
                            </p>
                            <div className="flex items-center space-x-3 mt-1 text-[10px] text-slate-500">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{inc.reportedAt}</span>
                              </span>
                              {inc.estimatedClearance && (
                                <span>ETA: {inc.estimatedClearance}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Segments Summary */}
              {highway.segments && highway.segments.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <HardHat className="w-3 h-3 text-amber-400" />
                    <span>Road Conditions ({highway.segments.length} Segments)</span>
                  </div>
                  <div className="space-y-1.5">
                    {highway.segments.map((seg) => (
                      <div
                        key={seg.id || seg.from}
                        className="flex items-center justify-between p-2 bg-slate-950/40 rounded-lg border border-slate-800/60"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="text-[10px] font-mono text-slate-400">{seg.from} → {seg.to}</span>
                          <span className="text-[10px] text-slate-500">({seg.distanceKm} km)</span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-300">
                          {seg.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                             {/* SNH Reference — Verified DoR Distance */}
               {snhLookup && snhLookup.citation && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <FileText className="w-3 h-3 text-cyan-400" />
                    <span>SNH 2022/23 Verified Distance</span>
                  </div>
                  <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-lg">
                    <div className="flex items-baseline space-x-2 mb-1">
                      <span className="text-sm font-black text-white">{snhLookup.distanceKm.toFixed(1)} km</span>
                      <span className="text-[10px] text-slate-500">published road distance</span>
                    </div>
                    {snhLookup.evidenceLevel === 'published' && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.25 rounded text-[9px] font-black uppercase bg-emerald-950/40 text-emerald-300 border border-emerald-700/40">
                        <span>DoR Published</span>
                      </span>
                    )}
                    {snhLookup.citation.table && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        Source: {snhLookup.citation.table}
                        {snhLookup.citation.row && `, row ${snhLookup.citation.row}`}
                        {snhLookup.citation.printedPage && `, p.${snhLookup.citation.printedPage}`}
                        (PDF p.{snhLookup.citation.pdfPage})
                        {snhLookup.citation.via && <span> via {snhLookup.citation.via}</span>}
                      </div>
                    )}
                    {snhLookup.linkChain && snhLookup.linkChain.length > 0 && (
                      <details className="mt-1.5">
                        <summary className="text-[10px] text-cyan-400 cursor-pointer font-medium">Show link chain breakdown</summary>
                        <div className="mt-1 space-y-0.5">
                          {snhLookup.linkChain.map((link, i) => (
                            <div key={`${link.code}-${i}`} className="text-[9px] text-slate-400 flex justify-between">
                              <span>{link.code} — {link.name}</span>
                              <span>{link.lengthKm} km ({link.fromKm}→{link.toKm})</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* EV Chargers on Highway */}
              {highway.evChargers && highway.evChargers.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span>EV Chargers ({highway.evChargers.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {highway.evChargers.map((charger) => (
                      <div
                        key={charger.id}
                        className="p-2 bg-slate-950/40 rounded-lg border border-slate-800/60"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200 truncate">{charger.name}</span>
                          <span className={`text-[10px] px-1 py-0.25 rounded ${
                            charger.available
                              ? 'bg-emerald-950/80 text-emerald-300'
                              : 'bg-rose-950/80 text-rose-300'
                          }`}>
                            {charger.available ? 'Available' : 'Offline'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {charger.powerKw} kW • {charger.type} • {charger.location}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Toll Plazas */}
              {highway.tollPlazas && highway.tollPlazas.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-amber-400" />
                    <span>Toll Plazas ({highway.tollPlazas.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {highway.tollPlazas.map((toll) => (
                      <div
                        key={toll.id}
                        className="flex items-center justify-between p-2 bg-slate-950/40 rounded-lg border border-slate-800/60"
                      >
                        <span className="text-xs font-medium text-slate-200">{toll.name}</span>
                        <span className="text-[10px] text-slate-400">
                          Car: ₨{toll.costNpr.car} • Bike: ₨{toll.costNpr.motorbike}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DoR Division & Emergency */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-300">{highway.dorDivision}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <PhoneCall className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-300">{highway.emergencyContact}</span>
                </div>
              </div>

              {/* Action: View on Map */}
              {onViewHighwayOnMap && (
                <button
                  onClick={() => onViewHighwayOnMap(highway)}
                  className="w-full mt-2 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white rounded-lg transition flex items-center justify-center space-x-2"
                >
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>View {highway.code} on Map</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
