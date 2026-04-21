import { useState, useEffect, useCallback } from 'react';
import { api, TravelIncident } from '../services/apiService';
import { useTranslation } from '../i18n';

export const useNepalData = () => {
  const [incidents, setIncidents] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { i18n } = useTranslation();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // Pass current language from i18n context
      const data = await api.getRoads(i18n.language);
      setIncidents(data);
    } catch (error) {
      console.error('[useNepalData] Fetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [i18n.language]);

  // Auto-refresh when language changes or on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { incidents, isLoading, refresh };
};