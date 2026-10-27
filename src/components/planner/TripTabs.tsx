import React, { useRef } from 'react';

export type TripTab = 'journey' | 'insights' | 'costs' | 'routes' | 'report';

export interface TripTabItem {
  id: TripTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Small count/flag shown after the label (e.g. incidents ahead). */
  badge?: string | number;
}

interface TripTabsProps {
  tabs: TripTabItem[];
  active: TripTab;
  onChange: (tab: TripTab) => void;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD_PX = 56;

/**
 * Single tab bar for everything that follows a calculated route. Exactly one
 * tab is always active, so there is no "closed" state to manage, and swiping
 * the content on touch devices moves to the neighbouring tab.
 */
export const TripTabs: React.FC<TripTabsProps> = ({ tabs, active, onChange, children }) => {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const move = (delta: -1 | 1) => {
    const idx = tabs.findIndex((t) => t.id === active);
    const next = tabs[Math.max(0, Math.min(tabs.length - 1, idx + delta))];
    if (next && next.id !== active) onChange(next.id);
  };

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Trip sections"
        className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/90 p-1 backdrop-blur [scrollbar-width:none]"
      >
        {tabs.map(({ id, label, Icon, badge }) => {
          const selected = id === active;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`trip-tab-${id}`}
              aria-selected={selected}
              aria-controls={`trip-panel-${id}`}
              onClick={() => onChange(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                selected
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              {badge !== undefined && badge !== 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">{badge}</span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`trip-panel-${active}`}
        aria-labelledby={`trip-tab-${active}`}
        className="animate-fadeIn"
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          startY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (startX.current === null || startY.current === null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          const dy = e.changedTouches[0].clientY - startY.current;
          startX.current = startY.current = null;
          // Only treat clearly horizontal gestures as tab swipes so vertical
          // scrolling and horizontal charts inside a panel keep working.
          if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          const target = e.target as HTMLElement;
          if (target.closest('[data-no-tab-swipe]')) return;
          move(dx < 0 ? 1 : -1);
        }}
      >
        {children}
      </div>
    </div>
  );
};
