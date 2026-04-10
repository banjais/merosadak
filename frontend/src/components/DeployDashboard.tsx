import { useEffect, useState } from "react";
import { fetchDeployStatus } from "../services/githubStatus";
import { Activity, CheckCircle2, XCircle, Clock, ExternalLink, GitBranch } from "lucide-react";

export default function DeployDashboard({ isDarkMode }: { isDarkMode: boolean }) {
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
      <div className={`p-5 rounded-3xl border transition-all duration-300 hover:shadow-xl ${
        isDarkMode 
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
                className={`flex items-center justify-between p-3 rounded-2xl border ${
                  isDarkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-gray-50 border-gray-100'
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
    </div>
  );
}