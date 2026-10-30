import React from 'react';
import {
  User,
  ShieldAlert,
  Sparkles,
  Activity,
  LogOut,
  ChevronRight,
  Settings,
  Mail,
  LayoutDashboard,
  BarChart3,
} from 'lucide-react';
import { PanelSettings } from './PanelSettings';

interface ProfilePageProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userRole: 'superadmin' | 'OfficeAdmin' | 'GeneralUser';
  isSuperAdmin: boolean;
  photoURL?: string | null;
  onSignOut: () => void;
  onAdminCommand?: () => void;
  onSuperAdminPanel?: () => void;
  onOpenOfficeAdminPanel?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  isOpen,
  onClose,
  userEmail,
  userRole,
  isSuperAdmin,
  photoURL,
  onSignOut,
  onAdminCommand,
  onSuperAdminPanel,
  onOpenOfficeAdminPanel,
}) => {
  if (!isOpen) return null;

  const shortName = userEmail ? userEmail.split('@')[0] : 'User';

  const sections = [
    { id: 'account', label: 'My Account', icon: LayoutDashboard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-[600] flex flex-col bg-slate-950 text-slate-100">
      {/* Backdrop dim */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Top bar */}
      <header className="bg-slate-900 border-b border-slate-700/60 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-accent-bg accent-border flex items-center justify-center text-slate-950 font-black text-lg shadow-md border border-slate-700/50">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-full h-full rounded-2xl object-cover border border-slate-700/50" />
            ) : (
              userEmail ? userEmail[0].toUpperCase() : 'U'
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display tracking-tight">My Profile</h3>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition text-sm font-medium"
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); onSignOut(); }}
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
                onClick={() => {}}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-white`}
              >
                <section.icon className="w-4 h-4 shrink-0" />
                <span>{section.label}</span>
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-accent-bg accent-border flex items-center justify-center text-accent-text">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{userRole === 'superadmin' ? 'Super Admin' : userRole === 'OfficeAdmin' ? 'Office Admin' : 'General User'}</p>
                <p className="text-[10px] text-slate-500 font-mono">{userEmail}</p>
              </div>
            </div>
            <div className="px-2">
              <button
                onClick={() => { onClose(); onSuperAdminPanel(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition rounded-lg ${
                  userRole === 'superadmin'
                    ? 'bg-accent-bg text-slate-950 border-r-2 border-accent-border shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Super Admin Control Panel</span>
              </button>
              {userRole === 'OfficeAdmin' && (
                <button
                  onClick={() => { onClose(); onOpenOfficeAdminPanel(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition text-cyan-300 hover:text-cyan-400"
                >
                  <Activity className="w-4 h-4 shrink-0" />
                  <span>Office Admin Panel</span>
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => { onClose(); onAdminCommand(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition text-cyan-300 hover:text-cyan-400"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>AI Admin Command</span>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-slate-950/40 custom-scrollbar p-6 lg:p-8">
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-accent-bg accent-border flex items-center justify-center text-slate-950 font-black text-lg shadow-sm border border-slate-700/50">
                    {photoURL ? (
                      <img src={photoURL} alt="Profile" className="w-full h-full rounded-2xl object-cover border border-slate-700/50" />
                    ) : (
                      userEmail ? userEmail[0].toUpperCase() : 'U'
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white truncate">{userEmail}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{shortName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800/40 pt-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      userRole === 'superadmin'
                        ? 'bg-rose-900/30 text-rose-400 border-rose-500/30'
                        : userRole === 'OfficeAdmin'
                          ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30'
                          : 'bg-slate-800/50 text-slate-300 border-slate-700/50'
                    }`}>
                      {userRole === 'superadmin' ? 'Super Admin' : userRole === 'OfficeAdmin' ? 'Office Admin' : 'General User'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">App</p>
                    <span className="text-xs font-mono text-slate-400">Mero Sadak v2.4.0</span>
                  </div>
                </div>
                </div>
              </div>

              <PanelSettings className="mt-2" />

              <div className="space-y-2">
                {isSuperAdmin && onSuperAdminPanel && (
                <button
                  onClick={() => { onClose(); onSuperAdminPanel(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-rose-900/20 hover:text-rose-300 transition border border-slate-800/60 rounded-xl"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-medium">Super Admin Control Panel</span>
                  <ChevronRight className="w-3 h-3 text-rose-600 shrink-0 ml-auto" />
                </button>
              )}
              {isSuperAdmin && onAdminCommand && (
                <button
                  onClick={() => { onClose(); onAdminCommand(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-cyan-900/20 hover:text-cyan-300 transition border border-slate-800/60 rounded-xl"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-medium">AI Admin Command</span>
                  <ChevronRight className="w-3 h-3 text-cyan-600 shrink-0 ml-auto" />
                </button>
              )}
              {userRole === 'OfficeAdmin' && onOpenOfficeAdminPanel && (
                <button
                  onClick={() => { onClose(); onOpenOfficeAdminPanel(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-cyan-900/20 hover:text-cyan-300 transition border border-slate-800/60 rounded-xl"
                >
                  <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-medium text-cyan-300">Office Admin Panel</span>
                  <ChevronRight className="w-3 h-3 text-cyan-600 shrink-0 ml-auto" />
                </button>
              )}
              <button
                onClick={() => { onClose(); onSignOut(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-900/20 transition border border-slate-800/60 rounded-xl"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/40 bg-slate-900/40 px-4 py-2 text-[10px] text-slate-500 text-center shrink-0">
        Mero Sadak • Profile
      </div>
    </div>
  );
};
