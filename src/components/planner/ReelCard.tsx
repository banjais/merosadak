import React from 'react';

interface ReelCardProps {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Optional small hint shown next to the title. */
  hint?: string;
  /** Optional count chip after the title (e.g. number of alerts). Zero hides the chip. */
  badge?: string | number;
  /** Alert sections get an amber header treatment so they read as "must see". */
  tone?: 'default' | 'alert';
  /** Optional controls aligned to the right side of the card header. */
  headerActions?: React.ReactNode;
  /** Hide the standard icon/title/hint header content when a custom action is used. */
  hideTitle?: boolean;
  children: React.ReactNode;
}

/**
 * Always-open card for the Reels-style planner deck. Unlike DetailSection,
 * there is no expand-collapse toggle: the card always shows its content, and
 * the user navigates between cards by swiping left/right (handled by the
 * PlannerDeck parent). This matches the Facebook-Reels / Stories metaphor:
 * one card = one piece of information, no tabs to dig through.
 */
export const ReelCard: React.FC<ReelCardProps> = ({
  id,
  title,
  Icon,
  hint,
  badge,
  tone = 'default',
  headerActions,
  hideTitle = false,
  children,
}) => {
  const alert = tone === 'alert';
  return (
    <section
      className={`ms-depth-card overflow-hidden rounded-3xl border backdrop-blur-md ${
        alert && badge
          ? 'ms-depth-card--alert border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-slate-950/80'
          : 'border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/80'
      }`}
      aria-label={title}
    >
      <div
        id={`reel-card-${id}`}
        className={`flex w-full items-center gap-3 px-4 py-3 ${hideTitle ? 'justify-end' : ''}`}
      >
        {!hideTitle && (
          <>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                alert && badge
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-slate-700/60 bg-slate-800/60 text-slate-300'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
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
          </>
        )}
        {headerActions}
      </div>
      <div
        id={`reel-card-body-${id}`}
        role="region"
        aria-labelledby={`reel-card-${id}`}
        className="border-t border-slate-800/70 p-3 sm:p-4"
      >
        {children}
      </div>
    </section>
  );
};

export default ReelCard;
