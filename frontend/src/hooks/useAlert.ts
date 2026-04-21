import { useState, useEffect, useCallback } from 'react';
import { api, TravelIncident } from '../services/apiService';
import { useTranslation } from '../i18n';

export const useAlert = (lat?: number, lng?: number) => {
  const [alerts, setAlerts] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { i18n } = useTranslation();

  const refreshAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Pass location and current language
      const data = await api.getAlerts(lat, lng, i18n.language);
      setAlerts(data);
    } catch (error) {
      console.error('[useAlert] Fetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [lat, lng, i18n.language]);

  // Auto-refresh when params or language change
  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  return { alerts, isLoading, refresh: refreshAlerts };
};