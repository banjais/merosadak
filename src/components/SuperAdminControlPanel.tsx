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
  ChevronRight,
  User,
  Database,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PanelSettings } from './PanelSettings';

interface SuperAdminPanelProps {
  userEmail: string;
  onClose: () => void;
}

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({
  userEmail,
  onClose,
}) => {
  const { setUserRole, userRoles } = useAuth();
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'analytics' | 'admin-command' | 'datasources' | 'settings'>('dashboard');

  const sections = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users' as const, label: 'User Control', icon: Users },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'admin-command' as const, label: 'Data Input', icon: Sparkles },
    { id: 'datasources' as const, label: 'Data Sources', icon: Database },
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
              <h4 className="text-sm font-bold text-white">User Control</h4>
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
                    <span className="text-lg font-bold text-white mt-1">{card.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'admin-command' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white">Data Input — AI Admin Command</h4>
              <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5">
                <p className="text-[10px] text-slate-400 font-mono mb-3">
                  Tell the AI what data to update. It parses your instruction and applies it to live KV data.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Command</label>
                    <textarea
                      value=""
                      onChange={() => {}}
                      rows={3}
                      placeholder="e.g. Update diesel price to 198 rupees per liter"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled"
                      disabled
                    />
                    <p className="text-[9px] text-slate-500 mt-1">Open Admin Command panel from header profile for full command input.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Examples</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Set petrol price to 200 rupees per liter',
                        'Add a landslide on NH04 near Nagdhunga',
                        'Update Nagdhunga tunnel toll to 70 rupees for cars',
                      ].map((ex) => (
                        <span key={ex} className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {}}
                  className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/20 disabled:opacity-50 transition flex items-center justify-center space-x-2 disabled"
                >
                  <SendIcon className="w-4 h-4" />
                  <span>Execute AI Command (open header panel)</span>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'datasources' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white">Data Sources & Certification</h4>
              <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-sm font-bold text-white">Unofficial Statement Based on SNH 2022/23</p>
                    <p className="text-[10px] text-slate-500 font-mono">DoR HMIS-ICT Unit • June 2024</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Document</p>
                    <p className="text-xs text-slate-400">Statistics of National Highway (SNH) 2022/23</p>
                    <p className="text-[10px] font-medium text-white mt-1">Department of Roads (DoR), Nepal</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Coverage</p>
                    <p className="text-xs text-slate-400">99.2% of road-link length measured</p>
                    <p className="text-[10px] font-medium text-emerald-400 mt-1">Tier A — DoR Certified</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <p className="text-[10px] text-amber-400/80">
                    This is a 2022/23 snapshot. It does not reflect live road conditions. For a DoR-certified
                    certificate, submit this data to the HMIS-ICT Unit, DoR for sign-off.
                  </p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4 mt-2">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Available Data Files</h5>
                <div className="space-y-2">
                  {[
                    { name: 'provenance.json', desc: 'Data provenance & certification', size: '2.4 KB' },
                    { name: 'cities-and-junctions.json', desc: 'City & junction coordinates', size: '45.2 KB' },
                    { name: 'highway-coords.json', desc: 'Highway route geometries', size: '180 KB' },
                    { name: 'blackspots.json', desc: 'Accident blackspot locations', size: '12.8 KB' },
                    { name: 'calculator-cities.json', desc: 'Distance calculator cities', size: '38.6 KB' },
                  ].map((f) => (
                    <div key={f.name} className="flex items-center justify-between px-3 py-2 bg-slate-950/40 rounded-lg border border-slate-800/40">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3 h-3 text-slate-500" />
                        <span className="text-xs font-medium text-slate-300 truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>{f.desc}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">{f.size}</span>
                      </div>
                    </div>
                  ))}
                </div>
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
                <PanelSettings className="mt-3" />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Minimal Send icon fallback
function SendIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
