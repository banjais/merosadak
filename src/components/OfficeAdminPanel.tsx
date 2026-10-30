import React, { useState } from 'react';
import {
  ShieldAlert,
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
import { PanelSettings } from './PanelSettings';

interface OfficeAdminPanelProps {
  userEmail: string;
  onClose: () => void;
}

export const OfficeAdminPanel: React.FC<OfficeAdminPanelProps> = ({
  userEmail,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<'admin-command' | 'datasources' | 'settings'>('admin-command');

  const sections = [
    { id: 'admin-command' as const, label: 'Data Input', icon: Sparkles },
    { id: 'datasources' as const, label: 'Data Sources', icon: Database },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-[700] flex flex-col bg-slate-950 text-slate-100">
      {/* Backdrop dim */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      {/* Top bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display tracking-tight">Office Admin Panel</h3>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-900/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-900/40 hover:text-cyan-300 transition text-sm font-medium"
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
            <p className="text-[10px] text-slate-500 font-mono">Office Admin • Mero Sadak v2.4.0</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-slate-950/40 custom-scrollbar p-6 lg:p-8">
          {activeSection === 'admin-command' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white">Data Input — AI Admin Command</h4>
              <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5">
                <p className="text-[10px] text-slate-400 font-mono mb-3">
                  Update fuel prices, tolls, incidents, and road data via natural language commands.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Command</label>
                    <textarea
                      value=""
                      onChange={() => {}}
                      rows={3}
                      placeholder="e.g. Update diesel price to 198 rupees per liter"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled"
                      disabled
                    />
                    <p className="text-[9px] text-slate-500 mt-1">Open AI Admin Command from header profile panel for full command input.</p>
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
                  className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition flex items-center justify-center space-x-2 disabled"
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
              <h4 className="text-sm font-bold text-white">Display Settings</h4>
              <PanelSettings className="mt-2" />
              <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4">
                <p className="text-[10px] text-slate-500 font-mono">
                  Theme, text size and accent color apply across the whole app and are saved to your device.
                </p>
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
