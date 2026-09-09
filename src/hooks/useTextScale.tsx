import React, { createContext, useContext, useState, useEffect } from 'react';

export type TextScale = 'small' | 'medium' | 'large' | 'xlarge';

interface TextScaleContextType {
  textScale: TextScale;
  setTextScale: (scale: TextScale) => void;
  highContrast: boolean;
  setHighContrast: (contrast: boolean) => void;
}

const TextScaleContext = createContext<TextScaleContextType | undefined>(undefined);

export const TextScaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [textScale, setTextScale] = useState<TextScale>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mero-sadak-text-scale');
        if (saved === 'small' || saved === 'medium' || saved === 'large' || saved === 'xlarge') {
          return saved;
        }
      } catch {
        // ignore
      }
    }
    return 'medium';
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mero-sadak-high-contrast');
        return saved === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    root.classList.remove('text-scale-sm', 'text-scale-md', 'text-scale-lg', 'text-scale-xl');

    if (textScale === 'small') {
      root.classList.add('text-scale-sm');
    } else if (textScale === 'medium') {
      root.classList.add('text-scale-md');
    } else if (textScale === 'large') {
      root.classList.add('text-scale-lg');
    } else if (textScale === 'xlarge') {
      root.classList.add('text-scale-xl');
    }

    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    try {
      localStorage.setItem('mero-sadak-text-scale', textScale);
      localStorage.setItem('mero-sadak-high-contrast', String(highContrast));
    } catch {
      // ignore
    }
  }, [textScale, highContrast]);

  return (
    <TextScaleContext.Provider value={{ textScale, setTextScale, highContrast, setHighContrast }}>
      {children}
    </TextScaleContext.Provider>
  );
};

const defaultContext: TextScaleContextType = {
  textScale: 'medium',
  setTextScale: () => {},
  highContrast: false,
  setHighContrast: () => {},
};

export function useTextScale() {
  const context = useContext(TextScaleContext);
  if (context === undefined) {
    return defaultContext;
  }
  return context;
}
