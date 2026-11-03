// Shared "Reporting" section used by the Super Admin panel, the Office Admin
// panel and the General User profile page. Shows every user-submitted hazard
// report (Worker KV `user-reports.json` via GET /api/reports) alongside the
// live incident feed (DoR + Waze + local via GET /api/road-alerts).
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  FileBarChart,
  MapPin,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  ThumbsUp,
} from 'lucide-react';
import { fetchJson } from '../utils/apiConfig';

interface UserReport {
  id: string;
  type?: string;
  incidentType?: string;
  location?: string;
  description?: string;
  highwayCode?: string | null;
  severity?: string | null;
  reporterName?: string | null;
  upvotes?: number;
  createdAt?: string;
  status?: string;
}

interface LiveIncident {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  locationName?: string;
  reportedAt?: string;
  source?: string;
  dorVerified?: boolean;
}

interface ReportingSectionProps {
  variant: 'superadmin' | 'officeadmin' | 'general';
  /** Opens the hazard-report modal — used by the General User CTA. */
  onSubmitReport?: () => void;
}

const TYPE_STYLES: Record<string, string> = {
  pothole: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  landslide: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  flood: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  construction: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  fallen_rocks: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  one_way: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  accident: 'bg-red-500/10 text-red-300 border-red-500/30',
  bridge_maintenance: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  traffic_jam: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
};

function typeLabel(t?: string): string {
  const raw = t || 'Report';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeStyle(t?: string): string {
  return TYPE_STYLES[t || ''] || 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SUBTITLES: Record<ReportingSectionProps['variant'], string> = {
  superadmin: 'Every user-submitted hazard report and live feed incident across the network.',
  officeadmin: 'Review submitted hazard reports and live incidents for office follow-up.',
  general: 'Community hazard reports and live road incidents — report one from here too.',
};

const USER_REPORT_PAGE = 20;
const INCIDENT_PAGE = 25;

export const ReportingSection: React.FC<ReportingSectionProps> = ({ variant, onSubmitReport }) => {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [incidents, setIncidents] = useState<LiveIncident[]>([]);
  const [counts, setCounts] = useState<{ dor: number; waze: number }>({ dor: 0, waze: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'user' | 'live'>('user');
  const [syncedAt, setSyncedAt] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // allSettled: one failing endpoint must not blank the other half.
    const [reportsRes, alertsRes] = await Promise.allSettled([
      fetchJson<{ reports?: UserReport[] }>('/api/reports'),
      fetchJson<{ incidents?: LiveIncident[]; counts?: Record<string, number> }>('/api/road-alerts'),
    ]);
    setReports(reportsRes.status === 'fulfilled' ? reportsRes.value.reports ?? [] : []);
    const inc = alertsRes.status === 'fulfilled' ? alertsRes.value.incidents ?? [] : [];
    setIncidents(inc);
    setCounts({
      dor: inc.filter((i) => i.source === 'dor').length,
      waze: inc.filter((i) => i.source === 'waze').length,
    });
    if (reportsRes.status === 'rejected' && alertsRes.status === 'rejected') {
      setError('Could not reach the reporting service. Check your connection and refresh.');
    }
    setSyncedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeHazards = reports.filter((r) => (r.status ?? 'active') === 'active').length;
  const statCards = [
    { label: 'User Reports', value: String(reports.length), cls: 'text-emerald-400' },
    { label: 'Active Hazards', value: String(activeHazards), cls: 'text-amber-400' },
    { label: 'Live Incidents', value: String(incidents.length), cls: 'text-cyan-400' },
    { label: 'DoR Verified', value: String(counts.dor), cls: 'text-violet-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-emerald-400" />
            Reporting — Hazard Reports &amp; Live Incidents
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">{SUBTITLES[variant]}</p>
        </div>
        <div className="flex items-center gap-2">
          {variant === 'general' && onSubmitReport && (
            <button
              onClick={onSubmitReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-[11px] shadow-lg shadow-emerald-500/20 transition"
            >
              <Send className="w-3 h-3" />
              Report a Hazard
            </button>
          )}
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition text-[11px] font-medium"
            aria-label="Refresh reports"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{c.label}</p>
            <p className={`text-xl font-black font-mono mt-1 ${c.cls}`}>{loading ? '—' : c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          ['user', 'User Reports', reports.length],
          ['live', 'Live Incidents', incidents.length],
        ] as const).map(([id, label, n]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 rounded-xl text-[11px] font-bold transition border ${
              tab === id
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {label} <span className="font-mono opacity-70">({loading ? '…' : n})</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-900/20 border border-rose-500/30 text-rose-300 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4 animate-pulse">
              <div className="h-3 w-1/3 bg-slate-800 rounded mb-2" />
              <div className="h-2.5 w-2/3 bg-slate-800/70 rounded" />
            </div>
          ))}
        </div>
      ) : tab === 'user' ? (
        reports.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-8 text-center">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-xs text-slate-400 font-medium">No user reports yet.</p>
            <p className="text-[10px] text-slate-500 mt-1">
              Hazard reports submitted from the app appear here instantly.
            </p>
            {variant === 'general' && onSubmitReport && (
              <button
                onClick={onSubmitReport}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition"
              >
                <Send className="w-3 h-3" /> Submit the first report
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {reports.slice(0, USER_REPORT_PAGE).map((r) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${typeStyle(r.type || r.incidentType)}`}>
                    {typeLabel(r.type || r.incidentType)}
                  </span>
                  {r.severity && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                      r.severity === 'severe'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : r.severity === 'minor'
                          ? 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}>
                      {typeLabel(r.severity)}
                    </span>
                  )}
                  {r.highwayCode && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {r.highwayCode}
                    </span>
                  )}
                  <span className="text-[9px] text-slate-500 font-mono ml-auto">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-2 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  {r.location || 'Unknown location'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-3">{r.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> {r.upvotes ?? 0}
                  </span>
                  {r.reporterName && <span>by {r.reporterName}</span>}
                  {r.status && r.status !== 'active' && <span className="text-amber-400">{r.status}</span>}
                </div>
              </div>
            ))}
            {reports.length > USER_REPORT_PAGE && (
              <p className="text-[10px] text-slate-500 text-center font-mono">
                Showing latest {USER_REPORT_PAGE} of {reports.length} reports
              </p>
            )}
          </div>
        )
      ) : incidents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-8 text-center">
          <Radio className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-xs text-slate-400 font-medium">No live incidents right now.</p>
          <p className="text-[10px] text-slate-500 mt-1">DoR and Waze feeds are clear.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.slice(0, INCIDENT_PAGE).map((i) => (
            <div key={i.id} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${typeStyle(i.type)}`}>
                  {typeLabel(i.type)}
                </span>
                {i.source === 'dor' ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30">
                    <ShieldCheck className="w-2.5 h-2.5" /> DoR
                  </span>
                ) : i.source === 'waze' ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    Waze
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/10 text-slate-300 border border-slate-500/30">
                    {i.source ? typeLabel(i.source) : 'Local'}
                  </span>
                )}
                <span className="text-[9px] text-slate-500 font-mono ml-auto">{timeAgo(i.reportedAt)}</span>
              </div>
              <p className="text-xs font-bold text-slate-200 mt-2">{i.title || typeLabel(i.type)}</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">{i.description}</p>
              <p className="text-[9px] text-slate-500 font-mono mt-1.5 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {i.locationName || 'Unknown location'}
              </p>
            </div>
          ))}
          {incidents.length > INCIDENT_PAGE && (
            <p className="text-[10px] text-slate-500 text-center font-mono">
              Showing latest {INCIDENT_PAGE} of {incidents.length} incidents
            </p>
          )}
        </div>
      )}

      {syncedAt && !loading && !error && (
        <p className="text-[9px] text-slate-600 font-mono text-center">
          Synced {timeAgo(syncedAt)} · user-reports + DoR/Waze feeds
        </p>
      )}
    </div>
  );
};
