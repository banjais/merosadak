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
  Activity,
  Sparkles,
  ChevronDown,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SuperAdminPanelProps {
  userEmail: string;
  onClose: () => void;
}

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({
  userEmail,
  onClose,
}) => {
  const { setUserRole, userRoles } = useAuth();
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'analytics' | 'settings'>('dashboard');

  const sections = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'settings' as const, label: 'System Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-[700] flex flex-col bg-slate-950 text-slate-100">
      {/* Backdrop dim */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      {/* Top bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shadow-md shadow-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display tracking-tight">Super Admin Control Panel</h3>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition text-sm font-medium"
          >
            Close Panel
          </button>
          <button
            onClick={() => {}}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-900/20 text-rose-400 border border-rose-500/30 hover:bg-rose-900/40 hover:text-rose-300 transition text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900/50 border-r border-slate-800 shrink-0 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sections</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition rounded-lg ${
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
          <div className="p-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 font-mono">Mero Sadak v2.4.0</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-slate-950/40 custom-scrollbar p-6 lg:p-8">
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Active Incidents', value: '0', color: 'text-rose-400', bg: 'bg-rose-900/20', icon: AlertTriangle },
                  { label: 'Signed-in Users', value: '1', color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: Users },
                  { label: 'Live Feeds', value: 'Online', color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: BarChart3 },
                  { label: 'System Status', value: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: CheckCircle },
                ].map((card) => (
                  <div key={card.label} className={card.bg + ' border border-slate-800/60 rounded-2xl p-5 flex flex-col'}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-slate-500">
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
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Superadmin account</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{userEmail}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      Verified
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
                        <Sparkles className="w-5 h-5" />
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
                        <th className="px-4 py-3 text-slate-400 font-medium text-right">Change Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { email: userEmail, role: 'superadmin' as const },
                        ...Object.entries(userRoles).map(([email, role]) => ({ email, role })),
                      ].filter((u, i, arr) => arr.findIndex((x) => x.email === u.email) === i).map((u) => (
                        <tr
                          key={u.email}
                          className="border-t border-slate-800/40 hover:bg-slate-800/30 transition"
                        >
                          <td className="px-4 py-3 text-slate-200 font-medium truncate max-w-xs">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              u.role === 'superadmin'
                                ? 'bg-rose-900/30 text-rose-400 border-rose-500/30'
                                : u.role === 'OfficeAdmin'
                                  ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30'
                                  : 'bg-slate-800/50 text-slate-300 border-slate-700/50'
                            }`}>
                              {u.role === 'superadmin' ? 'Super Admin' : u.role === 'OfficeAdmin' ? 'Office Admin' : 'General User'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <select
                              value={u.role}
                              onChange={(e) => setUserRole(u.email, e.target.value as 'superadmin' | 'OfficeAdmin' | 'GeneralUser')}
                              className="bg-slate-800 border border-slate-700 text-[10px] text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-accent-text"
                            >
                              <option value="GeneralUser">General User</option>
                              <option value="OfficeAdmin">Office Admin</option>
                              {u.email === userEmail ? (
                                <option value="superadmin" disabled>Super Admin (self)</option>
                              ) : (
                                <option value="superadmin">Super Admin</option>
                              )}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500">
                  Select a role from the dropdown to promote or demote a user. Changes persist to Firestore and apply at their next sign-in.
                </p>
              </div>
            )}

          {activeSection === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Routes Planned Today', value: '0', delta: '+0%', color: 'text-cyan-400', icon: Activity },
                  { label: 'Reports Submitted', value: '0', delta: '+0%', color: 'text-amber-400', icon: AlertTriangle },
                  { label: 'AI Commands Run', value: '0', delta: '+0%', color: 'text-emerald-400', icon: Sparkles },
                ].map((card) => (
                  <div key={card.label} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500">
                        <card.icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${card.color} bg-${card.color === 'text-cyan-400' ? 'cyan' : card.color === 'text-amber-400' ? 'amber' : 'emerald'}-900/20`}>
                        {card.delta}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-3">{card.label}</p>
                    <span className="text-2xl font-bold text-white mt-1">{card.value}</span>
                  </div>
                ))}
              </div>
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
        </main>
      </div>
    </div>
  );
};
