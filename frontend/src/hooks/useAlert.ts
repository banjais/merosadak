
import { useState, useEffect } from 'react';
import { alertService, AppAlert } from '../services/alertService';

export function useAlert() {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);

  useEffect(() => {
    return alertService.subscribe(setAlerts);
  }, []);

  return { 
    alerts, 
    dismiss: alertService.dismiss,
    success: (msg: string) => alertService.notify('success', msg),
    error: (msg: string) => alertService.notify('error', msg),
    info: (msg: string) => alertService.notify('info', msg),
    warning: (msg: string) => alertService.notify('warning', msg)
  };
}
