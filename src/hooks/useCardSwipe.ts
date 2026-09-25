import React, { useState, useRef, useCallback, useEffect } from 'react';
import { triggerHaptic, HapticType } from '../utils/haptic';

export interface SwipeAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  onTrigger: () => void;
}

export interface UseCardSwipeOptions {
  /** Unique card identifier for persistence */
  cardId: string;
  /** Left swipe action (negative drag) */
  leftAction?: SwipeAction;
  /** Right swipe action (positive drag) */
  rightAction?: SwipeAction;
  /** Long press action */
  longPressAction?: SwipeAction;
  /** Vertical swipe action (toggle view) */
  verticalAction?: SwipeAction;
  /** Swipe threshold in pixels to trigger action */
  threshold?: number;
  /** Long press delay in ms */
  longPressDelay?: number;
  /** Whether card is currently archived/dismissed */
  isArchived?: boolean;
  /** Callback when archive state changes */
  onArchiveChange?: (archived: boolean) => void;
  /** Enable haptic feedback */
  haptics?: boolean;
  /** Custom drag elastic resistance */
  dragElastic?: number;
}

export interface UseCardSwipeReturn {
  /** Current drag offset in pixels */
  dragOffset: number;
  /** Whether long press overlay is showing */
  showQuickOverlay: boolean;
  /** Whether vertical action was triggered */
  showVerticalAction: boolean;
  /** Set quick overlay visibility */
  setShowQuickOverlay: (show: boolean) => void;
  /** Set vertical action visibility */
  setShowVerticalAction: (show: boolean) => void;
  /** Touch start handler */
  onTouchStart: (e: React.TouchEvent) => void;
  /** Touch move handler */
  onTouchMove: (e: React.TouchEvent) => void;
  /** Touch end handler */
  onTouchEnd: (e: React.TouchEvent) => void;
  /** Mouse down handler (for desktop testing) */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Mouse up handler */
  onMouseUp: () => void;
  /** Mouse leave handler */
  onMouseLeave: () => void;
  /** Context menu handler (right click = long press) */
  onContextMenu: (e: React.MouseEvent) => void;
  /** Drag styles for the card */
  dragStyles: React.CSSProperties;
  /** Left action background styles */
  leftActionStyles: React.CSSProperties;
  /** Right action background styles */
  rightActionStyles: React.CSSProperties;
  /** Archive the card */
  archiveCard: () => void;
  /** Restore the card */
  restoreCard: () => void;
  /** Check if card is archived */
  isArchived: boolean;
}

const ARCHIVE_STORAGE_KEY = 'merosadak-card-archive';

function getArchivedCards(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveArchivedCards(cards: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify([...cards]));
  } catch {}
}

export function useCardSwipe({
  cardId,
  leftAction,
  rightAction,
  longPressAction,
  verticalAction,
  threshold = 65,
  longPressDelay = 400,
  isArchived: initialArchived = false,
  onArchiveChange,
  haptics = true,
  dragElastic = 0.6,
}: UseCardSwipeOptions): UseCardSwipeReturn {
  const [dragOffset, setDragOffset] = useState(0);
  const [showQuickOverlay, setShowQuickOverlay] = useState(false);
  const [showVerticalAction, setShowVerticalAction] = useState(false);
  const [isArchived, setIsArchived] = useState(() => {
    if (initialArchived) return true;
    return getArchivedCards().has(cardId);
  });

  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);
  const touchStartCoords = useRef<{ x: number; y: number } | null>(null);
  const thresholdCrossedRef = useRef<'none' | 'left' | 'right'>('none');
  const isDraggingRef = useRef(false);

  // Sync with external archive state
  useEffect(() => {
    if (initialArchived !== isArchived) {
      setIsArchived(initialArchived);
    }
  }, [initialArchived]);

  // Persist archive state
  useEffect(() => {
    const archived = getArchivedCards();
    if (isArchived) {
      archived.add(cardId);
    } else {
      archived.delete(cardId);
    }
    saveArchivedCards(archived);
    onArchiveChange?.(isArchived);
  }, [isArchived, cardId, onArchiveChange]);

  const triggerHapticSafe = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'warning') => {
    if (haptics) triggerHaptic(type);
  }, [haptics]);

  const startPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target?.closest('button') || target?.closest('a') || target?.closest('input') || target?.closest('[data-no-swipe]')) {
      return;
    }

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    didLongPressRef.current = false;

    pressTimerRef.current = setTimeout(() => {
      if (longPressAction) {
        setShowQuickOverlay(true);
        didLongPressRef.current = true;
        triggerHapticSafe('medium');
      }
    }, longPressDelay);
  }, [longPressAction, longPressDelay, triggerHapticSafe]);

  const endPress = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startPress(e);
    const touch = e.touches[0];
    touchStartCoords.current = { x: touch.clientX, y: touch.clientY };
    isDraggingRef.current = false;
  }, [startPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartCoords.current) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartCoords.current.x;
    const diffY = touch.clientY - touchStartCoords.current.y;

    // Focus on horizontal swipes
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 10) {
        isDraggingRef.current = true;
        endPress();
        try { if (e.cancelable) e.preventDefault(); } catch {}
      }
      const elasticOffset = diffX * dragElastic;
      setDragOffset(elasticOffset);

      // Haptic at threshold crossing
      if (elasticOffset < -threshold) {
        if (thresholdCrossedRef.current !== 'left') {
          thresholdCrossedRef.current = 'left';
          triggerHapticSafe('heavy');
        }
      } else if (elasticOffset > threshold) {
        if (thresholdCrossedRef.current !== 'right') {
          thresholdCrossedRef.current = 'right';
          triggerHapticSafe('heavy');
        }
      } else {
        if (thresholdCrossedRef.current !== 'none') {
          thresholdCrossedRef.current = 'none';
          triggerHapticSafe('light');
        }
      }
    } else if (Math.abs(diffY) > 30 && verticalAction) {
      // Vertical swipe detection
      endPress();
    }
  }, [dragElastic, threshold, verticalAction, endPress, triggerHapticSafe]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    endPress();
    if (!touchStartCoords.current) {
      setDragOffset(0);
      thresholdCrossedRef.current = 'none';
      return;
    }

    const touch = e.changedTouches[0] || e.touches[0];
    let finalDiffX = dragOffset;
    let finalDiffY = 0;
    
    if (touch) {
      finalDiffX = touch.clientX - touchStartCoords.current.x;
      finalDiffY = touch.clientY - touchStartCoords.current.y;
    }

    // Vertical swipe - toggle view
    if (Math.abs(finalDiffY) > Math.abs(finalDiffX) && Math.abs(finalDiffY) > 50 && verticalAction) {
      setShowVerticalAction(true);
      triggerHapticSafe('light');
      setTimeout(() => setShowVerticalAction(false), 300);
    } 
    // Left swipe - archive/dismiss
    else if (finalDiffX < -threshold && leftAction) {
      leftAction.onTrigger();
      triggerHapticSafe('success');
    } 
    // Right swipe - detail/action
    else if (finalDiffX > threshold && rightAction) {
      rightAction.onTrigger();
      triggerHapticSafe('success');
    }

    touchStartCoords.current = null;
    thresholdCrossedRef.current = 'none';
    setDragOffset(0);
    isDraggingRef.current = false;
  }, [dragOffset, threshold, leftAction, rightAction, verticalAction, endPress, triggerHapticSafe]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startPress(e);
  }, [startPress]);

  const handleMouseUp = useCallback(() => {
    endPress();
    setDragOffset(0);
    thresholdCrossedRef.current = 'none';
  }, [endPress]);

  const handleMouseLeave = useCallback(() => {
    endPress();
    setDragOffset(0);
    thresholdCrossedRef.current = 'none';
  }, [endPress]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (longPressAction) {
      e.preventDefault();
      setShowQuickOverlay(true);
      didLongPressRef.current = true;
      triggerHapticSafe('medium');
    }
  }, [longPressAction, triggerHapticSafe]);

  const archiveCard = useCallback(() => {
    setIsArchived(true);
    triggerHapticSafe('success');
  }, [triggerHapticSafe]);

  const restoreCard = useCallback(() => {
    setIsArchived(false);
    triggerHapticSafe('light');
  }, [triggerHapticSafe]);

  // Compute glow styles based on drag offset
  const glowStyles = dragOffset !== 0 ? (() => {
    const ratio = Math.min(1, Math.abs(dragOffset) / 100);
    const intensity = ratio * 0.55;
    const size = 12 + ratio * 24;
    
    if (dragOffset > 0 && rightAction) {
      // Right swipe glow (action color)
      const color = rightAction.color.replace('text-', '').replace('-400', '-500').replace('-300', '-500');
      return {
        boxShadow: `0 0 ${size}px ${color}, inset 0 0 10px ${color}CC`,
        borderColor: `${color}DD`,
      };
    } else if (dragOffset < 0 && leftAction) {
      // Left swipe glow (archive color)
      const color = leftAction.color.replace('text-', '').replace('-400', '-500').replace('-300', '-500');
      return {
        boxShadow: `0 0 ${size}px ${color}, inset 0 0 10px ${color}CC`,
        borderColor: `${color}DD`,
      };
    }
    return {};
  })() : {};

  const dragStyles: React.CSSProperties = {
    transform: `translateX(${dragOffset}px)`,
    ...glowStyles,
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease',
    touchAction: 'pan-y',
  };

  // Left action background (revealed on right drag)
  const leftActionStyles: React.CSSProperties = {
    opacity: dragOffset > 5 ? Math.min(1, dragOffset / threshold) : 0,
    pointerEvents: dragOffset > 5 ? 'auto' : 'none',
    transform: `translateX(${Math.min(dragOffset * 0.5, threshold)}px)`,
  };

  // Right action background (revealed on left drag)
  const rightActionStyles: React.CSSProperties = {
    opacity: dragOffset < -5 ? Math.min(1, -dragOffset / threshold) : 0,
    pointerEvents: dragOffset < -5 ? 'auto' : 'none',
    transform: `translateX(${Math.max(dragOffset * 0.5, -threshold)}px)`,
  };

  return {
    dragOffset,
    showQuickOverlay,
    showVerticalAction,
    setShowQuickOverlay,
    setShowVerticalAction,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onContextMenu: handleContextMenu,
    dragStyles,
    leftActionStyles,
    rightActionStyles,
    archiveCard,
    restoreCard,
    isArchived,
  };
}