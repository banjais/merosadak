import { useEffect, useState } from "react";
import { fetchDeployStatus } from "../services/githubStatus";
import { Activity, CheckCircle2, XCircle, Clock, ExternalLink, GitBranch, BarChart3, TrendingUp, MapPin, RefreshCw, Megaphone, Trash2 } from "lucide-react";

interface DeployDashboardProps {
  isDarkMode: boolean;
  analyticsSummary?: any;
  analyticsTrends?: any;
  topDistricts?: any[];
  topHighways?: any[];
  analyticsLoading?: boolean;
  onRefetchAnalytics?: () => void;
  isSuperadmin?: boolean;
  onBroadcast?: (msg: string) => void;
  onPurgeCache?: () => void;
  superadminBusy?: boolean;
}

export default function DeployDashboard({
  isDarkMode,
  analyticsSummary,
  analyticsTrends,
  topDistricts = [],
  topHighways = [],
  analyticsLoading = true,
  onRefetchAnalytics,
  isSuperadmin = false,
  onBroadcast,
  onPurgeCache,
  superadminBusy = false,
}: DeployDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const i = setInterval(load, 30000); // 30 seconds refresh
    return () => clearInterval(i);
  }, []);

  async function load() {
    const res = await fetchDeployStatus();
    setData(res);
    setLoading(false);
  }

  function getStatusConfig(status: string, conclusion: string) {
    if (status === "in_progress")
      return { color: "text-amber-400", bg: "bg-amber-400/20", icon: <Clock className="animate-spin" size={16} />, label: "In Progress" };
    if (conclusion === "success")
      return { color: "text-emerald-400", bg: "bg-emerald-400/20", icon: <CheckCircle2 size={16} />, label: "Success" };
    if (conclusion === "failure")
      return { color: "text-red-400", bg: "bg-red-400/20", icon: <XCircle size={16} />, label: "Failed" };
    return { color: "text-slate-400", bg: "bg-slate-400/20", icon: <Activity size={16} />, label: status || "Queued" };
  }

  function Card({ title, run }: { title: string; run: any }) {
    if (!run) return (
      <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-2">{title}</h2>
        <p className="text-xs opacity-40">No deployment detected</p>
      </div>
    );

    const config = getStatusConfig(run.status, run.conclusion);

    return (
      <div className={`p-5 rounded-3xl border transition-all duration-300 hover:shadow-xl ${isDarkMode
        ? 'bg-slate-800/80 border-slate-700 backdrop-blur-md'
        : 'bg-white/80 border-white/50 backdrop-blur-md'
        }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-sm font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
            {title}
          </h2>
          <div className={`px-3 py-1 rounded-full flex items-center gap-2 text-[10px] font-bold ${config.bg} ${config.color}`}>
            {config.icon}
            {config.label}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="opacity-40" />
            <span className="text-xs font-medium opacity-80">{run.head_branch}</span>
          </div>

          <p className={`text-xs leading-relaxed line-clamp-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {run.display_title || run.name}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
            <span className="text-[10px] opacity-40">
              {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <a
              href={run.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider hover:underline ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
            >
              Logs <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) return (
    <div className="p-6 text-center animate-pulse">
      <div className="h-6 w-32 bg-slate-700 rounded-full mx-auto mb-4" />
      <div className="grid grid-cols-1 gap-4">
        <div className="h-32 bg-slate-800/50 rounded-3xl" />
        <div className="h-32 bg-slate-800/50 rounded-3xl" />
      </div>
    </div>
  );

  return (
    <div className={`p-6 ${isDarkMode ? 'text-white' : 'text-slate-900'} max-h-full overflow-y-auto custom-scrollbar`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tighter mb-1">DEPLOYMENTS</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">System Heartbeat</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <Card title="Backend / Render" run={data?.backend} />
        <Card title="Frontend / Firebase" run={data?.frontend} />
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-4 px-1">Recent Activity</h3>
        <div className="space-y-2">
          {data?.all.map((run: any) => {
            const config = getStatusConfig(run.status, run.conclusion);
            return (
              <div
                key={run.id}
                className={`flex items-center justify-between p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-gray-50 border-gray-100'
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`shrink-0 ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold truncate">{run.display_title || run.name}</p>
                    <p className="text-[9px] opacity-40 uppercase tracking-wider">{run.head_branch}</p>
                  </div>
                </div>
                <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                  {run.conclusion || 'Running'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics Section */}
      <div className="mt-8 pt-8 border-t border-slate-700/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Analytics Overview</h3>
          </div>
          {onRefetchAnalytics && (
            <button
              onClick={onRefetchAnalytics}
              disabled={analyticsLoading}
              className={`p-1.5 rounded-lg transition-colors ${analyticsLoading ? 'opacity-50' : 'hover:bg-slate-700/50'}`}
            >
              <RefreshCw size={12} className={analyticsLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {analyticsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : analyticsSummary ? (
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
              <p className="text-[9px] uppercase tracking-wider opacity-40">Total Reports</p>
              <p className="text-xl font-black">{analyticsSummary.totalReports || 0}</p>
            </div>
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
              <p className="text-[9px] uppercase tracking-wider opacity-40">Active Users</p>
              <p className="text-xl font-black">{analyticsSummary.activeUsers || 0}</p>
            </div>
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
              <p className="text-[9px] uppercase tracking-wider opacity-40">Resolved</p>
              <p className="text-xl font-black text-emerald-400">{analyticsSummary.resolvedCount || 0}</p>
            </div>
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
              <p className="text-[9px] uppercase tracking-wider opacity-40">Resolution Rate</p>
              <p className="text-xl font-black text-blue-400">{analyticsSummary.resolutionRate || 0}%</p>
            </div>
          </div>
        ) : (
          <p className="text-xs opacity-40 text-center py-4">No analytics data available</p>
        )}

        {/* Top Districts */}
        {topDistricts.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[9px] font-black uppercase tracking-wider opacity-40 mb-2 flex items-center gap-1">
              <MapPin size={10} /> Top Districts
            </h4>
            <div className="space-y-1">
              {topDistricts.slice(0, 3).map((d: any, i: number) => (
                <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg ${isDarkMode ? 'bg-slate-800/30' : 'bg-gray-50'}`}>
                  <span className="font-medium">{d.name || `District ${i + 1}`}</span>
                  <span className="opacity-60">{d.count || 0} reports</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Highways */}
        {topHighways.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[9px] font-black uppercase tracking-wider opacity-40 mb-2 flex items-center gap-1">
              <TrendingUp size={10} /> Top Highways
            </h4>
            <div className="space-y-1">
              {topHighways.slice(0, 3).map((h: any, i: number) => (
                <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg ${isDarkMode ? 'bg-slate-800/30' : 'bg-gray-50'}`}>
                  <span className="font-medium">{h.name || `Highway ${i + 1}`}</span>
                  <span className="opacity-60">{h.count || 0} reports</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Superadmin Controls */}
      {isSuperadmin && (
        <div className="mt-8 pt-8 border-t border-amber-500/20">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-4">Superadmin Controls</h3>
          <div className="space-y-2">
            <button
              onClick={() => onBroadcast?.('System maintenance scheduled')}
              disabled={superadminBusy}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${superadminBusy ? 'opacity-50' : ''} ${isDarkMode ? 'bg-amber-900/20 hover:bg-amber-900/30' : 'bg-amber-50 hover:bg-amber-100'}`}
            >
              <Megaphone size={16} className="text-amber-400" />
              <span className="text-xs font-bold">Broadcast System Update</span>
            </button>
            <button
              onClick={() => onPurgeCache?.()}
              disabled={superadminBusy}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${superadminBusy ? 'opacity-50' : ''} ${isDarkMode ? 'bg-amber-900/20 hover:bg-amber-900/30' : 'bg-amber-50 hover:bg-amber-100'}`}
            >
              <Trash2 size={16} className="text-amber-400" />
              <span className="text-xs font-bold">Purge All Caches</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}