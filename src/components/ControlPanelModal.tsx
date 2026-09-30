import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, FileSpreadsheet, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUPER_ADMIN_EMAIL, type AccessAnalytics, type AccessRole, type OfficeAdmin, type SheetRoadEntry } from '../../shared/accessControl';
import { fetchAccessAnalytics, fetchOfficeAdmins, submitRoadEntry, updateOfficeAdmin } from '../utils/accessControlApi';

interface ControlPanelModalProps {
  onClose: () => void;
  onSignIn: () => void;
}

const roleDescriptions: Record<AccessRole, string> = {
  SuperAdmin: 'Full access control. You can appoint or remove OfficeAdmin accounts.',
  OfficeAdmin: 'Office account. You can view account analytics and submit road information to Mero Sadak’s Google Sheet.',
  GeneralUser: 'Standard account. Sign in to use Mero Sadak with your Google account.',
};

const emptyRoadEntry: SheetRoadEntry = {
  highwayCode: '',
  highwayName: '',
  district: '',
  location: '',
  status: '',
  notes: '',
};

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const apiError = error as Error & { data?: { error?: string } };
    return apiError.data?.error || apiError.message;
  }
  return 'The request could not be completed. Please try again.';
}

export const ControlPanelModal: React.FC<ControlPanelModalProps> = ({ onClose, onSignIn }) => {
  const { user, accessProfile, accessLoading, accessError, refreshAccessProfile } = useAuth();
  const [officeAdmins, setOfficeAdmins] = useState<OfficeAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AccessAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [roadEntry, setRoadEntry] = useState<SheetRoadEntry>(emptyRoadEntry);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetNotice, setSheetNotice] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOfficeAdmins = useCallback(async () => {
    if (!user || accessProfile?.role !== 'SuperAdmin') return;
    setAdminsLoading(true);
    setPanelError('');
    try {
      setOfficeAdmins(await fetchOfficeAdmins(user));
    } catch (error) {
      setPanelError(errorMessage(error));
    } finally {
      setAdminsLoading(false);
    }
  }, [user, accessProfile?.role]);

  useEffect(() => {
    void loadOfficeAdmins();
  }, [loadOfficeAdmins]);

  const isAdministrator = accessProfile?.role === 'SuperAdmin' || accessProfile?.role === 'OfficeAdmin';

  const loadAnalytics = useCallback(async () => {
    if (!user || !isAdministrator) return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      setAnalytics(await fetchAccessAnalytics(user));
    } catch (error) {
      setAnalyticsError(errorMessage(error));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user, isAdministrator]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const handleSheetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSheetSaving(true);
    setSheetError('');
    setSheetNotice('');
    try {
      const receipt = await submitRoadEntry(user, roadEntry);
      setSheetNotice(`Entry submitted to ${receipt.sheetName} at ${new Date(receipt.submittedAt).toLocaleString()}.`);
      setRoadEntry(emptyRoadEntry);
    } catch (error) {
      setSheetError(errorMessage(error));
    } finally {
      setSheetSaving(false);
    }
  };

  const updateAdmin = async (action: 'add' | 'remove', targetEmail: string) => {
    if (!user) return;
    setSaving(true);
    setPanelError('');
    setNotice('');
    try {
      setOfficeAdmins(await updateOfficeAdmin(user, action, targetEmail));
      setEmail('');
      setNotice(action === 'add' ? `${targetEmail.trim()} is now an OfficeAdmin.` : `${targetEmail} no longer has OfficeAdmin access.`);
    } catch (error) {
      setPanelError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const addAdmin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) void updateAdmin('add', normalizedEmail);
  };

  const isSuperAdmin = accessProfile?.role === 'SuperAdmin';
  const maxDailyUsers = Math.max(1, ...(analytics?.daily.map((day) => day.total) ?? [0]));
  const roleIcon = accessProfile?.role === 'SuperAdmin'
    ? <ShieldCheck className="h-5 w-5" />
    : accessProfile?.role === 'OfficeAdmin'
      ? <UsersRound className="h-5 w-5" />
      : <UserRound className="h-5 w-5" />;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="control-panel-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">Mero Sadak</p>
            <h2 id="control-panel-title" className="mt-1 text-xl font-black text-white">Control Panel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close control panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user ? (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-white">Sign in to view your access level</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">Any verified Google account can sign in. SuperAdmin and OfficeAdmin access is assigned separately.</p>
            <button type="button" onClick={onSignIn} className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400">
              Sign in with Google
            </button>
          </div>
        ) : accessLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Checking account access…
          </div>
        ) : accessError ? (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-950/30 p-4">
            <p className="text-sm font-semibold text-rose-200">Could not verify your access level</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-200/80">{accessError}</p>
            <button type="button" onClick={() => void refreshAccessProfile()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900/40">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : accessProfile ? (
          <>
            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">{roleIcon}</div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Access level</p>
                  <p className="text-base font-black text-white">{accessProfile.role}</p>
                </div>
              </div>
              <p className="mt-3 break-all text-xs text-slate-300">{user.email}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{roleDescriptions[accessProfile.role]}</p>
            </div>

            {isAdministrator && (
              <section className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><BarChart3 className="h-4 w-4 text-cyan-300" /> Google sign-in analytics</h3>
                    <p className="mt-1 text-[11px] text-slate-400">Unique accounts active in the last 30 days.</p>
                  </div>
                  <button type="button" onClick={() => void loadAnalytics()} disabled={analyticsLoading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50" aria-label="Refresh account analytics">
                    <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {analyticsLoading && !analytics ? (
                  <p className="py-5 text-center text-xs text-slate-500">Loading account analytics…</p>
                ) : analyticsError ? (
                  <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{analyticsError}</p>
                ) : analytics ? (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        ['Unique accounts', analytics.uniqueAccounts],
                        ['GeneralUser', analytics.generalUsers],
                        ['OfficeAdmin', analytics.officeAdmins],
                        ['SuperAdmin', analytics.superAdmins],
                      ].map(([label, count]) => (
                        <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                          <p className="mt-1 text-xl font-black text-white">{count}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Daily active accounts · last 7 days</p>
                      <div className="space-y-1.5">
                        {analytics.daily.slice(-7).map((day) => (
                          <div key={day.date} className="flex items-center gap-2 text-[10px]">
                            <span className="w-20 shrink-0 text-slate-400">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                              <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${(day.total / maxDailyUsers) * 100}%` }} />
                            </div>
                            <span className="w-7 text-right font-semibold text-slate-300">{day.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-slate-500">{analytics.note}</p>
                  </>
                ) : null}
              </section>
            )}

            {isAdministrator && (
              <section className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white"><FileSpreadsheet className="h-4 w-4 text-emerald-300" /> Submit road information</h3>
                  <p className="mt-1 text-[11px] text-slate-400">Entries are sent to the configured Mero Sadak Google Sheet, not the public DoR source sheet.</p>
                </div>
                {!accessProfile.sheetEntryEnabled && (
                  <p role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
                    Google Sheets is not configured yet. A project maintainer must deploy the receiver and set its Worker secrets before entries can be submitted.
                  </p>
                )}
                <form onSubmit={handleSheetSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([
                    ['highwayCode', 'Highway code', 'e.g. NH10'],
                    ['highwayName', 'Highway name', 'e.g. Siddhartha Highway'],
                    ['district', 'District', 'District name'],
                    ['location', 'Location', 'Place or road section'],
                  ] as const).map(([field, label, placeholder]) => (
                    <label key={field} className="block">
                      <span className="mb-1 block text-[10px] font-semibold text-slate-300">{label}</span>
                      <input
                        required
                        maxLength={500}
                        value={roadEntry[field]}
                        onChange={(event) => setRoadEntry((current) => ({ ...current, [field]: event.target.value }))}
                        placeholder={placeholder}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                      />
                    </label>
                  ))}
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-300">Status</span>
                    <select
                      required
                      value={roadEntry.status}
                      onChange={(event) => setRoadEntry((current) => ({ ...current, status: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                    >
                      <option value="" disabled>Select status</option>
                      <option>Open</option>
                      <option>Caution</option>
                      <option>Closed</option>
                      <option>Repair work</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-300">Details / remarks</span>
                    <textarea
                      required
                      maxLength={500}
                      rows={3}
                      value={roadEntry.notes}
                      onChange={(event) => setRoadEntry((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Describe the road update or observation"
                      className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                    <p className="text-[10px] text-slate-500">Submitted with your signed-in account and role.</p>
                    <button type="submit" disabled={sheetSaving || !accessProfile.sheetEntryEnabled} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50">
                      {sheetSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                      Submit entry
                    </button>
                  </div>
                </form>
                {sheetError && <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{sheetError}</p>}
                {sheetNotice && <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{sheetNotice}</p>}
              </section>
            )}

            {isSuperAdmin && (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Office administrators</h3>
                    <p className="mt-1 text-[11px] text-slate-400">Add a Google account by email to grant OfficeAdmin access.</p>
                  </div>
                  <button type="button" onClick={() => void loadOfficeAdmins()} disabled={adminsLoading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50" aria-label="Refresh OfficeAdmins">
                    <RefreshCw className={`h-4 w-4 ${adminsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <form onSubmit={addAdmin} className="mt-3 flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="office@example.com"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-500"
                    aria-label="OfficeAdmin Google account email"
                  />
                  <button type="submit" disabled={saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50">
                    {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </form>

                {adminsLoading ? (
                  <p className="py-5 text-center text-xs text-slate-500">Loading OfficeAdmins…</p>
                ) : officeAdmins.length > 0 ? (
                  <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800">
                    {officeAdmins.map((officeAdmin) => (
                      <li key={officeAdmin.email} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="min-w-0 truncate text-xs text-slate-200">{officeAdmin.email}</span>
                        <button
                          type="button"
                          onClick={() => void updateAdmin('remove', officeAdmin.email)}
                          disabled={saving}
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-950/60 hover:text-rose-300 disabled:opacity-50"
                          aria-label={`Remove OfficeAdmin ${officeAdmin.email}`}
                          title="Remove OfficeAdmin access"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed border-slate-700 px-3 py-5 text-center text-xs text-slate-500">No OfficeAdmins have been added yet.</p>
                )}

                {panelError && <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{panelError}</p>}
                {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">{notice}</p>}
                <p className="mt-4 text-[10px] leading-relaxed text-slate-500">SuperAdmin: {SUPER_ADMIN_EMAIL}. Change the single source at <code>shared/accessControl.ts</code>.</p>
              </div>
            )}
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-400">No account access information is available.</p>
        )}
      </section>
    </div>
  );
};
