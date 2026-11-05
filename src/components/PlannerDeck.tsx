import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, useDragControls, PanInfo, animate } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';
import { useIsDesktop } from '../hooks/useIsDesktop';

const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 420;
const ROTATE_RANGE = 24;
/** Elements that must keep their own pointer behaviour instead of starting a card swipe. */
const NO_SWIPE_SELECTOR = 'input,textarea,select,button,a,[data-no-swipe],.leaflet-container,canvas,[role="slider"]';

export interface DeckItem {
  id: string;
  label: string;
  hint?: string;
}

interface PlannerDeckProps {
  items: DeckItem[];
  activeId: string;
  onChange: (id: string) => void;
  children: (activeId: string) => React.ReactNode;
  variant?: 'default' | 'plain';
}

/**
 * A tactile 3D sector deck. Every planner topic is a separate card.
 * The neighbouring cards remain visible as depth layers; users move through
 * the sectors by dragging the active card left/right or using the outer arrows.
 */
export const PlannerDeck: React.FC<PlannerDeckProps> = ({
  items,
  activeId,
  onChange,
  children,
  variant = 'default',
}) => {
  const isDesktop = useIsDesktop();
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const [direction, setDirection] = useState(1);
  const rotateY = useTransform(x, [-220, 0, 220], [ROTATE_RANGE, 0, -ROTATE_RANGE]);
  const dragOpacity = useTransform(x, [-260, -80, 0, 80, 260], [0.55, 1, 1, 1, 0.55]);

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const active = items[activeIndex];
  const previous = items[activeIndex - 1];
  const next = items[activeIndex + 1];

  const goTo = useCallback((target: number) => {
    if (items.length === 0) return;
    const index = Math.max(0, Math.min(items.length - 1, target));
    if (index === activeIndex) {
      void animate(x, 0, { type: 'spring', stiffness: 420, damping: 34 });
      return;
    }
    setDirection(index > activeIndex ? 1 : -1);
    x.set(0);
    onChange(items[index].id);
    try {
      triggerHaptic('light');
    } catch {
      // Haptics are optional; navigation must still work without them.
    }
  }, [items, activeIndex, onChange, x]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(activeIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(activeIndex - 1);
    }
  }, [activeIndex, goTo]);

  const onDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const wentNext = offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY;
    const wentPrev = offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY;
    if ((wentNext && activeIndex < items.length - 1) || (wentPrev && activeIndex > 0)) {
      goTo(wentNext ? activeIndex + 1 : activeIndex - 1);
    } else {
      void animate(x, 0, { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 });
    }
  }, [activeIndex, goTo, items.length, x]);

  if (!active) return null;

  if (isDesktop) {
    return (
      <section className="planner-deck-desktop" aria-label="Sections">
        {items.length > 8 && (
          <div className="planner-deck-desktop__tabs items-center justify-between">
            <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} className="planner-deck-desktop__tab disabled:opacity-30" aria-label="Previous">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-sm font-bold text-slate-200">
              {active.label} <span className="font-mono text-xs text-emerald-300">{activeIndex + 1} / {items.length}</span>
            </span>
            <button type="button" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex === items.length - 1} className="planner-deck-desktop__tab disabled:opacity-30" aria-label="Next">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
        {items.length > 1 && items.length <= 8 && (
          <div role="tablist" className="planner-deck-desktop__tabs">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === active.id}
                title={item.hint}
                onClick={() => onChange(item.id)}
                className={`planner-deck-desktop__tab ${item.id === active.id ? 'is-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div role="tabpanel" className="planner-deck-desktop__panel">
          {children(active.id)}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`planner-deck-3d ${variant === 'plain' ? 'planner-deck-3d--plain' : ''}`}
      aria-label="Trip planner sectors"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="planner-deck-3d__stage">
        {previous && (
          <div className="planner-deck-3d__preview planner-deck-3d__preview--previous" aria-hidden="true">
            <span className="planner-deck-3d__preview-kicker">PREVIOUS</span>
            <span className="planner-deck-3d__preview-title">{previous.label}</span>
            {previous.hint && <span className="planner-deck-3d__preview-hint">{previous.hint}</span>}
          </div>
        )}
        {next && (
          <div className="planner-deck-3d__preview planner-deck-3d__preview--next" aria-hidden="true">
            <span className="planner-deck-3d__preview-kicker">NEXT</span>
            <span className="planner-deck-3d__preview-title">{next.label}</span>
            {next.hint && <span className="planner-deck-3d__preview-hint">{next.hint}</span>}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            className="planner-deck-3d__active"
            initial={{ opacity: 0, rotateY: direction > 0 ? -55 : 55, x: direction > 0 ? 90 : -90, z: -140, scale: 0.88 }}
            animate={{ opacity: 1, rotateY: 0, x: 0, z: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: direction > 0 ? 55 : -55, x: direction > 0 ? -90 : 90, z: -140, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
          >
            <motion.div
              style={{ x, rotateY, opacity: dragOpacity, transformPerspective: 1200 }}
              drag="x"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.24}
              dragMomentum={false}
              dragDirectionLock
              onDragEnd={onDragEnd}
              whileDrag={{ scale: 0.985, z: 36, cursor: 'grabbing' }}
            >
              <div
                className="planner-deck-3d__face"
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest(NO_SWIPE_SELECTOR)) return;
                  dragControls.start(e);
                }}
              >
                {children(active.id)}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {items.length > 1 && (
        <div className="planner-deck-3d__controls">
          <button
            type="button"
            className="planner-deck-3d__arrow"
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous planner sector"
            title="Previous sector"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="planner-deck-3d__position" aria-live="polite">
            <span className="planner-deck-3d__position-title">{active.label}</span>
            <span className="planner-deck-3d__position-count">{activeIndex + 1} / {items.length}</span>
          </div>
          <button
            type="button"
            className="planner-deck-3d__arrow"
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
            aria-label="Next planner sector"
            title="Next sector"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {items.length > 1 && (
        <p className="planner-deck-3d__hint">Swipe left or right</p>
      )}
    </section>
  );
};

export default PlannerDeck;
