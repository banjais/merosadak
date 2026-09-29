import React, { useCallback, useMemo, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  PanInfo,
  animate,
} from 'motion/react';
import { Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useCardArchive } from '../context/CardArchiveContext';
import { triggerHaptic } from '../utils/haptic';

export type ReelCardType = 'highway' | 'incident' | 'tip' | 'custom' | 'report' | 'distance';

export interface ReelCardItem {
  id: string;
  type?: ReelCardType;
  title?: string;
  subtitle?: string;
  summary?: React.ReactNode;
  detail?: React.ReactNode;
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
  defaultExpanded?: boolean;
}

const SWIPE_DISTANCE = 72;
const SWIPE_VELOCITY = 450;
/** Max rotateY degrees at full drag */
const ROTATE_RANGE = 10;

/**
 * High-performance Reels stack: MotionValues for drag (no React re-renders per frame),
 * transform-only animation, velocity-aware snap.
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
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  // Compositor-thread friendly — do not put drag offset in React state
  const x = useMotionValue(0);
  const rotateY = useTransform(x, [-160, 0, 160], [ROTATE_RANGE, 0, -ROTATE_RANGE]);
  const dragOpacity = useTransform(x, [-200, -80, 0, 80, 200], [0.55, 1, 1, 1, 0.55]);

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
      x.set(0);
      try {
        triggerHaptic('light');
      } catch {
        /* optional */
      }
    },
    [visible.length, onIndexChange, x]
  );

  const snapHome = useCallback(() => {
    void animate(x, 0, { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 });
  }, [x]);

  const onDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      const wentLeft =
        offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY;
      const wentRight =
        offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY;

      if (wentLeft) {
        void animate(x, -280, { duration: 0.18, ease: 'easeOut' }).then(() => {
          goTo(activeIndex + 1);
        });
      } else if (wentRight) {
        void animate(x, 280, { duration: 0.18, ease: 'easeOut' }).then(() => {
          goTo(activeIndex - 1);
        });
      } else {
        snapHome();
      }
    },
    [activeIndex, goTo, snapHome, x]
  );

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
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span className="shrink-0 text-slate-300">
            {activeIndex + 1}/{visible.length}
          </span>
          {active.title && (
            <span className="max-w-[11rem] truncate font-semibold normal-case tracking-normal text-slate-400">
              {active.title}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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

      <div className="reel-stack-stage">
        {/* Peek layers — static CSS transforms, only ±1 neighbor rendered */}
        {visible.length > 1 && (() => {
          const prev = visible[(activeIndex - 1 + visible.length) % visible.length];
          const next = visible[(activeIndex + 1) % visible.length];
          return (
            <>
              <div
                className="reel-card-slot is-prev"
                style={{
                  transform: 'translate3d(-10%,0,-48px) scale(0.94) rotateY(8deg)',
                  opacity: 0.4,
                }}
                aria-hidden
              >
                <div className="reel-card-face p-3 sm:p-4 pointer-events-none">
                  <div className="text-xs font-bold text-slate-500 truncate">{prev.title || '·'}</div>
                </div>
              </div>
              <div
                className="reel-card-slot is-next"
                style={{
                  transform: 'translate3d(10%,0,-48px) scale(0.94) rotateY(-8deg)',
                  opacity: 0.4,
                }}
                aria-hidden
              >
                <div className="reel-card-face p-3 sm:p-4 pointer-events-none">
                  <div className="text-xs font-bold text-slate-500 truncate">{next.title || '·'}</div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Active card only is draggable — single Motion subtree */}
        <motion.div
          className="reel-card-slot is-active"
          style={{
            x,
            rotateY,
            opacity: dragOpacity,
            willChange: 'transform',
            transformPerspective: 1200,
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          dragMomentum={false}
          dragDirectionLock
          onDragEnd={onDragEnd}
        >
          <div
            className="reel-card-face p-3 sm:p-4 cursor-grab active:cursor-grabbing select-none"
            onClick={() => {
              if (active.detail || active.summary) toggleExpand(active.id);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleExpand(active.id);
              }
            }}
          >
            {(active.title || active.subtitle) && (
              <div className="mb-2 border-b border-slate-800/80 pb-2">
                {active.title && (
                  <div className="text-sm font-black text-white font-display">{active.title}</div>
                )}
                {active.subtitle && (
                  <div className="mt-0.5 text-[11px] text-slate-400">{active.subtitle}</div>
                )}
              </div>
            )}
            {active.summary || active.detail ? (
              <>
                <div className="text-sm text-slate-200">{active.summary}</div>
                {active.detail && isExpanded(active.id) && (
                  <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-3 text-xs text-slate-300">
                    {active.detail}
                  </div>
                )}
                {active.detail && (
                  <div className="mt-2 flex justify-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400/90">
                      {isExpanded(active.id) ? (
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
              active.content
            )}
          </div>
        </motion.div>
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
        Swipe ⇆ · tap for more · archive ↗
      </p>
    </div>
  );
};
