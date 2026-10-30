import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  LayoutDashboard,
  Settings,
  BarChart3,
  AlertTriangle,
  LogOut,
  Mail,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

interface SuperAdminControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const SuperAdminControlPanel: React.FC<SuperAdminControlPanelProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'settings'>('dashboard');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden animate-fadeIn flex flex-col h-[85vh] sm:h-[90vh] max-h-[700px]">
        {/* Header */}
        <div className="bg-slate-800/80 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display tracking-tight">Super Admin Control Panel</h3>
              <p className="text-[10px] text-slate-400 font-mono">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <span className="sr-only">Close</span>
            <span className="text-[10px]">✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar nav */}
          <div className="w-64 border-r border-slate-800/60 bg-slate-950/60 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800/40">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sections</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 p-1">
              {[
                { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
                { id: 'users' as const, label: 'Users', icon: Users },
                { id: 'settings' as const, label: 'System Settings', icon: Settings },
              ].map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition rounded-l-xl ${
                    activeSection === section.id
                      ? 'bg-accent-bg text-slate-950 border-r-2 border-accent-border shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <section.icon className="w-4 h-4 shrink-0" />
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-auto p-4 border-t border-slate-800/40">
              <button
                onClick={() => {}}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white transition text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40 custom-scrollbar">
            {activeSection === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Active Incidents', value: '0', color: 'text-rose-400', bg: 'bg-rose-900/20', icon: AlertTriangle },
                    { label: 'Signed-in Users', value: '1', color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: Users },
                    { label: 'Live Feeds', value: 'Online', color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: BarChart3 },
                    { label: 'System Status', value: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: CheckCircle },
                  ].map((card) => (
                    <div key={card.label} className={card.bg + ' border border-slate-800/60 rounded-2xl p-4 flex flex-col'}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-slate-500">
                        <card.icon className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{card.label}</p>
                      <span className={`text-lg font-bold ${card.color}`}>{card.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-white">Superadmin Actions</h4>
                    <button
                      onClick={() => {}}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh Data
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-800/40">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">Superadmin account</p>
                          <p className="text-[10px] text-slate-500 font-mono">{userEmail}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                        Verified
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-800/40">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">AI Admin Command</p>
                          <p className="text-[10px] text-slate-500">Update fuel, tolls, incidents via natural language</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'users' && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">Registered Users</h4>
                <div className="bg-slate-900 border border-slate-800/60 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950/50 border-b border-slate-800/60">
                      <tr>
                        <th className="px-4 py-3 text-slate-400 font-medium">Email</th>
                        <th className="px-4 py-3 text-slate-400 font-medium">Role</th>
                        <th className="px-4 py-3 text-slate-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-800/40 hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-slate-200 font-medium">{userEmail}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-rose-900/30 text-rose-400 text-[9px] font-bold border border-rose-500/30">
                            Super Admin
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500">Only the superadmin ({userEmail}) appears here. Other users sign in with Google but have no admin privileges.</p>
              </div>
            )}

            {activeSection === 'settings' && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">System Settings</h4>
                <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 space-y-4">
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/40">
                    <p className="text-sm font-medium text-slate-200 mb-1">Authorized Domain</p>
                    <p className="text-[10px] text-slate-500 font-mono break-all">merosadak.web.app</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/40">
                    <p className="text-sm font-medium text-slate-200 mb-1">App Version</p>
                    <p className="text-[10px] text-slate-500 font-mono">v2.4.0</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/40">
                    <p className="text-sm font-medium text-slate-200 mb-1">Worker</p>
                    <p className="text-[10px] text-slate-500 font-mono">merosadak.banjays.workers.dev</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-800/40 bg-slate-900/40 px-6 py-3 text-[10px] text-slate-500">
          Mero Sadak Super Admin • {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};
