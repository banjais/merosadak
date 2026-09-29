import React, { useState } from 'react';
import { Archive, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react';
import { useCardArchive } from '../context/CardArchiveContext';
import { triggerHaptic } from '../utils/haptic';

export type ProgressiveCardType = 'highway' | 'incident' | 'tip' | 'custom' | 'report' | 'distance';

export interface ProgressiveCardProps {
  id: string;
  type?: ProgressiveCardType;
  /** Always-visible compact summary */
  summary: React.ReactNode;
  /** Revealed when expanded */
  detail?: React.ReactNode;
  title?: string;
  eyebrow?: string;
  accent?: 'emerald' | 'cyan' | 'amber' | 'rose' | 'purple' | 'slate';
  archiveData?: Record<string, unknown>;
  defaultExpanded?: boolean;
  /** Controlled expand (optional) */
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  className?: string;
  /** Hide entirely when archived (parent should filter); still shows restore if forced */
  showArchive?: boolean;
}

const accentBorder: Record<string, string> = {
  emerald: 'border-emerald-500/30',
  cyan: 'border-cyan-500/30',
  amber: 'border-amber-500/30',
  rose: 'border-rose-500/30',
  purple: 'border-purple-500/30',
  slate: 'border-slate-700/60',
};

/**
 * Less-info-first card: compact summary, tap to open detail, archive icon on top.
 */
export const ProgressiveCard: React.FC<ProgressiveCardProps> = ({
  id,
  type = 'custom',
  summary,
  detail,
  title,
  eyebrow,
  accent = 'slate',
  archiveData,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  className = '',
  showArchive = true,
}) => {
  const { isArchived, archiveCard, restoreCard } = useCardArchive();
  const [internalOpen, setInternalOpen] = useState(defaultExpanded);
  const open = controlledExpanded ?? internalOpen;
  const archived = isArchived(id, type);

  const setOpen = (next: boolean) => {
    onExpandedChange?.(next);
    if (controlledExpanded === undefined) setInternalOpen(next);
  };

  const toggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!detail) return;
    setOpen(!open);
    try {
      triggerHaptic('light');
    } catch {
      /* optional */
    }
  };

  const onArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (archived) {
      restoreCard(id);
    } else {
      archiveCard({
        id,
        type,
        data: { title: title || id, ...(archiveData || {}) },
      });
    }
    try {
      triggerHaptic('medium');
    } catch {
      /* optional */
    }
  };

  if (archived && showArchive) {
    return (
      <div
        className={`progressive-card is-archived rounded-2xl border border-slate-800/80 bg-slate-950/50 px-3 py-2.5 ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 truncate">
            Archived{title ? `: ${title}` : ''}
          </span>
          <button
            type="button"
            onClick={onArchive}
            className="reel-archive-btn is-archived"
            aria-label="Restore card"
            title="Restore"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <article
      className={`progressive-card card card-interactive ${accentBorder[accent]} ${open ? 'is-open' : ''} ${className}`}
    >
      <div className="progressive-card-top">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
              {eyebrow}
            </div>
          )}
          {title && (
            <h3 className="text-sm font-black text-white font-display truncate">{title}</h3>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showArchive && (
            <button
              type="button"
              onClick={onArchive}
              className="reel-archive-btn"
              aria-label="Archive card"
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          {detail && (
            <button
              type="button"
              onClick={toggle}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              aria-expanded={open}
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        className="progressive-card-summary w-full text-left"
        onClick={toggle}
        disabled={!detail}
      >
        {summary}
      </button>

      {detail && open && (
        <div className="progressive-card-detail animate-fadeIn">
          <div className="border-t border-slate-800/80 pt-3 mt-2">{detail}</div>
        </div>
      )}
    </article>
  );
};
