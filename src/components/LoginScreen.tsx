import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chrome, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onClose?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onClose }) => {
  const { loginWithGoogle, loading, redirectError } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await loginWithGoogle(rememberMe);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
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

            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Redirecting to Google...</span>
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
