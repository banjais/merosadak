import React, { useState, useEffect } from 'react';
import { Sun, Moon, Minimize, Maximize } from 'lucide-react';
import { TextScale } from '../hooks/useTextScale';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
  showTextSize?: boolean;
  showAccentColor?: boolean;
  showSignOut?: boolean;
  user?: { displayName?: string; email?: string } | null;
  onSignOut?: () => void;
  textScale?: TextScale;
  onTextScaleChange?: (scale: TextScale) => void;
  accentColor?: string;
  onAccentColorChange?: (color: string) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  onClose,
  onOpenChange,
  showTextSize = false,
  showAccentColor = false,
  showSignOut = false,
  user = null,
  onSignOut,
  textScale,
  onTextScaleChange,
  accentColor,
  onAccentColorChange,
}) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mero-sadak-theme');
        if (saved === 'light' || saved === 'dark') return saved;
      } catch {}
    }
    return 'dark';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('mero-sadak-theme', theme); } catch {}
    }
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleOverlayClick = () => {
    onClose();
    onOpenChange(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[199] bg-black/25" onClick={handleOverlayClick} />
      <div className="absolute right-0 top-full mt-1 w-40 max-w-[90vw] bg-slate-900/95 border border-slate-700/60 rounded-lg shadow-xl shadow-black/50 z-[200] overflow-hidden animate-fadeIn backdrop-blur-sm">

        {/* Theme + Fullscreen — single row */}
        <div className="grid grid-cols-2 gap-px bg-slate-700/40 m-2 mb-1 rounded-md overflow-hidden">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-1 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition text-[10px] font-semibold"
            title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          >
            {theme === 'dark'
              ? <Sun className="w-3 h-3 text-amber-400 shrink-0" />
              : <Moon className="w-3 h-3 text-cyan-400 shrink-0" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center justify-center gap-1 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition text-[10px] font-semibold"
            title="Toggle Fullscreen"
          >
            {isFullscreen
              ? <Minimize className="w-3 h-3 text-cyan-400 shrink-0" />
              : <Maximize className="w-3 h-3 text-cyan-400 shrink-0" />}
            <span>Full</span>
          </button>
        </div>

        {showTextSize && onTextScaleChange && (
          <div className="px-2.5 py-1.5">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">Text Size</p>
            <div className="flex items-center gap-1">
              {(['small', 'medium', 'large', 'xlarge'] as const).map((scale) => (
                <button
                  key={scale}
                  onClick={() => onTextScaleChange(scale)}
                  className={`flex-1 py-1 rounded-md text-[9px] font-bold transition border ${
                    textScale === scale
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {scale === 'small' ? 'S' : scale === 'medium' ? 'M' : scale === 'large' ? 'L' : 'XL'}
                </button>
              ))}
            </div>
          </div>
        )}

        {showAccentColor && onAccentColorChange && (
          <div className="px-2.5 py-1.5">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">Accent</p>
            <div className="flex items-center gap-1">
              {[
                { name: 'emerald', color: '#10b981' },
                { name: 'cyan', color: '#06b6d4' },
                { name: 'amber', color: '#f59e0b' },
                { name: 'violet', color: '#8b5cf6' },
                { name: 'rose', color: '#f43f5e' },
                { name: 'sky', color: '#0ea5e9' },
              ].map(({ name, color }) => (
                <button
                  key={name}
                  onClick={() => onAccentColorChange(name)}
                  title={name}
                  className={`w-5 h-5 rounded-full border transition-all duration-150 ${
                    accentColor === name
                      ? 'border-white/90 scale-110 shadow-md shadow-black/30'
                      : 'border-slate-600/60 hover:scale-110 hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        )}

        {showSignOut && user && onSignOut && (
          <div className="border-t border-slate-800/60 mx-2 mb-2">
            <button
              onClick={() => { onSignOut(); handleOverlayClick(); }}
              className="w-full flex items-center gap-2 py-1.5 px-1 text-[10px] font-semibold text-rose-400/90 hover:text-rose-300 hover:bg-rose-500/5 rounded transition"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1H9z" />
                <path d="M15 4V3c0-.6-.4-1-1-1h-1c-.6 0-1 .4-1 1v1h2z" />
                <path d="M8.5 8.5l-1.5 1.5 1.5 1.5" />
                <path d="M15.5 8.5l1.5 1.5-1.5 1.5" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </>
  );
}

interface SettingsButtonProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsClose?: () => void;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({ isOpen, onOpenChange, onSettingsClose }) => {
  const handleClick = () => {
    onOpenChange(!isOpen);
    onSettingsClose?.();
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-lg border text-xs font-semibold transition ${
        isOpen
          ? 'bg-accent-bg accent-text accent-border'
          : 'bg-slate-800/90 hover:bg-slate-700 accent-text hover:text-white border-slate-700/80'
      }`}
      title="Settings"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
};