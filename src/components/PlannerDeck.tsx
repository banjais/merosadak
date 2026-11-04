import React, { useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, animate } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 420;
const ROTATE_RANGE = 13;

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
  const x = useMotionValue(0);
  const rotateY = useTransform(x, [-220, 0, 220], [ROTATE_RANGE, 0, -ROTATE_RANGE]);
  const dragOpacity = useTransform(x, [-260, -80, 0, 80, 260], [0.55, 1, 1, 1, 0.55]);
  const direction = useRef(1);

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
    direction.current = index > activeIndex ? 1 : -1;
    x.set(0);
    onChange(items[index].id);
    try {
      triggerHaptic('light');
    } catch {
      // Haptics are optional; navigation must still work without them.
    }
  }, [items, activeIndex, onChange, x]);

  const onDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) {
      void animate(x, -260, { duration: 0.17, ease: 'easeOut' }).then(() => goTo(activeIndex + 1));
    } else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) {
      void animate(x, 260, { duration: 0.17, ease: 'easeOut' }).then(() => goTo(activeIndex - 1));
    } else {
      void animate(x, 0, { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 });
    }
  }, [activeIndex, goTo, x]);

  if (!active) return null;

  return (
    <section className={`planner-deck-3d ${variant === 'plain' ? 'planner-deck-3d--plain' : ''}`} aria-label="Trip planner sectors">
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

        <motion.div
          key={active.id}
          className="planner-deck-3d__active"
          style={{ x, rotateY, opacity: dragOpacity, transformPerspective: 1200 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          dragMomentum={false}
          dragDirectionLock
          onDragEnd={onDragEnd}
          whileDrag={{ scale: 0.985, z: 36, cursor: 'grabbing' }}
          initial={{ opacity: 0.7, x: direction.current * 34, rotateY: direction.current * -8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ type: 'spring', stiffness: 330, damping: 30, mass: 0.8 }}
        >
          <div className="planner-deck-3d__face">
            {children(active.id)}
          </div>
        </motion.div>
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
        <p className="planner-deck-3d__hint">Drag the card left or right to explore each trip sector</p>
      )}
    </section>
  );
};

export default PlannerDeck;
