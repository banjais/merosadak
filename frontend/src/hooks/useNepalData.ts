import { useState, useEffect, useCallback } from 'react';
import { api, TravelIncident } from '../services/apiService';
import { useTranslation } from '../i18n';

export const useNepalData = () => {
  const [incidents, setIncidents] = useState<TravelIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useTranslation();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getRoads(language);
      setIncidents(data);
    } catch (error) {
      console.error('[useNepalData] Fetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  // Auto-refresh when language changes or on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { incidents, isLoading, refresh };
};