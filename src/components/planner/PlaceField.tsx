import React from 'react';
import { Mic, Search, X } from 'lucide-react';

type Accent = 'emerald' | 'cyan';

interface PlaceFieldProps {
  /** Stable DOM id, also used by tests and the browser's autofill suppression. */
  id: string;
  placeholder: string;
  value: string;
  /** True once the field holds a resolved place (draws the accent border). */
  resolved: boolean;
  accent?: Accent;
  listening: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onFocus: () => void;
  onVoice: () => void;
  onClear?: () => void;
  /** Extra round icon buttons shown after the mic (AI planner, highway browser…). */
  actions?: React.ReactNode;
  /** Suggestions dropdown, rendered directly under the field. */
  children?: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
  className?: string;
}

const ACCENT: Record<Accent, { icon: string; resolved: string; idle: string }> = {
  emerald: {
    icon: 'text-emerald-400',
    resolved: 'border-emerald-500/60 focus:border-emerald-400',
    idle: 'border-slate-800 focus:border-emerald-500',
  },
  cyan: {
    icon: 'text-cyan-400',
    resolved: 'border-cyan-500/60 focus:border-cyan-400',
    idle: 'border-slate-800 focus:border-cyan-500',
  },
};

/**
 * One place-search field. The planner used to inline three near-identical
 * copies (single destination, origin, destination); they all render this now.
 */
export const PlaceField: React.FC<PlaceFieldProps> = ({
  id,
  placeholder,
  value,
  resolved,
  accent = 'emerald',
  listening,
  inputRef,
  onChange,
  onFocus,
  onVoice,
  onClear,
  actions,
  children,
  containerRef,
  className = '',
}) => {
  const tone = ACCENT[accent];
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className={`pointer-events-none absolute left-3.5 h-4 w-4 ${tone.icon}`} aria-hidden />
        <input
          id={id}
          name={`merosadak-${id}`}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          aria-label={placeholder}
          className={`w-full rounded-2xl bg-slate-950 py-3 pl-10 pr-28 text-sm font-medium text-white placeholder-slate-500 shadow-inner transition focus:outline-none ${
            resolved ? `border-2 ${tone.resolved}` : `border ${tone.idle}`
          }`}
        />
        <div className="absolute right-2 flex items-center gap-1.5">
          {onClear && (value || resolved) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onVoice}
            aria-label="Voice search"
            className={`rounded-lg border p-1.5 transition ${
              listening
                ? 'animate-pulse border-rose-400 bg-rose-500 text-white'
                : 'border-slate-700 bg-slate-800 text-emerald-400 hover:bg-slate-700'
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
};

export const FieldIconButton: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, active = false, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`rounded-lg border p-1.5 transition ${
      active
        ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
        : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
    }`}
  >
    {children}
  </button>
);
