// frontend/src/services/themeService.ts
// Persists dark/light theme preference

const STORAGE_KEY = 'merosadak_theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeState {
  mode: ThemeMode;
  appliedTheme: 'light' | 'dark';
}

function getState(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return { mode: 'system', appliedTheme: prefersDark ? 'dark' : 'light' };
    }
    return JSON.parse(raw);
  } catch {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return { mode: 'system', appliedTheme: prefersDark ? 'dark' : 'light' };
  }
}

function saveState(state: ThemeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[Theme] Failed to save:', e);
  }
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = getState();
    if (state.mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      saveState({ ...state, appliedTheme: prefersDark ? 'dark' : 'light' });
      window.dispatchEvent(new CustomEvent('merosadak_theme_change'));
    }
  });
}

export const themeService = {
  /** Get current theme state */
  get: (): ThemeState => getState(),

  /** Set theme mode */
  set: (mode: ThemeMode): void => {
    let appliedTheme: 'light' | 'dark';

    if (mode === 'system') {
      appliedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      appliedTheme = mode;
    }

    saveState({ mode, appliedTheme });
    window.dispatchEvent(new CustomEvent('merosadak_theme_change'));
  },

  /** Get the applied theme (light or dark) */
  getAppliedTheme: (): 'light' | 'dark' => {
    return getState().appliedTheme;
  },

  /** Toggle between light and dark */
  toggle: (): void => {
    const state = getState();
    const newMode = state.appliedTheme === 'dark' ? 'light' : 'dark';
    set(newMode);
  },

  /** Check if dark mode is active */
  isDark: (): boolean => {
    return getState().appliedTheme === 'dark';
  },

  /** Apply theme to document */
  applyToDocument: (): void => {
    const state = getState();
    const root = document.documentElement;

    if (state.appliedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  },

  /** Reset theme to system default */
  reset: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },
};

// Auto-apply is called explicitly from App.tsx on mount
