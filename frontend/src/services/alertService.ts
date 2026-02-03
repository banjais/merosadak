
export type AppAlert = {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
};

let alertListeners: ((alerts: AppAlert[]) => void)[] = [];
let currentAlerts: AppAlert[] = [];

export const alertService = {
  subscribe: (listener: (alerts: AppAlert[]) => void) => {
    alertListeners.push(listener);
    return () => {
      alertListeners = alertListeners.filter(l => l !== listener);
    };
  },
  
  notify: (type: AppAlert['type'], message: string, duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newAlert: AppAlert = { id, type, message, duration };
    currentAlerts = [...currentAlerts, newAlert];
    alertListeners.forEach(l => l(currentAlerts));
    
    if (duration > 0) {
      setTimeout(() => {
        alertService.dismiss(id);
      }, duration);
    }
  },

  dismiss: (id: string) => {
    currentAlerts = currentAlerts.filter(a => a.id !== id);
    alertListeners.forEach(l => l(currentAlerts));
  }
};
