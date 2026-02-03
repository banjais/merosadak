
import { useState, useCallback } from 'react';
import { superadminService } from '../services/superadminService';
import { useAuth } from './useAuth';

export function useSuperadmin() {
  const { user } = useAuth();
  const [isBusy, setIsBusy] = useState(false);

  const isSuperadmin = user?.role === 'superadmin';

  const broadcast = useCallback(async (msg: string) => {
    if (!isSuperadmin) return;
    setIsBusy(true);
    await superadminService.broadcastSystemUpdate(msg);
    setIsBusy(false);
  }, [isSuperadmin]);

  const purge = useCallback(async () => {
    if (!isSuperadmin) return;
    setIsBusy(true);
    await superadminService.purgeCache();
    setIsBusy(false);
  }, [isSuperadmin]);

  return { isSuperadmin, broadcast, purge, isBusy };
}
