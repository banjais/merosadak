import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

/**
 * True on a desktop-class device (wide screen with a mouse). Touch phones and
 * tablets get the swipeable 3D cards; desktops get normal tab navigation.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(DESKTOP_QUERY).matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
