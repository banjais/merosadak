export type HapticType = 'light' | 'medium' | 'success' | 'warning';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined') return;
  if (!navigator.vibrate) return;

  const patterns: Record<HapticType, number | number[]> = {
    light: 8,
    medium: 15,
    success: [10, 30, 10],
    warning: [20, 20, 20, 20],
  };

  try {
    navigator.vibrate(patterns[type]);
  } catch {
    // ignore
  }
}
