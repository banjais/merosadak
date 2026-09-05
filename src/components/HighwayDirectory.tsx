import React, { useState, useEffect, useMemo } from 'react';
import { Highway, RoadIncident, UserRoadReport } from '../types';
import { NEPAL_HIGHWAYS, LIVE_ROAD_INCIDENTS, INITIAL_USER_REPORTS } from '../data/nepalHighwaysData';
import { loadAll79Highways, loadRealtimeIncidents } from '../utils/nepalHighwayDataLoader';
import { analyzeHighwayRealtimeStatus, HighwayRealtimeStatusType, HighwayRealtimeAnalysis } from '../utils/highwayStatusHelper';
import {
  Search,
  Route,
  Zap,
  PhoneCall,
  ChevronDown,
  ChevronUp,
  MapPin,
  Mountain,
  Compass,
  Building,
  CheckCircle2,
  AlertTriangle,
  HardHat,
  ShieldAlert,
  Clock,
  Gauge,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';

interface HighwayDirectoryProps {
  onSelectHighwayOnMap?: (highway: Highway) => void;
  onPlanTripForHighway?: (startPoint: string, endPoint: string) => void;
  liveIncidents?: RoadIncident[];
  userReports?: UserRoadReport[];
}

export const HighwayDirectory: React.FC<HighwayDirectoryProps> = ({
  onSelectHighwayOnMap,
  onPlanTripForHighway,
  liveIncidents = LIVE_ROAD_INCIDENTS,
  userReports = INITIAL_USER_REPORTS,
}) => {
  const [highways, setHighways] = useState<Highway[]>(NEPAL_HIGHWAYS);
  const [incidents, setIncidents] = useState<RoadIncident[]>(liveIncidents);
  const [reports, setReports] = useState<UserRoadReport[]>(userReports);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | HighwayRealtimeStatusType>('all');
  const [terrainFilter, setTerrainFilter] = useState<'all' | 'Hilly' | 'High Mountain' | 'Plains'>('all');
  const [expandedHighwayId, setExpandedHighwayId] = useState<string | null>('nh17'); // default Prithvi Highway
  const [activeSegmentTooltip, setActiveSegmentTooltip] = useState<{ highwayId: string; segmentIndex: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    loadAll79Highways().then((data) => {
      if (isMounted && data && data.length > 0) {
        setHighways(data);
      }
    });

    loadRealtimeIncidents().then((incData) => {
      if (isMounted && incData && incData.length > 0) {
        setIncidents(incData);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update when prop changes
  useEffect(() => {
    if (liveIncidents && liveIncidents.length > 0) {
      setIncidents(liveIncidents);
    }
  }, [liveIncidents]);

  useEffect(() => {
    if (userReports && userReports.length > 0) {
      setReports(userReports);
    }
  }, [userReports]);

  // Compute real-time status analysis for each highway using segments data & incidents
  const highwayAnalyses = useMemo(() => {
    const map = new Map<string, HighwayRealtimeAnalysis>();
    for (const hw of highways) {
      const key = (hw.id || hw.code).toLowerCase();
      map.set(key, analyzeHighwayRealtimeStatus(hw, incidents, reports));
    }
    return map;
  }, [highways, incidents, reports]);

  const totalCalculatedKm = highways.reduce((acc, h) => acc + (h.totalLengthKm || 0), 0);
  const totalFeatureLinks = highways.reduce((acc, h) => acc + (h.segmentLinks?.length || h.segments?.length || 0), 0);

  // Status counts for top summary
  const statusCounts = useMemo(() => {
    let open = 0;
    let roadwork = 0;
    let obstruction = 0;
    let caution = 0;

    highwayAnalyses.forEach((analysis) => {
      if (analysis.realtimeStatus === 'open') open++;
      else if (analysis.realtimeStatus === 'roadwork') roadwork++;
      else if (analysis.realtimeStatus === 'obstruction') obstruction++;
      else if (analysis.realtimeStatus === 'caution') caution++;
    });

    return { open, roadwork, obstruction, caution };
  }, [highwayAnalyses]);

  const filteredHighways = highways.filter((hw) => {
    const q = searchQuery.toLowerCase().trim();
    const key = (hw.id || hw.code).toLowerCase();
    const analysis = highwayAnalyses.get(key);

    const matchesSearch =
      !q ||
      hw.name.toLowerCase().includes(q) ||
      hw.code.toLowerCase().includes(q) ||
      (hw.nepaliName && hw.nepaliName.includes(q)) ||
      (hw.startPoint && hw.startPoint.toLowerCase().includes(q)) ||
      (hw.endPoint && hw.endPoint.toLowerCase().includes(q)) ||
      (hw.route && hw.route.toLowerCase().includes(q)) ||
      (analysis && analysis.statusLabel.toLowerCase().includes(q)) ||
      (analysis && analysis.segments.some((s) => s.from.toLowerCase().includes(q) || s.to.toLowerCase().includes(q) || (s.currentIssue && s.currentIssue.toLowerCase().includes(q)))) ||
      (hw.districts && hw.districts.some((d) => d.toLowerCase().includes(q))) ||
      (hw.provinces && hw.provinces.some((p) => p.toLowerCase().includes(q))) ||
      (hw.divisions && hw.divisions.some((div) => div.toLowerCase().includes(q)));

    const matchesStatus =
      statusFilter === 'all' ||
      (analysis && analysis.realtimeStatus === statusFilter);

    const matchesTerrain = terrainFilter === 'all' || hw.terrainType === terrainFilter;

    return matchesSearch && matchesStatus && matchesTerrain;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner with Real-Time Highway Status Metrics */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
              GOVERNMENT OF NEPAL • DEPARTMENT OF ROADS (DOR)
            </span>
            <span className="text-xs text-slate-400 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Real-Time Segment Telemetry</span>
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 font-display">
            Nepal 79 National Highways Directory
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Live segment passability, real-time roadwork notices, active landslide obstructions, and DoR surveyed chainage links across all 79 national highways (NH01–NH80).
          </p>
        </div>

        {/* Real-time Highway Status Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 shrink-0">
          <div className="text-center px-3 py-1 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
            <div className="text-lg font-black text-emerald-400">{statusCounts.open}</div>
            <div className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider">Open</div>
          </div>
          <div className="text-center px-3 py-1 bg-amber-950/30 border border-amber-800/40 rounded-lg">
            <div className="text-lg font-black text-amber-400">{statusCounts.roadwork}</div>
            <div className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider">Roadwork</div>
          </div>
          <div className="text-center px-3 py-1 bg-rose-950/30 border border-rose-800/40 rounded-lg">
            <div className="text-lg font-black text-rose-400">{statusCounts.obstruction}</div>
            <div className="text-[10px] text-rose-300/80 font-bold uppercase tracking-wider">Obstruction</div>
          </div>
          <div className="text-center px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg">
            <div className="text-lg font-black text-cyan-400">{totalCalculatedKm.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total km</div>
          </div>
        </div>
      </div>

      {/* Search & Real-Time Status Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-highway-search"
            type="text"
            placeholder="Search by code (e.g. NH01, NH17, H04), name (Prithvi, Postal), district, segment, issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Real-time Status Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs overflow-x-auto">
          {[
            { id: 'all', label: `All (${highways.length})`, icon: '🌐' },
            { id: 'open', label: `Open (${statusCounts.open})`, icon: '🟢' },
            { id: 'roadwork', label: `Roadwork (${statusCounts.roadwork})`, icon: '🚧' },
            { id: 'obstruction', label: `Obstruction (${statusCounts.obstruction})`, icon: '⛔' },
            { id: 'caution', label: `Caution (${statusCounts.caution})`, icon: '⚠️' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id as any)}
              title={`Filter by ${s.label}`}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1.5 whitespace-nowrap ${
                statusFilter === s.id
                  ? 'bg-slate-800 text-white shadow border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <span>{s.icon}</span>
              <span className="text-[11px] font-bold">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Terrain Filter */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs">
          {[
            { id: 'all', icon: '🗺️', label: 'All Terrains' },
            { id: 'Hilly', icon: '⛰️', label: 'Hills' },
            { id: 'High Mountain', icon: '🏔️', label: 'Alpine' },
            { id: 'Plains', icon: '🌾', label: 'Terai' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTerrainFilter(t.id as any)}
              title={`${t.label} Terrain`}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                terrainFilter === t.id
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t.icon}</span>
              <span className="text-[11px]">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Highway Cards List */}
      <div className="space-y-4">
        {filteredHighways.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <Route className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">No highways found matching your status or search filters.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTerrainFilter('all');
              }}
              className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white font-bold rounded-lg border border-slate-700 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredHighways.map((highway) => {
            const highwayKey = (highway.id || highway.code).toLowerCase();
            const isExpanded = (expandedHighwayId || '').toLowerCase() === highwayKey;
            const analysis = highwayAnalyses.get(highwayKey) || analyzeHighwayRealtimeStatus(highway, incidents, reports);
            const segments = analysis.segments;

            return (
              <div
                key={highwayKey}
                id={`highway-card-${highwayKey}`}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/90 rounded-2xl overflow-hidden transition shadow-lg"
              >
                {/* Main Card Header */}
                <div
                  onClick={() => setExpandedHighwayId(isExpanded ? null : highwayKey)}
                  className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-850/50 transition select-none"
                >
                  <div className="flex items-start space-x-4 flex-1">
                    {/* Highway Badge */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 flex flex-col items-center justify-center shrink-0 shadow-md">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">NEPAL</span>
                      <span className="text-base font-black text-amber-400 font-display">{highway.code}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name & Real-time Status Indicator Pill */}
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="text-lg font-bold text-white tracking-tight">{highway.name}</h3>
                        {highway.nepaliName && (
                          <span className="text-xs text-slate-400 font-medium">({highway.nepaliName})</span>
                        )}

                        {/* Real-time Status Indicator Badge */}
                        <div
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide border shadow-sm ${analysis.theme.badgeBg} ${analysis.theme.badgeBorder}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${analysis.theme.dotColor}`} />
                          <span>{analysis.statusBadgeText}</span>
                        </div>

                        {/* Passability Percentage */}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {analysis.passabilityScore}% Passable
                        </span>
                      </div>

                      {/* Route Corridor & Key Metadata */}
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400 mt-1.5">
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{highway.startPoint} ➔ {highway.endPoint}</span>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="font-semibold text-slate-300">{highway.totalLengthKm} km</span>
                        <span className="text-slate-600">•</span>
                        <span className="flex items-center space-x-1">
                          <Mountain className="w-3.5 h-3.5 text-purple-400" />
                          <span>{highway.terrainType || 'Hilly'}</span>
                        </span>
                        {highway.districts && highway.districts.length > 0 && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">
                              {highway.districts.length} Districts: <span className="text-slate-300">{highway.districts.slice(0, 3).join(', ')}{highway.districts.length > 3 ? ` +${highway.districts.length - 3}` : ''}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Real-Time Segment Status Bar (Interactive Visual Progress Strip) */}
                      <div className="mt-3 pt-2 border-t border-slate-800/60">
                        <div className="flex items-center justify-between text-[11px] mb-1.5 text-slate-400">
                          <span className="flex items-center space-x-1 font-semibold">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Segment Real-Time Status ({segments.length} Sections):</span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            <span className="text-emerald-400 font-bold">{analysis.openSegmentsCount} Open</span>
                            {analysis.roadworkSegmentsCount > 0 && (
                              <span className="text-amber-400 font-bold ml-1.5">• {analysis.roadworkSegmentsCount} Roadwork</span>
                            )}
                            {analysis.obstructionSegmentsCount > 0 && (
                              <span className="text-rose-400 font-bold ml-1.5">• {analysis.obstructionSegmentsCount} Obstruction</span>
                            )}
                            {analysis.cautionSegmentsCount > 0 && (
                              <span className="text-yellow-400 font-bold ml-1.5">• {analysis.cautionSegmentsCount} Caution</span>
                            )}
                          </span>
                        </div>

                        {/* Segmented Color Bar */}
                        <div className="flex items-center space-x-1 h-3 w-full bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                          {segments.map((seg, sIdx) => {
                            let barColor = 'bg-emerald-500 hover:bg-emerald-400';
                            if (seg.realtimeStatusType === 'obstruction') barColor = 'bg-rose-500 hover:bg-rose-400 animate-pulse';
                            else if (seg.realtimeStatusType === 'roadwork') barColor = 'bg-amber-500 hover:bg-amber-400';
                            else if (seg.realtimeStatusType === 'caution') barColor = 'bg-yellow-500 hover:bg-yellow-400';

                            return (
                              <div
                                key={seg.id || sIdx}
                                className={`h-full rounded-sm flex-1 transition cursor-pointer relative group ${barColor}`}
                                title={`${seg.from} ➔ ${seg.to} (${seg.distanceKm} km): ${seg.statusLabel} - ${seg.currentIssue || 'Clear flow'}`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Active Headline Issue Notice (if roadwork or obstruction exists) */}
                      {analysis.headlineIssue && analysis.realtimeStatus !== 'open' && (
                        <div className="mt-2.5 flex items-center space-x-2 text-xs px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800">
                          {analysis.realtimeStatus === 'obstruction' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : analysis.realtimeStatus === 'roadwork' ? (
                            <HardHat className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Info className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                          )}
                          <span className="text-slate-300 font-medium truncate">
                            {analysis.headlineIssue}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Header Status Score & Expand Button */}
                  <div className="flex items-center space-x-4 shrink-0 self-end md:self-center">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-400">Passability Index</div>
                      <div className={`text-sm font-black ${analysis.theme.badgeText}`}>
                        {analysis.passabilityScore}% <span className="text-xs text-slate-500 font-normal">operational</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 group-hover:text-white transition">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 bg-slate-950/60 space-y-5">
                    {/* Highway Description & Route Context */}
                    <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
                      {highway.description || `National Highway ${highway.code} connecting ${highway.route || `${highway.startPoint} to ${highway.endPoint}`}, maintained by Department of Roads, Nepal.`}
                    </p>

                    {/* Real-time Status Breakdown Card */}
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${analysis.theme.badgeBg} ${analysis.theme.badgeBorder}`}>
                            {analysis.statusLabel}
                          </span>
                          <span className="text-sm font-bold text-white">
                            Real-Time Segment Status &amp; Roadwork Condition
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                          {analysis.statusSummary}
                        </span>
                      </div>

                      {/* Segments Live Status Table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-80 overflow-y-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800 sticky top-0 backdrop-blur-md">
                            <tr>
                              <th className="py-2.5 px-3">Segment Section</th>
                              <th className="py-2.5 px-3">Distance</th>
                              <th className="py-2.5 px-3">Real-Time Status</th>
                              <th className="py-2.5 px-3">Surface &amp; Lanes</th>
                              <th className="py-2.5 px-3">Speed</th>
                              <th className="py-2.5 px-3">Live Condition Notice &amp; Authority</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {segments.map((seg, idx) => {
                              let statusPillClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
                              let statusIcon = '🟢';
                              if (seg.realtimeStatusType === 'obstruction') {
                                statusPillClass = 'bg-rose-950/80 text-rose-300 border-rose-700/80 animate-pulse';
                                statusIcon = '⛔';
                              } else if (seg.realtimeStatusType === 'roadwork') {
                                statusPillClass = 'bg-amber-950/80 text-amber-300 border-amber-700/80';
                                statusIcon = '🚧';
                              } else if (seg.realtimeStatusType === 'caution') {
                                statusPillClass = 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80';
                                statusIcon = '⚠️';
                              }

                              return (
                                <tr key={seg.id || idx} className="hover:bg-slate-850/50 transition">
                                  {/* Section Name */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-white flex items-center space-x-1.5">
                                      <span>{seg.from}</span>
                                      <ArrowRight className="w-3 h-3 text-slate-500" />
                                      <span>{seg.to}</span>
                                    </div>
                                    {seg.elevationStartM && seg.elevationEndM && (
                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                        Alt: {seg.elevationStartM}m ➔ {seg.elevationEndM}m
                                      </div>
                                    )}
                                  </td>

                                  {/* Distance */}
                                  <td className="py-2.5 px-3 font-semibold text-slate-200 whitespace-nowrap">
                                    {seg.distanceKm} km
                                  </td>

                                  {/* Status Indicator */}
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black uppercase border ${statusPillClass}`}>
                                      <span>{statusIcon}</span>
                                      <span>{seg.statusLabel}</span>
                                    </span>
                                  </td>

                                  {/* Surface & Lanes */}
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <div className="capitalize text-slate-200 font-medium">
                                      {seg.surface.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {seg.lanes} {seg.lanes === 1 ? 'Lane' : 'Lanes'}
                                    </div>
                                  </td>

                                  {/* Avg Speed */}
                                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap font-medium">
                                    {seg.avgSpeedKmh} km/h
                                  </td>

                                  {/* Condition & Authority */}
                                  <td className="py-2.5 px-3 max-w-sm">
                                    <div className={`text-xs ${seg.realtimeStatusType === 'open' ? 'text-slate-300' : seg.realtimeStatusType === 'roadwork' ? 'text-amber-300' : 'text-rose-300'}`}>
                                      {seg.currentIssue || 'Normal two-way traffic flow'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center space-x-1">
                                      <Clock className="w-3 h-3 text-slate-600" />
                                      <span>{seg.lastUpdated || 'Recently verified'} • {seg.verifiedBy || 'DoR Traffic Operations'}</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Districts & Divisions Summary Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                          <Compass className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Districts Traversed ({highway.districts?.length || 0}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {highway.districts && highway.districts.length > 0 ? (
                            highway.districts.map((d, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300">
                                {d}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500 italic">National Highway Corridor</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                          <Building className="w-3.5 h-3.5 text-emerald-400" />
                          <span>DoR Road Divisions &amp; Emergency:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {highway.divisions && highway.divisions.length > 0 ? (
                            highway.divisions.map((div, i) => (
                              <span key={i} className="px-2 py-0.5 bg-emerald-950/40 border border-emerald-800/50 rounded text-[11px] text-emerald-300">
                                {div}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-300 font-medium">{highway.dorDivision || 'Department of Roads, Nepal'}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1.5 flex items-center space-x-1">
                          <PhoneCall className="w-3 h-3 text-amber-400" />
                          <span>Hotline: <strong className="text-slate-200">{highway.emergencyContact || '103 / 100'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* DoR Surveyed Chainage Links (if available) */}
                    {highway.segmentLinks && highway.segmentLinks.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>DoR Surveyed Links &amp; Pavement Catalog:</span>
                          <span className="text-[11px] text-slate-500 font-normal">{highway.segmentLinks.length} GIS Survey Links</span>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 sticky top-0 backdrop-blur-md">
                              <tr>
                                <th className="py-2 px-3">Link Code</th>
                                <th className="py-2 px-3">Section Name</th>
                                <th className="py-2 px-3">Length</th>
                                <th className="py-2 px-3">District</th>
                                <th className="py-2 px-3">Pavement</th>
                                <th className="py-2 px-3">DoR Division</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {highway.segmentLinks.slice(0, 30).map((link, idx) => (
                                <tr key={idx} className="hover:bg-slate-850/40 transition">
                                  <td className="py-2 px-3 font-mono font-bold text-amber-400">
                                    {link.linkCode || `L-${idx + 1}`}
                                  </td>
                                  <td className="py-2 px-3 font-medium text-white max-w-xs truncate">
                                    {link.linkName || link.roadName || 'Main Corridor'}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-200">{link.linkLenKm} km</td>
                                  <td className="py-2 px-3 text-slate-300">{link.distName || '—'}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">
                                      {link.paveType || 'Blacktopped'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-slate-400 text-[11px]">{link.divName || 'DoR'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons: Show on Map & Plan Route */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => onSelectHighwayOnMap && onSelectHighwayOnMap(highway)}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center space-x-2"
                      >
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        <span>View Highway Vector on GIS Map</span>
                      </button>

                      <button
                        onClick={() => onPlanTripForHighway && onPlanTripForHighway(highway.startPoint, highway.endPoint)}
                        className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition shadow-md shadow-amber-500/20 flex items-center justify-center space-x-2"
                      >
                        <Route className="w-4 h-4 text-slate-950" />
                        <span>Plan Route along {highway.code} ({highway.name})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
