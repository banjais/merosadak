import React, { useEffect, useState } from 'react';
import { Sun, Moon, Palette, TextCursor } from 'lucide-react';
import { useTextScale, TextScale } from '../hooks/useTextScale';

const THEME_KEY = 'mero-sadak-theme';
const ACCENT_KEY = 'mero-sadak-accent';

function getSavedTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return 'dark';
}

function getSavedAccent(): string {
  if (typeof window === 'undefined') return 'emerald';
  try {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (saved) return saved;
  } catch {}
  return 'emerald';
}

interface PanelSettingsProps {
  className?: string;
}

export function PanelSettings({ className }: PanelSettingsProps) {
  const { textScale, setTextScale } = useTextScale();
  const [theme, setTheme] = useState<'dark' | 'light'>(getSavedTheme);
  const [accent, setAccent] = useState<string>(getSavedAccent);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {}
  }, [theme, accent]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const scaleLabel = (s: TextScale) => (s === 'small' ? 'S' : s === 'medium' ? 'M' : s === 'large' ? 'L' : 'XL');

  const accents = [
    { name: 'emerald', color: '#10b981' },
    { name: 'cyan', color: '#06b6d4' },
    { name: 'amber', color: '#f59e0b' },
    { name: 'violet', color: '#8b5cf6' },
    { name: 'rose', color: '#f43f5e' },
    { name: 'sky', color: '#0ea5e9' },
  ];

  return (
    <section className={`space-y-3 border border-slate-800/60 rounded-2xl bg-slate-900/60 p-4 ${className || ''}`}>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Display Settings</h4>
        <Palette className="w-3 h-3 text-slate-500 shrink-0" />
      </div>

      {/* Theme + Fullscreen row */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={toggleTheme}
          className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl border text-xs font-semibold transition ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-600/60 text-slate-200 hover:bg-slate-700'
              : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800'
          }`}
          title="Switch theme"
        >
          {theme === 'dark' ? (
            <>
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Dark</span>
            </>
          )}
        </button>
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl border bg-slate-800/40 border-slate-700/40 text-slate-400 text-xs font-semibold transition hover:bg-slate-800 hover:text-slate-200"
          title="Toggle fullscreen"
        >
          <TextCursor className="w-3.5 h-3.5 text-cyan-400" />
          <span>Full</span>
        </button>
      </div>

      {/* Text size */}
      <div>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">Text Size</p>
        <div className="flex items-center gap-1.5">
          {(['small', 'medium', 'large', 'xlarge'] as const).map((scale) => (
            <button
              key={scale}
              onClick={() => setTextScale(scale)}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition border ${
                textScale === scale
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {scaleLabel(scale)}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">Accent Color</p>
        <div className="flex items-center gap-1.5">
          {accents.map(({ name, color }) => (
            <button
              key={name}
              onClick={() => setAccent(name)}
              title={name}
              className={`w-6 h-6 rounded-full border transition-all duration-150 ${
                accent === name
                  ? 'border-white/90 scale-110 shadow-md shadow-black/30'
                  : 'border-slate-600/60 hover:scale-110 hover:border-slate-400'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
