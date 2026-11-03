import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chrome, ChevronDown, ChevronUp, KeyRound, ShieldCheck, X } from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS, type DemoAccount } from '../context/AuthContext';

interface LoginScreenProps {
  onClose?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onClose }) => {
  const { loginWithGoogle, loginWithGooglePopup, loginWithDemo, loading, redirectError, clearRedirectError } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    clearRedirectError();
    setIsLoading(true);
    try {
      // Popup-based sign-in is more reliable in PWAs and mobile browsers.
      await loginWithGooglePopup();
      onClose?.();
    } catch (popupErr) {
      // Popup blocked or failed — fall back to redirect-based sign-in.
      try {
        await loginWithGoogle(rememberMe);
        onClose?.();
      } catch (redirectErr) {
        setError(redirectErr instanceof Error ? redirectErr.message : 'Google sign-in failed.');
        setIsLoading(false);
      }
    }
  };

  const handleDemoLogin = async (account: DemoAccount) => {
    setError('');
    clearRedirectError();
    setIsLoading(true);
    try {
      await loginWithDemo(account.email, account.password);
      setIsLoading(false);
      onClose?.();
    } catch (demoErr) {
      setError(demoErr instanceof Error ? demoErr.message : 'Demo sign-in failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="w-full max-w-sm"
      >
        {onClose && (
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close sign in"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-amber-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/25">
            <ShieldCheck className="text-slate-950 w-8 h-8" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Mero Sadak</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">Nepal National Highway Network &amp; GIS</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-700/60">
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-slate-100 font-semibold mb-1">Welcome back</p>
              <p className="text-xs text-slate-400">Sign in with your Google account to continue.</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading || loading}
              className="w-full py-3 bg-white border-2 border-slate-200 hover:border-amber-400 text-slate-800 text-sm font-bold rounded-xl active:scale-[0.98] transition flex items-center justify-center gap-3 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Chrome className="w-5 h-5 text-red-500" />
              <span>Sign in with Google</span>
            </button>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-slate-300">Remember me</span>
            </label>

            {/* Mock/demo accounts — explore each role surface without a Google
            account. Email/Password sign-in is not enabled on the Firebase
            project, so these fixed credentials are validated on this device. */}
            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDemo((prev) => !prev)}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{showDemo ? 'Hide demo accounts' : 'Try a demo account (no Google needed)'}</span>
                {showDemo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDemo && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    Mock credentials for exploring each role panel. Validated on this device only.
                  </p>
                  {DEMO_ACCOUNTS.map((account) => (
                    <div
                      key={account.email}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            account.role === 'OfficeAdmin'
                              ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30'
                              : 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {account.role === 'OfficeAdmin' ? 'Office Admin' : 'General User'}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">demo</span>
                      </div>
                      <div className="space-y-0.5 font-mono text-[10px] text-slate-300">
                        <p className="truncate">
                          <span className="text-slate-500">Email:&nbsp;</span>{account.email}
                        </p>
                        <p>
                          <span className="text-slate-500">Password:&nbsp;</span>{account.password}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDemoLogin(account)}
                        disabled={isLoading || loading}
                        className={`w-full py-2 rounded-lg text-[11px] font-bold transition disabled:opacity-60 disabled:cursor-not-allowed ${
                          account.role === 'OfficeAdmin'
                            ? 'bg-cyan-600/80 hover:bg-cyan-500 text-white'
                            : 'bg-emerald-600/80 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        Sign in as {account.role === 'OfficeAdmin' ? 'Office Admin' : 'General User'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Opening Google sign-in...</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 text-center font-medium">
                Google sign-in uses your existing Mero Sadak Firebase project.
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {(error || redirectError) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-start gap-2 bg-rose-950/60 border-l-4 border-rose-500 rounded-r-lg px-3 py-2.5"
            >
              <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-rose-200">{error || redirectError}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
