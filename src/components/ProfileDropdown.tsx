import React, { useState } from 'react';
import {
  User,
  Mail,
  Settings,
  ShieldAlert,
  Sparkles,
  LogOut,
  Activity,
  ChevronRight,
} from 'lucide-react';

interface ProfileDropdownProps {
  anchorRef: React.RefObject<HTMLDivElement>;
  userEmail: string;
  userRole: 'superadmin' | 'OfficeAdmin' | 'GeneralUser';
  isSuperAdmin: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onAdminCommand?: () => void;
  onSuperAdminPanel?: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  anchorRef,
  userEmail,
  userRole,
  isSuperAdmin,
  onClose,
  onSignOut,
  onAdminCommand,
  onSuperAdminPanel,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);

  const close = () => {
    setIsOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="relative z-[600]">
      <div
        className="fixed inset-0 z-[599]"
        onClick={close}
        aria-hidden="true"
      />
      <div
        className="absolute right-0 mt-2 w-72 max-w-[92vw] bg-slate-950/98 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden backdrop-blur-md animate-fadeIn"
        ref={anchorRef as React.RefObject<HTMLDivElement>}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-accent-bg accent-border flex items-center justify-center text-slate-950 font-black text-sm">
              {(userEmail || 'U')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-white truncate">{userEmail}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">
                {userRole === 'superadmin'
                  ? 'Super Administrator'
                  : userRole === 'OfficeAdmin'
                    ? 'Office Administrator'
                    : 'General User'}
              </p>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="py-1 space-y-0.5">
          {/* Account */}
          <button
            onClick={close}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition border-b border-slate-800/40"
          >
            <User className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="font-medium">My Profile</span>
          </button>

          {userRole === 'OfficeAdmin' && (
            <button
              onClick={close}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition border-b border-slate-800/40"
            >
              <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-medium text-cyan-300">Office Admin Dashboard</span>
              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0 ml-auto" />
            </button>
          )}

          {userRole === 'superadmin' && onSuperAdminPanel && (
            <button
              onClick={() => { onSuperAdminPanel(); close(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-rose-900/20 hover:text-rose-300 transition border-b border-slate-800/40"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium text-rose-300">Super Admin Control Panel</span>
              <ChevronRight className="w-3 h-3 text-rose-600 shrink-0 ml-auto" />
            </button>
          )}

          {isSuperAdmin && onAdminCommand && (
            <button
              onClick={() => { onAdminCommand(); close(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-cyan-900/20 hover:text-cyan-300 transition border-b border-slate-800/40"
            >
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-medium text-cyan-300">AI Admin Command</span>
              <ChevronRight className="w-3 h-3 text-cyan-600 shrink-0 ml-auto" />
            </button>
          )}

          {/* Settings */}
          <button
            onClick={close}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition border-b border-slate-800/40"
          >
            <Settings className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="font-medium">Settings</span>
            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0 ml-auto" />
          </button>

          {/* Sign out */}
          <button
            onClick={() => { onSignOut(); close(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-900/20 transition border-b border-slate-800/40"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/40 bg-slate-900/40 px-4 py-2 text-[10px] text-slate-500 text-center">
          Mero Sadak v2.4.0
        </div>
      </div>
    </div>
  );
};
