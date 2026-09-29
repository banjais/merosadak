import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useCardArchive } from '../context/CardArchiveContext';
import { triggerHaptic } from '../utils/haptic';

export type ReelCardType = 'highway' | 'incident' | 'tip' | 'custom' | 'report' | 'distance';

export interface ReelCardItem {
  id: string;
  type?: ReelCardType;
  title?: string;
  subtitle?: string;
  /** Compact face (always visible) — preferred over dumping everything in content */
  summary?: React.ReactNode;
  /** Expanded body when user taps the card */
  detail?: React.ReactNode;
  /** Fallback full body when summary/detail not split */
  content?: React.ReactNode;
  archiveData?: Record<string, unknown>;
}

interface SwipeableReelStackProps {
  cards: ReelCardItem[];
  hideArchived?: boolean;
  showArchiveButton?: boolean;
  className?: string;
  emptyState?: React.ReactNode;
  onIndexChange?: (index: number) => void;
  /** Start with detail open */
  defaultExpanded?: boolean;
}

/**
 * Modern Reels-style stack: swipe between cards, tap to open more info, archive on top.
 */
export const SwipeableReelStack: React.FC<SwipeableReelStackProps> = ({
  cards,
  hideArchived = true,
  showArchiveButton = true,
  className = '',
  emptyState,
  onIndexChange,
  defaultExpanded = false,
}) => {
  const { isArchived, archiveCard, restoreCard } = useCardArchive();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const startX = useRef(0);
  const startY = useRef(0);
  const axisLock = useRef<'x' | 'y' | null>(null);
  const moved = useRef(false);

  const visible = useMemo(() => {
    if (!hideArchived) return cards;
    return cards.filter((c) => !isArchived(c.id, c.type || 'custom'));
  }, [cards, hideArchived, isArchived]);

  const activeIndex = visible.length === 0 ? 0 : Math.min(index, visible.length - 1);

  const goTo = useCallback(
    (next: number) => {
      if (visible.length === 0) return;
      const clamped = ((next % visible.length) + visible.length) % visible.length;
      setIndex(clamped);
      onIndexChange?.(clamped);
      try {
        triggerHaptic('light');
      } catch {
        /* optional */
      }
    },
    [visible.length, onIndexChange]
  );

  const onPointerDown = (clientX: number, clientY: number) => {
    startX.current = clientX;
    startY.current = clientY;
    axisLock.current = null;
    moved.current = false;
    setDragging(true);
    setDragX(0);
  };

  const onPointerMove = (clientX: number, clientY: number) => {
    if (!dragging) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;
    if (!axisLock.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLock.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axisLock.current === 'x') moved.current = true;
      }
    }
    if (axisLock.current === 'x') {
      setDragX(dx);
      moved.current = true;
    }
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = 56;
    if (axisLock.current === 'x') {
      if (dragX <= -threshold) goTo(activeIndex + 1);
      else if (dragX >= threshold) goTo(activeIndex - 1);
    }
    setDragX(0);
    axisLock.current = null;
  };

  const handleArchiveToggle = (card: ReelCardItem) => {
    const type = card.type || 'custom';
    if (isArchived(card.id, type)) {
      restoreCard(card.id);
    } else {
      archiveCard({
        id: card.id,
        type,
        data: { title: card.title || card.id, ...(card.archiveData || {}) },
      });
      if (hideArchived && activeIndex >= visible.length - 1) {
        setIndex(Math.max(0, activeIndex - 1));
      }
    }
    try {
      triggerHaptic('medium');
    } catch {
      /* optional */
    }
  };

  const isExpanded = (id: string) =>
    expandedIds[id] !== undefined ? expandedIds[id] : defaultExpanded;

  const toggleExpand = (id: string) => {
    if (moved.current) return;
    setExpandedIds((prev) => ({ ...prev, [id]: !isExpanded(id) }));
    try {
      triggerHaptic('light');
    } catch {
      /* optional */
    }
  };

  if (visible.length === 0) {
    return (
      <div className={`reel-stack ${className}`}>
        {emptyState || (
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-center text-xs text-slate-400">
            No cards. Restore from Archive if you hid them.
          </div>
        )}
      </div>
    );
  }

  const active = visible[activeIndex];

  return (
    <div className={`reel-stack ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 min-w-0">
          <span className="text-slate-300 shrink-0">
            {activeIndex + 1}/{visible.length}
          </span>
          {active.title && (
            <span className="truncate max-w-[11rem] normal-case tracking-normal text-slate-400 font-semibold">
              {active.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {visible.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => goTo(activeIndex - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => goTo(activeIndex + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {showArchiveButton && (
            <button
              type="button"
              aria-label="Archive"
              className={`reel-archive-btn ${isArchived(active.id, active.type || 'custom') ? 'is-archived' : ''}`}
              onClick={() => handleArchiveToggle(active)}
              title="Archive / restore"
            >
              {isArchived(active.id, active.type || 'custom') ? (
                <ArchiveRestore className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      <div
        className="reel-stack-stage"
        onTouchStart={(e) => onPointerDown(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onPointerMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={onPointerUp}
        onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => {
          if (dragging) onPointerMove(e.clientX, e.clientY);
        }}
        onMouseUp={onPointerUp}
        onMouseLeave={() => {
          if (dragging) onPointerUp();
        }}
      >
        {visible.map((card, i) => {
          const offset = i - activeIndex;
          let slotClass = 'reel-card-slot is-hidden';
          let transform = 'translateX(0) scale(0.9) translateZ(-120px)';
          let opacity = 0;

          if (offset === 0) {
            slotClass = 'reel-card-slot is-active';
            const rot = dragging ? dragX * 0.08 : 0;
            const tx = dragging ? dragX : 0;
            transform = `translateX(${tx}px) rotateY(${rot}deg) translateZ(0) scale(1)`;
            opacity = 1;
          } else if (offset === 1 || (offset === -visible.length + 1 && visible.length > 1)) {
            slotClass = 'reel-card-slot is-next';
            transform = 'translateX(10%) scale(0.94) translateZ(-48px) rotateY(-8deg)';
            opacity = 0.5;
          } else if (offset === -1 || (offset === visible.length - 1 && visible.length > 1)) {
            slotClass = 'reel-card-slot is-prev';
            transform = 'translateX(-10%) scale(0.94) translateZ(-48px) rotateY(8deg)';
            opacity = 0.5;
          }

          const open = isExpanded(card.id);
          const hasSplit = !!(card.summary || card.detail);
          const body = hasSplit ? (
            <>
              <div className="text-sm text-slate-200">{card.summary}</div>
              {card.detail && open && (
                <div className="mt-3 border-t border-slate-800/80 pt-3 text-xs text-slate-300 space-y-2">
                  {card.detail}
                </div>
              )}
              {card.detail && (
                <div className="mt-2 flex justify-center">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400/90">
                    {open ? (
                      <>
                        <ChevronUp className="h-3 w-3" /> Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" /> More
                      </>
                    )}
                  </span>
                </div>
              )}
            </>
          ) : (
            card.content
          );

          return (
            <div
              key={card.id}
              className={slotClass}
              style={{
                transform,
                opacity,
                transition: dragging && offset === 0 ? 'none' : undefined,
              }}
            >
              <div
                className={`reel-card-face p-3 sm:p-4 ${offset === 0 ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (offset === 0 && (card.detail || hasSplit)) toggleExpand(card.id);
                }}
                role={offset === 0 ? 'button' : undefined}
                tabIndex={offset === 0 ? 0 : -1}
                onKeyDown={(e) => {
                  if (offset === 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    toggleExpand(card.id);
                  }
                }}
              >
                {(card.title || card.subtitle) && (
                  <div className="mb-2 border-b border-slate-800/80 pb-2">
                    {card.title && (
                      <div className="text-sm font-black text-white font-display">{card.title}</div>
                    )}
                    {card.subtitle && (
                      <div className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</div>
                    )}
                  </div>
                )}
                {body}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length > 1 && (
        <div className="reel-stack-dots" role="tablist" aria-label="Cards">
          {visible.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              className={`reel-stack-dot ${i === activeIndex ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
      <p className="mt-1.5 text-center text-[10px] text-slate-500">
        Swipe ⇆ · tap card for more · archive ↗
      </p>
    </div>
  );
};
