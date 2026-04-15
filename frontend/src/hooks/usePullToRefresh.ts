import { useEffect, useRef } from "react";
import { checkForUpdate, applyUpdate } from "../utils/updateManager";

export function usePullToRefresh() {
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const threshold = 80; // pull distance

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > threshold) {
        pulling.current = false;

        checkForUpdate().then((hasUpdate) => {
          if (hasUpdate) {
            const confirmUpdate = window.confirm(
              "🚀 New update available! Refresh now?"
            );

            if (confirmUpdate) {
              applyUpdate();
            }
          }
        });
      }
    };

    const onTouchEnd = () => {
      pulling.current = false;
    };

    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
}