import React, { useState } from 'react';
import { RoadIncident, UserRoadReport, RoutePlanResult } from '../types';
import { AlertTriangle, ShieldCheck, ThumbsUp, Radio, MapPin, Clock, Filter, CheckCircle2, ChevronRight, Navigation, Globe } from 'lucide-react';
import { isPointNearRoute } from '../utils/geoUtils';

interface RoadAlertsFeedProps {
  incidents: RoadIncident[];
  userReports: UserRoadReport[];
  activeRoute?: RoutePlanResult | null;
  onOpenReportModal: () => void;
  onUpvoteReport?: (id: string) => void;
  onSelectIncident?: (incident: RoadIncident) => void;
}

export const RoadAlertsFeed: React.FC<RoadAlertsFeedProps> = ({
  incidents,
  userReports,
  activeRoute,
  onOpenReportModal,
  onUpvoteReport,
  onSelectIncident,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dor' | 'community'>('dor');
  // Default to corridor-only when user has a chosen route/location so we don't show everywhere reports
  const [focusCorridorOnly, setFocusCorridorOnly] = useState<boolean>(!!activeRoute);

  // Filter by corridor if selected and activeRoute exists
  const routeIncidents = incidents.filter((inc) => {
    if (!focusCorridorOnly || !activeRoute) return true;
    return isPointNearRoute(
      inc.lat,
      inc.lng,
      activeRoute.pathCoordinates,
      activeRoute.origin,
      activeRoute.destination,
      35
    );
  });

  const routeReports = userReports.filter((rep) => {
    if (!focusCorridorOnly || !activeRoute) return true;
    if (rep.lat && rep.lng) {
      return isPointNearRoute(
        rep.lat,
        rep.lng,
        activeRoute.pathCoordinates,
        activeRoute.origin,
        activeRoute.destination,
        35
      );
    }
    // Fallback match on route origin/dest names
    const repLoc = rep.location.toLowerCase();
    const origMatch = activeRoute.origin.name.toLowerCase().includes(repLoc);
    const destMatch = activeRoute.destination.name.toLowerCase().includes(repLoc);
    return origMatch || destMatch;
  });

  const filteredIncidents = routeIncidents.filter((inc) => {
    if (filterType === 'all') return true;
    return inc.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Scope Selector: Focus Chosen Location vs Show Everywhere */}
      {activeRoute && (
        <div className="bg-slate-950/90 border border-slate-800 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">
              Chosen Corridor: <strong className="text-white">{activeRoute.origin.name} ➔ {activeRoute.destination.name}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFocusCorridorOnly(true)}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                focusCorridorOnly
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Focus only on your chosen route corridor"
            >
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>Chosen Corridor ({routeIncidents.length})</span>
            </button>
            <button
              onClick={() => setFocusCorridorOnly(false)}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                !focusCorridorOnly
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show all reports across Nepal"
            >
              <Globe className="w-3 h-3 text-sky-400" />
              <span>All Nepal ({incidents.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Summary & Live Metrics */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight font-display">
                {focusCorridorOnly && activeRoute ? 'Route Corridor Hazard Advisories' : 'Highway Alerts & Road Hazards'}
              </h2>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded">
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {focusCorridorOnly && activeRoute
                ? `Filtered strictly along ${activeRoute.origin.name} ➔ ${activeRoute.destination.name}`
                : 'Department of Roads & Nepal Traffic Police live advisories'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <div className="text-center px-1">
              <span className="text-rose-400 font-bold">{routeIncidents.filter(i => i.severity === 'critical' || i.status === 'blocked').length}</span>
              <span className="text-slate-500 text-[10px] ml-1">Blocked</span>
            </div>
            <div className="w-px h-4 bg-slate-800" />
            <div className="text-center px-1">
              <span className="text-amber-400 font-bold">{routeIncidents.filter(i => i.status === 'caution' || i.status === 'single_lane').length}</span>
              <span className="text-slate-500 text-[10px] ml-1">Caution</span>
            </div>
            <div className="w-px h-4 bg-slate-800" />
            <div className="text-center px-1">
              <span className="text-emerald-400 font-bold">{routeIncidents.filter(i => i.status === 'clear').length}</span>
              <span className="text-slate-500 text-[10px] ml-1">Clear</span>
            </div>
          </div>

          <button
            onClick={onOpenReportModal}
            className="p-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-1 shrink-0"
            title="Report Road Hazard"
          >
            <Radio className="w-4 h-4 text-amber-100 animate-pulse" />
            <span className="text-[11px] hidden sm:inline">Report</span>
          </button>
        </div>
      </div>

      {/* Main Tabs (Icon-First) & Filter Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
        {/* Segmented Icon Mode Toggle */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('dor')}
            title="Department of Roads Official Bulletins"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'dor'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official ({routeIncidents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('community')}
            title="Crowdsourced Community Driver Reports"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'community'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Community ({routeReports.length})</span>
          </button>
        </div>

        {/* Filter Chips (Icon-Focused) */}
        <div className="flex items-center space-x-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {[
            { id: 'all', icon: '🌐', label: 'All' },
            { id: 'landslide', icon: '⛰️', label: 'Landslides' },
            { id: 'construction', icon: '🚧', label: 'Roadwork' },
            { id: 'bridge_maintenance', icon: '🌉', label: 'Bridges' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterType(chip.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1 shrink-0 ${
                filterType === chip.id
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-slate-200'
              }`}
            >
              <span className="text-xs">{chip.icon}</span>
              <span className="text-[11px]">{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Incidents List */}
      {activeTab === 'dor' ? (
        <div className="space-y-3">
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-300 text-sm font-semibold">No severe obstructions reported at this moment.</p>
              <p className="text-slate-500 text-xs mt-1">All major corridors are operating normally.</p>
            </div>
          ) : (
            filteredIncidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 p-5 rounded-2xl shadow-lg transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        incident.severity === 'critical' || incident.severity === 'severe'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-base">{incident.title}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">
                          DOR VERIFIED
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                        <span className="text-emerald-400 font-semibold">{incident.highwayName} ({incident.highwayCode})</span>
                        <span>•</span>
                        <span>{incident.locationName}</span>
                        {incident.chainageKm && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500">{incident.chainageKm}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        incident.status === 'clear'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : incident.status === 'caution'
                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                          : 'bg-red-950 text-red-300 border-red-700'
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  {incident.description}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center space-x-4 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Reported {incident.reportedAt}</span>
                    </span>
                    {incident.estimatedClearance && (
                      <span className="text-amber-400 font-medium">
                        ⏱️ Est. Clearance: <strong>{incident.estimatedClearance}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    {incident.alternativeRouteAdvice && (
                      <div className="text-[11px] text-cyan-300">
                        <strong>Detour:</strong> {incident.alternativeRouteAdvice}
                      </div>
                    )}
                    {onSelectIncident && (
                      <button
                        onClick={() => onSelectIncident(incident)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold rounded-lg transition flex items-center space-x-1 shrink-0"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Locate on Map</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Community Reports Feed */
        <div className="space-y-3">
          {routeReports.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <Radio className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">
                {focusCorridorOnly && activeRoute
                  ? 'No crowdsourced reports submitted along your chosen route corridor.'
                  : 'No crowdsourced reports submitted yet.'}
              </p>
            </div>
          ) : (
            routeReports.map((rep) => (
              <div
                key={rep.id}
                className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{rep.location}</span>
                    <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-semibold">
                      {rep.highwayCode}
                    </span>
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] uppercase font-bold capitalize">
                      {rep.incidentType.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">{rep.createdAt}</span>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  {rep.description}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span className="text-[11px]">Reported by: <strong className="text-slate-200">{rep.reporterName}</strong></span>
                  <button
                    onClick={() => onUpvoteReport && onUpvoteReport(rep.id)}
                    className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                  >
                    <ThumbsUp className="w-3 h-3 text-emerald-400" />
                    <span>Confirm / Upvote ({rep.upvotes})</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
