// frontend/src/hooks/usePullToRefresh.ts
import { useState, useCallback, useEffect, useRef } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  distance?: number;
  disabled?: boolean;
}

export function usePullToRefresh({ onRefresh, distance = 80, disabled = false }: PullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistance = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || window.scrollY !== 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    pullDistance.current = 0;
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || disabled) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      pullDistance.current = diff;
      setIsPulling(diff > distance * 0.3);
    }
  }, [disabled, distance]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || disabled) {
      pulling.current = false;
      setIsPulling(false);
      return;
    }

    pulling.current = false;
    setIsPulling(false);

    if (pullDistance.current > distance) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    pullDistance.current = 0;
  }, [disabled, distance, onRefresh]);

  useEffect(() => {
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isPulling, isRefreshing, pullDistance: pullDistance.current };
}