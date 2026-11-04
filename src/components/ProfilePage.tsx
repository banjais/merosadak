import React, { useEffect, useState } from 'react';
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
  ClipboardList,
  X,
} from 'lucide-react';
import { PanelSettings } from './PanelSettings';
import { ReportingSection } from './ReportingSection';

interface ProfilePageProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userRole: 'superadmin' | 'OfficeAdmin' | 'GeneralUser';
  isSuperAdmin: boolean;
  photoURL?: string | null;
  /** Display name (falls back to email user handle). */
  displayName?: string | null;
  onSignOut: () => void;
  onAdminCommand?: () => void;
  onSuperAdminPanel?: () => void;
  onOpenOfficeAdminPanel?: () => void;
  /** Opens the shared hazard-report modal (General User Reporting CTA). */
  onOpenReportModal?: () => void;
}

type SectionId = 'account' | 'reports' | 'settings' | 'admin';

interface Section {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When true, the section is only shown to roles in `roles`. */
  roles?: Array<'superadmin' | 'OfficeAdmin' | 'GeneralUser'>;
  /** When true, also requires isSuperAdmin. */
  requiresSuperAdmin?: boolean;
}

/**
 * Full-page profile & settings control panel.
 *
 * Two entry points open this same panel:
 *  - the round avatar in the top-right app header
 *  - the signed-in user button at the bottom of the left AppDrawer
 *
 * Sections (left sidebar) switch the main content area:
 *   • My Account — identity card (avatar, email, role, app version)
 *   • Settings   — theme, accent, text scale (via PanelSettings)
 *   • Admin      — role-gated: super-admin control panel, AI admin command,
 *                  office admin panel. Hidden entirely for GeneralUser so
 *                  the panel stays clean for non-admins.
 *
 * Logout lives in the top bar (always visible) and at the bottom of the
 * My Account section, so users can sign out without scrolling.
 */
export const ProfilePage: React.FC<ProfilePageProps> = ({
  isOpen,
  onClose,
  userEmail,
  userRole,
  isSuperAdmin,
  photoURL,
  displayName,
  onSignOut,
  onAdminCommand,
  onSuperAdminPanel,
  onOpenOfficeAdminPanel,
  onOpenReportModal,
}) => {
  const [section, setSection] = useState<SectionId>('account');

  // Reset to My Account each time the panel reopens — opening the panel from
  // the header should never show stale "admin" content from a previous open.
  useEffect(() => {
    if (isOpen) setSection('account');
  }, [isOpen]);

  if (!isOpen) return null;

  const displayNameClean =
    (displayName && displayName.trim()) ||
    (userEmail ? userEmail.split('@')[0] : 'User');
  const initial = displayNameClean[0]?.toUpperCase() ?? 'U';

  const roleLabel =
    userRole === 'superadmin'
      ? 'Super Admin'
      : userRole === 'OfficeAdmin'
        ? 'Office Admin'
        : 'General User';

  const roleBadgeClasses =
    userRole === 'superadmin'
      ? 'bg-rose-900/30 text-rose-300 border-rose-500/40'
      : userRole === 'OfficeAdmin'
        ? 'bg-cyan-900/30 text-cyan-300 border-cyan-500/40'
        : 'bg-slate-800/60 text-slate-300 border-slate-700/60';

  // Sections shown in the sidebar. The Admin section is gated by role:
  // SuperAdmin and OfficeAdmin see it; GeneralUser does not.
  const sections: Section[] = [
    { id: 'account', label: 'My Account', icon: LayoutDashboard },
  ];
  // GeneralUser gets its reporting surface right here — admins have the
  // Reporting section inside their own dedicated panels.
  if (userRole === 'GeneralUser') {
    sections.push({ id: 'reports', label: 'Reporting', icon: ClipboardList });
  }
  sections.push({ id: 'settings', label: 'Settings', icon: Settings });
  if (userRole !== 'GeneralUser') {
    sections.push({
      id: 'admin',
      label: 'Admin Tools',
      icon: ShieldAlert,
    });
  }

  // Role-gated admin actions. Each entry maps to a callback prop.
  const adminActions: Array<{
    id: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: 'rose' | 'cyan';
    visible: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'super-admin',
      label: 'Super Admin Control Panel',
      description: 'System-wide admin controls — users, data, roles.',
      icon: ShieldAlert,
      tone: 'rose',
      visible: !!(userRole === 'superadmin' || isSuperAdmin) && !!onSuperAdminPanel,
      onClick: () => {
        onClose();
        onSuperAdminPanel?.();
      },
    },
    {
      id: 'admin-command',
      label: 'AI Admin Command',
      description: 'Update fuel, tolls and incidents via AI prompts.',
      icon: Sparkles,
      tone: 'cyan',
      visible: !!(isSuperAdmin) && !!onAdminCommand,
      onClick: () => {
        onClose();
        onAdminCommand?.();
      },
    },
    {
      id: 'office-admin',
      label: 'Office Admin Panel',
      description: 'Office-level administration for your assigned region.',
      icon: Activity,
      tone: 'cyan',
      visible: userRole === 'OfficeAdmin' && !!onOpenOfficeAdminPanel,
      onClick: () => {
        onClose();
        onOpenOfficeAdminPanel?.();
      },
    },
  ];
  const visibleAdminActions = adminActions.filter((a) => a.visible);

  return (
    <div className="fixed inset-0 z-[600] flex flex-col bg-slate-950 text-slate-100 animate-fadeIn">
      {/* Top bar — back/close on left, identity center, sign-out right */}
      <header className="bg-slate-900/95 border-b border-slate-700/60 px-3 sm:px-5 py-3 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0"
            aria-label="Close profile"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Round avatar — same round motif as the header / FAB family */}
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-slate-600/60 ring-1 ring-slate-700/40 shrink-0">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover bg-slate-800" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-sm font-black text-white">
                  {initial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate font-display tracking-tight">
                {displayNameClean}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]">
                {userEmail || 'Signed in'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full border ${roleBadgeClasses}`}>
            {roleLabel}
          </span>
          <button
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-900/20 text-rose-300 border border-rose-500/30 hover:bg-rose-900/40 hover:text-rose-200 transition text-sm font-bold"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 sm:w-64 bg-slate-900/50 border-r border-slate-800 shrink-0 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Sections
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {sections.map((s) => {
              const isActive = section === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition rounded-xl ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600/20 to-cyan-600/15 text-white border border-emerald-500/30'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : ''}`}
                  />
                  <span>{s.label}</span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 ml-auto text-emerald-400/60" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer card — identity summary + sign-out (mobile-friendly duplicate) */}
          <div className="p-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{roleLabel}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  {userEmail || 'Signed in'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="sm:hidden w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-900/20 text-rose-300 border border-rose-500/30 text-xs font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-slate-950/40 custom-scrollbar p-4 sm:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {section === 'account' && (
              <>
                {/* Identity card */}
                <section className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center gap-4">
                    {/* Round avatar (larger version) */}
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600/60 ring-2 ring-slate-700/40 shrink-0 shadow-lg shadow-black/30">
                      {photoURL ? (
                        <img src={photoURL} alt="Profile" className="w-full h-full object-cover bg-slate-800" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-2xl font-black text-white">
                          {initial}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-white truncate">{displayNameClean}</h3>
                      <p className="text-xs text-slate-400 font-mono truncate">{userEmail || 'Signed in'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${roleBadgeClasses}`}>
                          {roleLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">Mero Sadak v2.4.0</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Quick links */}
                <section className="bg-slate-900 border border-slate-800/60 rounded-2xl p-3 sm:p-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-1 pb-2">
                    Quick actions
                  </h4>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setSection('settings')}
                      className="w-full flex items-center gap-3 px-3 py-3 text-sm text-slate-200 hover:bg-slate-800/60 hover:text-white transition rounded-xl"
                    >
                      <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium flex-1 text-left">Open Settings</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    </button>
                    {userRole !== 'GeneralUser' && (
                      <button
                        onClick={() => setSection('admin')}
                        className="w-full flex items-center gap-3 px-3 py-3 text-sm text-slate-200 hover:bg-slate-800/60 hover:text-white transition rounded-xl"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="font-medium flex-1 text-left">Open Admin Tools</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onClose();
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 text-sm text-rose-400 hover:bg-rose-900/20 hover:text-rose-300 transition rounded-xl"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span className="font-medium flex-1 text-left">Sign Out</span>
                      <ChevronRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    </button>
                  </div>
                </section>
              </>
            )}

            {section === 'reports' && (
              <ReportingSection
                variant="general"
                onSubmitReport={() => {
                  onClose();
                  onOpenReportModal?.();
                }}
              />
            )}

            {section === 'settings' && (
              <section className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <Settings className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Settings</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Theme, accent colour and text scale. Changes apply immediately
                  and are saved to this browser.
                </p>
                <PanelSettings />
              </section>
            )}

            {section === 'admin' && (
              <section className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <h3 className="text-base font-bold text-white">Admin Tools</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Tools available to your role. Each opens its own dedicated
                  panel — return here any time via the header avatar or the
                  drawer profile button.
                </p>
                {visibleAdminActions.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-800/40 p-6 text-center text-sm text-slate-400">
                    <User className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    No admin tools available for your role.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleAdminActions.map((a) => {
                      const Icon = a.icon;
                      const toneClasses =
                        a.tone === 'rose'
                          ? 'text-rose-300 hover:bg-rose-900/20 hover:text-rose-200 border-slate-800/60'
                          : 'text-cyan-300 hover:bg-cyan-900/20 hover:text-cyan-200 border-slate-800/60';
                      const iconBg =
                        a.tone === 'rose'
                          ? 'bg-rose-900/30 border-rose-500/40 text-rose-300'
                          : 'bg-cyan-900/30 border-cyan-500/40 text-cyan-300';
                      return (
                        <button
                          key={a.id}
                          onClick={a.onClick}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-sm transition border rounded-xl ${toneClasses}`}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${iconBg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-bold text-white truncate">{a.label}</p>
                            <p className="text-[11px] text-slate-400 truncate">{a.description}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;
