import React from 'react';
import {
  User,
  Mail,
  ShieldAlert,
  Sparkles,
  Activity,
  LogOut,
  ChevronRight,
  Settings,
} from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Profile Panel */}
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden animate-fadeIn flex flex-col h-[70vh] sm:h-[80vh] max-h-[620px]">
        {/* Header */}
        <div className="bg-slate-800/80 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent-bg accent-border flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-black/40 border border-slate-700/50">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt="Profile"
                  className="w-full h-full rounded-2xl object-cover border border-slate-700/50"
                />
              ) : (
                userEmail ? userEmail[0].toUpperCase() : 'U'
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{userEmail}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">
                {shortName}
              </p>
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
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40 custom-scrollbar space-y-6">
          {/* Account Card */}
          <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-accent-bg accent-border flex items-center justify-center text-accent-text">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Account</p>
                <p className="text-[10px] text-slate-500 font-mono">{userEmail}</p>
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

          {/* Actions */}
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
              onClick={() => { onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition border border-slate-800/60 rounded-xl"
            >
              <Settings className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-medium">Settings</span>
              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0 ml-auto" />
            </button>
            <button
              onClick={() => { onClose(); onSignOut(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-900/20 transition border border-slate-800/60 rounded-xl"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/40 bg-slate-900/40 px-6 py-3 text-[10px] text-slate-500 text-center">
          Mero Sadak • Profile
        </div>
      </div>
    </div>
  );
};
