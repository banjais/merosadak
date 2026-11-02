import React from 'react';
import { ChevronDown } from 'lucide-react';

interface DetailSectionProps {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** One-line short info shown in the header, so the section can stay closed. */
  hint?: string;
  /** Count chip after the title (e.g. alerts ahead). Zero hides the chip. */
  badge?: string | number;
  /** Alert sections get an amber header treatment so they read as "must see". */
  tone?: 'default' | 'alert';
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * One progressive-disclosure section of the trip result. The header always
 * shows a short hint so the answer is visible without opening anything; the
 * body renders only while open, keeping the page short and the information
 * layered: verdict first, facts second, details on demand.
 */
export const DetailSection: React.FC<DetailSectionProps> = ({
  id,
  title,
  Icon,
  hint,
  badge,
  tone = 'default',
  open,
  onToggle,
  children,
}) => {
  const alert = tone === 'alert';
  return (
    <section
      className={`overflow-hidden rounded-3xl border backdrop-blur-md ${
        alert && badge
          ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-slate-950/80'
          : 'border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/80'
      }`}
      aria-label={title}
    >
      <button
        type="button"
        id={`detail-section-${id}`}
        aria-expanded={open}
        aria-controls={`detail-body-${id}`}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-900/60"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
            alert && badge
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
              : 'border-slate-700/60 bg-slate-800/60 text-slate-300'
          }`}
        >
          <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-black text-white">{title}</span>
            {badge !== undefined && badge !== 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  alert ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {badge}
              </span>
            )}
          </span>
          {hint && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{hint}</span>}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-emerald-400' : ''}`}
        />
      </button>
      {open && (
        <div id={`detail-body-${id}`} role="region" aria-labelledby={`detail-section-${id}`} className="border-t border-slate-800/70 p-3 sm:p-4 animate-fadeIn">
          {children}
        </div>
      )}
    </section>
  );
};

export default DetailSection;
