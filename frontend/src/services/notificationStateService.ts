// frontend/src/services/notificationStateService.ts
// Tracks push notification permission state and preferences

const STORAGE_KEY = 'merosadak_notifications';

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'dismissed';

export interface NotificationState {
  permission: NotificationPermission;
  lastPrompted: string | null;
  promptCount: number;
  enabled: boolean; // user's choice in-app
  categories: {
    roadIncidents: boolean;
    weatherAlerts: boolean;
    trafficUpdates: boolean;
    monsoonWarnings: boolean;
    maintenanceAlerts: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;
  };
  lastChecked: string;
}

const DEFAULT_STATE: NotificationState = {
  permission: 'default',
  lastPrompted: null,
  promptCount: 0,
  enabled: false,
  categories: {
    roadIncidents: true,
    weatherAlerts: true,
    trafficUpdates: false,
    monsoonWarnings: true,
    maintenanceAlerts: false,
  },
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00',
  },
  lastChecked: new Date().toISOString(),
};

function getState(): NotificationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: Partial<NotificationState>): void {
  try {
    const current = getState();
    const updated = {
      ...current,
      ...state,
      lastChecked: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[NotificationState] Failed to save:', e);
  }
}

export const notificationStateService = {
  /** Get current notification state */
  get: (): NotificationState => getState(),

  /** Sync with actual browser permission */
  async syncWithBrowser(): Promise<NotificationState> {
    if ('Notification' in window) {
      const permission = Notification.permission as NotificationPermission;
      saveState({ permission });
      return getState();
    }
    return getState();
  },

  /** Request notification permission */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      saveState({ permission: 'denied' });
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    saveState({
      permission: permission as NotificationPermission,
      lastPrompted: new Date().toISOString(),
      promptCount: getState().promptCount + 1,
    });

    return permission as NotificationPermission;
  },

  /** Enable/disable notifications in-app */
  setEnabled: (enabled: boolean): void => {
    saveState({ enabled });
  },

  /** Update category preferences */
  setCategory: (category: keyof NotificationState['categories'], enabled: boolean): void => {
    const state = getState();
    saveState({
      categories: { ...state.categories, [category]: enabled },
    });
  },

  /** Set quiet hours */
  setQuietHours: (enabled: boolean, start: string, end: string): void => {
    saveState({
      quietHours: { enabled, start, end },
    });
  },

  /** Check if we should prompt for permission */
  shouldPrompt(): boolean {
    const state = getState();

    // Don't prompt if already granted or denied
    if (state.permission === 'granted' || state.permission === 'denied') {
      return false;
    }

    // Don't prompt if dismissed
    if (state.permission === 'dismissed') {
      return false;
    }

    // Don't prompt too frequently (max 3 times)
    if (state.promptCount >= 3) {
      return false;
    }

    // Don't prompt within 7 days of last prompt
    if (state.lastPrompted) {
      const daysSince = (Date.now() - new Date(state.lastPrompted).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        return false;
      }
    }

    return true;
  },

  /** Mark permission as dismissed (user clicked X) */
  markDismissed: (): void => {
    saveState({ permission: 'dismissed' });
  },

  /** Check if quiet hours are currently active */
  isQuietHoursNow(): boolean {
    const state = getState();
    if (!state.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = state.quietHours.start.split(':').map(Number);
    const [endH, endM] = state.quietHours.end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentTime >= startMinutes && currentTime <= endMinutes;
    } else {
      // Overnight range (e.g., 22:00 to 07:00)
      return currentTime >= startMinutes || currentTime <= endMinutes;
    }
  },

  /** Reset all notification state */
  reset: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },
};
