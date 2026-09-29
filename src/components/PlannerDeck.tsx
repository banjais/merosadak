import React, { useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, animate } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

const SWIPE_DISTANCE = 72;
const SWIPE_VELOCITY = 450;
const ROTATE_RANGE = 10;

export interface DeckItem {
  id: string;
  label: string;
  /** Short line shown on the tab while the card is not active. */
  hint?: string;
}

interface PlannerDeckProps {
  items: DeckItem[];
  activeId: string;
  onChange: (id: string) => void;
  /**
   * Render prop receiving the active id. Sections stay inline in the caller's
   * JSX and gate themselves with `id === '...'`, so no markup is hoisted.
   */
  children: (activeId: string) => React.ReactNode;
}

/**
 * Facebook-Reels style deck for the planner sections.
 *
 * Each section stays a sibling block in the caller's JSX and is gated by
 * `activeId`, so no markup has to be hoisted. The active card is the only
 * draggable surface; horizontal drag or the arrow buttons move between cards.
 */
export const PlannerDeck: React.FC<PlannerDeckProps> = ({ items, activeId, onChange, children }) => {
  const x = useMotionValue(0);
  const rotateY = useTransform(x, [-160, 0, 160], [ROTATE_RANGE, 0, -ROTATE_RANGE]);
  const dragOpacity = useTransform(x, [-200, -80, 0, 80, 200], [0.6, 1, 1, 1, 0.6]);
  const dragging = useRef(false);

  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.id === activeId)
  );
  const active = items[activeIndex];

  const goTo = useCallback(
    (next: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      if (clamped === activeIndex) return;
      x.set(0);
      onChange(items[clamped].id);
      try {
        triggerHaptic('light');
      } catch {
        /* optional */
      }
    },
    [items, activeIndex, onChange, x]
  );

  const onDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      dragging.current = false;
      const { offset, velocity } = info;
      if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) {
        void animate(x, -240, { duration: 0.16, ease: 'easeOut' }).then(() => goTo(activeIndex + 1));
      } else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) {
        void animate(x, 240, { duration: 0.16, ease: 'easeOut' }).then(() => goTo(activeIndex - 1));
      } else {
        void animate(x, 0, { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 });
      }
    },
    [activeIndex, goTo, x]
  );

  if (!active) return null;

  return (
    <div className="reel-stack reel-stack--tall">
      {/* Card switcher */}
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span className="shrink-0 text-slate-300">
            {activeIndex + 1}/{items.length}
          </span>
          <span className="max-w-[12rem] truncate font-semibold normal-case tracking-normal text-slate-400">
            {active.label}
          </span>
        </div>
        {items.length > 1 && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous section"
              onClick={() => goTo(activeIndex - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              disabled={activeIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next section"
              onClick={() => goTo(activeIndex + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              disabled={activeIndex === items.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="reel-stack-stage">
        <motion.div
          className="reel-card-slot is-active"
          style={{ x, rotateY, opacity: dragOpacity, willChange: 'transform', transformPerspective: 1200 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          dragMomentum={false}
          dragDirectionLock
          onDragStart={() => { dragging.current = true; }}
          onDragEnd={onDragEnd}
        >
          <div className="reel-card-face p-3 sm:p-4">{children(active.id)}</div>
        </motion.div>
      </div>

      {items.length > 1 && (
        <div className="reel-stack-dots" role="tablist" aria-label="Planner sections">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              title={item.hint || item.label}
              className={`reel-stack-dot ${i === activeIndex ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
      {items.length > 1 && (
        <p className="mt-1.5 text-center text-[10px] text-slate-500">Swipe ⇆ to move between sections</p>
      )}
    </div>
  );
};

export default PlannerDeck;
