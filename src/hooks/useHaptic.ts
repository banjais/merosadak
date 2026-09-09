import { useEffect, useCallback } from 'react';
import { triggerHaptic, type HapticType } from '../utils/haptic';

export function useHaptic() {
  const triggerLight = useCallback(() => triggerHaptic('light'), []);
  const triggerMedium = useCallback(() => triggerHaptic('medium'), []);
  const triggerSuccess = useCallback(() => triggerHaptic('success'), []);
  const triggerWarning = useCallback(() => triggerHaptic('warning'), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactiveEl = target.closest(
        'button, [role="button"], [role="switch"], [role="tab"], a, input, select, textarea, .cursor-pointer, [onClick]'
      );

      if (interactiveEl) {
        const isToggle =
          interactiveEl.getAttribute('role') === 'switch' ||
          interactiveEl.classList.contains('toggle') ||
          (interactiveEl.tagName === 'INPUT' &&
            ['checkbox', 'radio'].includes((interactiveEl as HTMLInputElement).type));

        if (isToggle) {
          triggerHaptic('medium');
        } else {
          triggerHaptic('light');
        }
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return {
    triggerLight,
    triggerMedium,
    triggerSuccess,
    triggerWarning,
  };
}
